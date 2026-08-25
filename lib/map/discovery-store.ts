// ============================================================
// Writing discovered listings to the map — SERVER ONLY.
//
// A discovered pin says "this property is for sale, here". It carries no
// score, no valuation and no yield, because none have been worked out. Every
// scoring column is left null on purpose: a real address beside an invented
// number is worse than no pin at all, and it's the same failure the seed
// listings rule guards against.
//
// Service role, like every other map write — map_listings has a read-everyone
// policy and deliberately no write policy. See lib/supabase/admin.ts.
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseListingUrl, propertyKey } from "@/lib/reports/listing-key";
import type { DiscoveredListing } from "@/lib/map/discovery";
import { geocodeAddress } from "@/lib/map/geocode";

export interface DiscoveryPersistResult {
  added: number;
  updated: number;
  /** Already on the map because someone analysed it — left alone. */
  skippedAnalysed: number;
  /** Listings whose portal page changed since we last saw it. */
  changed: DiscoveredListing[];
  /** Bare pins removed because a real analysed pin now covers the property. */
  supersededByReport?: number;
  failed: number;
  reason?: string;
}

const sourceKeyFor = (l: DiscoveredListing) => `oneroof-${l.portalId}`;

/**
 * Record what's for sale.
 *
 * The one thing this must not do is give a property two pins. A house someone
 * has already analysed is on the map under `report-<id>` with a real score;
 * discovering the same URL must not add a bare second copy beside it. So every
 * existing listing_url is read first and matched on its normalised form —
 * the same rules that decide whether two people pasted the same house.
 */
export async function persistDiscoveredListings(
  listings: DiscoveredListing[]
): Promise<DiscoveryPersistResult> {
  const empty: DiscoveryPersistResult = { added: 0, updated: 0, skippedAnalysed: 0, changed: [], failed: 0 };
  if (listings.length === 0) return empty;

  const supabase = createAdminClient();
  if (!supabase) return { ...empty, reason: "no_database" };

  try {
    // Everything already on the map, by URL and by key.
    const { data: existing, error } = await supabase
      .from("map_listings")
      .select("source_key, listing_url, address, suburb, portal_last_modified, full_report_ref");
    if (error) throw new Error(error.message);

    // Several rows can point at one property — a pin from a report and a pin
    // from a previous night's discovery. Keyed by URL, they must be considered
    // together, or whichever one happens to match first decides the outcome.
    // Two indexes, because the two pin sources don't share an identifier.
    // Discovery has the listing URL. Report pins written before that was stored
    // have only the address — hence the second key.
    const byUrl = new Map<string, typeof existing>();
    const byProperty = new Map<string, typeof existing>();
    const add = (m: Map<string, typeof existing>, k: string | null, row: (typeof existing)[number]) => {
      if (!k) return;
      const bucket = m.get(k) ?? [];
      bucket.push(row);
      m.set(k, bucket);
    };
    for (const row of existing ?? []) {
      add(byUrl, normaliseListingUrl(row.listing_url), row);
      add(byProperty, propertyKey(row.address, row.suburb), row);
    }

    const result: DiscoveryPersistResult = { ...empty, changed: [] };
    const rows: Record<string, unknown>[] = [];
    const redundant: string[] = [];
    const now = new Date().toISOString();

    for (const l of listings) {
      const key = sourceKeyFor(l);
      const urlKey = normaliseListingUrl(l.url);
      const propKey = propertyKey(l.address, l.town);
      const siblings = [
        ...((urlKey ? byUrl.get(urlKey) : undefined) ?? []),
        ...((propKey ? byProperty.get(propKey) : undefined) ?? []),
      ].filter((row, i, all) => all.findIndex((r) => r.source_key === row.source_key) === i);

      // Someone has analysed this property. That pin has a real score and this
      // row would not, so it wins outright — and any bare pin we left here on
      // an earlier night is now redundant and gets removed rather than sitting
      // alongside it as a second copy of the same house.
      const analysed = siblings.find((r) => r.full_report_ref);
      if (analysed) {
        result.skippedAnalysed++;
        for (const s of siblings) {
          if (s.source_key && s.source_key !== analysed.source_key && s.source_key.startsWith("oneroof-")) {
            redundant.push(s.source_key);
          }
        }
        continue;
      }

      const prior = siblings.find((r) => r.source_key === key) ?? siblings[0];

      // The portal edited a page we already hold. Worth surfacing: if a report
      // exists for it, that analysis may now describe a price or photos that
      // are gone.
      if (prior && l.lastModified && prior.portal_last_modified !== l.lastModified) {
        result.changed.push(l);
      }

      rows.push({
        source_key: key,
        listing_url: l.url,
        address: l.address,
        suburb: l.town,
        region: l.region,
        source_portal: "oneroof",
        listing_status: "active",
        // The only property-type fact a sitemap carries. "rural" is real — the
        // portal filed it there itself. "residential" is NOT written as a type,
        // because it lumps a house, an apartment, a townhouse and a bare section
        // together and writing any of those would be a guess. Null means "not
        // known yet", which the map says out loud rather than hiding.
        property_type: l.category === "rural" ? "rural" : undefined,
        portal_last_modified: l.lastModified,
        discovered_at: prior ? undefined : now,
        last_seen: now,
      });

      if (prior) result.updated++;
      else result.added++;
    }

    if (redundant.length) {
      await supabase.from("map_listings").delete().in("source_key", redundant);
      result.supersededByReport = redundant.length;
    }

    // Chunked so one oversized request can't fail the whole night's run.
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error: writeError } = await supabase
        .from("map_listings")
        .upsert(chunk as never, { onConflict: "source_key" });
      if (writeError) {
        console.warn("[discovery] chunk failed:", writeError.message);
        result.failed += chunk.length;
      }
    }

    return result;
  } catch (err) {
    return { ...empty, reason: (err as Error).message };
  }
}

/**
 * Put coordinates on the pins that don't have any.
 *
 * Discovery reads addresses out of sitemap URLs, which is free but gives no
 * location — and a pin without one silently lands at 0,0 in the Atlantic
 * rather than failing visibly. So it runs as its own step, capped per night:
 * Mapbox's free geocoding allowance is generous but finite, and a runaway loop
 * over 30,000 listings would eat a month of it in one run.
 *
 * A listing whose address won't geocode is left without coordinates and simply
 * doesn't appear on the map. That's the right failure — better absent than
 * pinned to the wrong street.
 */
export async function geocodeMissingPins(
  opts: { limit?: number; concurrency?: number; timeBudgetMs?: number } = {}
): Promise<{ geocoded: number; failed: number; remaining: number; stopped: "done" | "limit" | "time" }> {
  // LINZ answers in roughly three seconds, sometimes ten. The nightly route has
  // a 300s ceiling and shares it with discovery and the market refresh, so this
  // works to a wall clock rather than a count: it stops when the budget is
  // spent and picks the rest up tomorrow. A backlog draining over several
  // nights is fine; a route that times out mid-write is not.
  const { limit = 400, concurrency = 4, timeBudgetMs = 150_000 } = opts;
  const startedAt = Date.now();

  const db = createAdminClient();
  if (!db) return { geocoded: 0, failed: 0, remaining: 0, stopped: "done" };
  const supabase = db; // narrowed, so the closures below don't re-check

  const { data, error } = await supabase
    .from("map_listings")
    .select("source_key, address, suburb, region")
    .is("lat", null)
    .like("source_key", "oneroof-%")
    .limit(limit);

  if (error || !data?.length) return { geocoded: 0, failed: 0, remaining: 0, stopped: "done" };

  const queue = data.filter((r) => r.source_key);
  let geocoded = 0;
  let failed = 0;
  let stopped: "done" | "limit" | "time" = "done";
  let next = 0;

  // A few at a time. LINZ is a public service and this is never urgent, so the
  // concurrency stays low — enough to hide the latency, not enough to lean on it.
  async function worker(): Promise<void> {
    while (true) {
      if (Date.now() - startedAt > timeBudgetMs) {
        stopped = "time";
        return;
      }
      const row = queue[next++];
      if (!row) return;

      // Region and country are dropped by the geocoder itself, but suburb helps
      // it disambiguate a street name that repeats across the country.
      const query = [row.address, row.suburb].filter(Boolean).join(", ");
      const point = await geocodeAddress(query);

      if (point) {
        await supabase
          .from("map_listings")
          .update({ lat: point.lat, lng: point.lng } as never)
          .eq("source_key", row.source_key as string);
        geocoded++;
      } else {
        failed++;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

  // Count what's left rather than inferring it from the page we fetched.
  // PostgREST caps a response at its own max-rows setting (1,000 by default),
  // so a `limit` above that comes back short and a full page looks exactly
  // like the end of the queue — which had this reporting "remaining: 0" with
  // 888 addresses still to do.
  const { count, error: countError } = await supabase
    .from("map_listings")
    .select("source_key", { count: "exact", head: true })
    .is("lat", null)
    .like("source_key", "oneroof-%");

  // A FAILED count must not read as an empty queue. `count ?? 0` said "0 left"
  // when the count query errored, and the backfill driver — which stops when
  // nothing is left — stopped at 16% with 31,812 addresses still to do and
  // reported success. Unknown is not zero: fall back to what this pass could
  // still see, so the caller keeps going rather than declaring victory.
  const remaining = countError || count == null ? Math.max(0, queue.length - next) : count;
  if (remaining > 0 && stopped === "done") stopped = "limit";

  return { geocoded, failed, remaining, stopped };
}
