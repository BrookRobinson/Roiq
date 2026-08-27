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
import { readAllPages } from "@/lib/supabase/paged";
import { normaliseListingUrl, propertyKey } from "@/lib/reports/listing-key";
import type { DiscoveredListing } from "@/lib/map/discovery";
import { geocodeAddress } from "@/lib/map/geocode";
import {
  planSweep,
  seenEnough,
  sweepRefusal,
  REFUSAL_REASON,
  type CrawlScope,
  type HeldPin,
  type SweepRefusal,
} from "@/lib/map/delisting";

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
    //
    // Paged. This was a single unbounded select, which PostgREST silently
    // truncates at 1,000 rows — so with 41,103 pins the "has anyone analysed
    // this property already?" check was reading the first 2% of the table and
    // answering no for the rest, which is how an analysed house gains a second
    // scoreless pin beside it.
    const existing = await readAllPages<{
      source_key: string | null;
      listing_url: string | null;
      address: string | null;
      suburb: string | null;
      portal_last_modified: string | null;
      full_report_ref: string | null;
    }>(() =>
      supabase
        .from("map_listings")
        .select("source_key, listing_url, address, suburb, portal_last_modified, full_report_ref")
    );

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
        // Seeing it in the index settles the question. A pin we suspected had
        // gone hasn't, and one we'd concluded had gone has been re-listed —
        // either way it is on the market now, and a delisting date sitting on
        // an active listing is a contradiction, not a record.
        missing_since: null,
        delisted_at: null,
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

/**
 * Write the property types a type crawl worked out.
 *
 * Only ever fills a gap or corrects a discovered pin. A listing someone has
 * ANALYSED has its type from the listing page itself — read, not inferred from
 * a search-result category — so that one wins and is left alone.
 */
export async function persistPropertyTypes(
  types: Map<string, string>
): Promise<{ updated: number; failed: number }> {
  const supabase = createAdminClient();
  if (!supabase || types.size === 0) return { updated: 0, failed: 0 };

  let updated = 0;
  let failed = 0;
  const entries = [...types.entries()];

  // Batched by type: one update per distinct type per chunk, rather than one
  // round trip per listing. 200 keys a time keeps the URL inside PostgREST's
  // limits on an `in` filter.
  const byType = new Map<string, string[]>();
  for (const [portalId, t] of entries) {
    const list = byType.get(t) ?? [];
    list.push(`oneroof-${portalId}`);
    byType.set(t, list);
  }

  for (const [type, keys] of byType) {
    for (let i = 0; i < keys.length; i += 200) {
      const chunk = keys.slice(i, i + 200);
      const { error, data } = await supabase
        .from("map_listings")
        .update({ property_type: type } as never)
        .in("source_key", chunk)
        .is("full_report_id", null) // an analysed listing knows better
        .select("source_key");
      if (error) failed += chunk.length;
      else updated += data?.length ?? 0;
    }
  }

  return { updated, failed };
}

// ── Off-market sweep ────────────────────────────────────────────────────────

export interface DelistingSweepResult {
  /** False when the crawl wasn't entitled to conclude anything. */
  ran: boolean;
  refusal?: SweepRefusal;
  /** Plain-English version of the refusal, for the run log. */
  because?: string;
  /** Pins confirmed gone — absent from two complete crawls running. */
  delisted: number;
  /** Pins absent for the first time. Noted, nothing written to the map. */
  suspected: number;
  /** Pins back in the index, suspicion withdrawn. */
  returned: number;
  /** Active pins that were in the crawled index at all. */
  eligible: number;
  seen: number;
  failed: number;
  reason?: string;
}

/** Only OneRoof URLs are in the index this sweep crawled. */
function oneRoofKey(url: string | null): string | null {
  if (!url || !/^https?:\/\/(www\.)?oneroof\.co\.nz\//i.test(url)) return null;
  return normaliseListingUrl(url);
}

/**
 * Record which listings have left the market.
 *
 * The signal is absence from OneRoof's for-sale index. That is also exactly
 * what a half-broken crawl looks like, so almost all of the work here is
 * declining to act: `sweepRefusal` rejects any crawl that wasn't a complete
 * read of both sitemaps, `seenEnough` rejects one that came back implausibly
 * short, and `planSweep` requires a listing to go missing twice before writing
 * anything down. A refused sweep is a normal outcome and says why.
 *
 * What it writes is `removed`, never `sold`. A listing leaves a portal because
 * it sold, because it was withdrawn, or because the vendor gave up, and from
 * outside those are identical. The asking price is frozen at the same
 * moment because that is the number that stops being knowable — the page is
 * gone within days, and a sale price arriving months later has nothing to be
 * compared against unless we kept it.
 */
export async function sweepDelisted(
  crawled: readonly { url: string }[],
  scope: CrawlScope
): Promise<DelistingSweepResult> {
  // Normalised the same way the held pins are, or nothing matches and the
  // sweep delists the entire index on its second run.
  const seenUrls = new Set<string>();
  for (const l of crawled) {
    const key = oneRoofKey(l.url);
    if (key) seenUrls.add(key);
  }

  const idle: DelistingSweepResult = {
    ran: false,
    delisted: 0,
    suspected: 0,
    returned: 0,
    eligible: 0,
    seen: seenUrls.size,
    failed: 0,
  };

  const refusal = sweepRefusal(scope);
  if (refusal) return { ...idle, refusal, because: REFUSAL_REASON[refusal] };

  const supabase = createAdminClient();
  if (!supabase) return { ...idle, reason: "no_database" };

  try {
    const active = await readAllPages<{
      source_key: string | null;
      listing_url: string | null;
      listing_status: string | null;
      missing_since: string | null;
      asking_price: number | null;
    }>(() =>
      supabase
        .from("map_listings")
        .select("source_key, listing_url, listing_status, missing_since, asking_price")
        .eq("listing_status", "active")
    );

    const held: HeldPin[] = [];
    const askingByKey = new Map<string, number | null>();
    for (const row of active) {
      if (!row.source_key) continue;
      held.push({
        sourceKey: row.source_key,
        indexKey: oneRoofKey(row.listing_url),
        missingSince: row.missing_since,
        listingStatus: row.listing_status,
      });
      askingByKey.set(row.source_key, row.asking_price);
    }

    const eligible = held.filter((p) => p.indexKey).length;
    // The circuit breaker, measured against the pins this crawl could possibly
    // have seen rather than the whole table — report pins from other portals
    // are not in this index and would drag the ratio down for no reason.
    if (!seenEnough(seenUrls.size, eligible)) {
      return { ...idle, refusal: "too-few-seen", because: REFUSAL_REASON["too-few-seen"], eligible };
    }

    const plan = planSweep(held, seenUrls);
    const now = new Date().toISOString();
    let failed = 0;

    const update = async (keys: string[], patch: Record<string, unknown>) => {
      for (let i = 0; i < keys.length; i += 200) {
        const chunk = keys.slice(i, i + 200);
        const { error } = await supabase
          .from("map_listings")
          .update(patch as never)
          .in("source_key", chunk);
        if (error) {
          console.warn("[delisting] chunk failed:", error.message);
          failed += chunk.length;
        }
      }
    };

    await update(plan.returned, { missing_since: null });
    await update(plan.suspect, { missing_since: now });

    // The asking price has to be copied per row, and PostgREST can't set a
    // column from another column. Grouping by value makes it a handful of
    // updates rather than one per listing — and for discovered pins it is a
    // single batch, because the sitemap carries no price and they are all null.
    const byAsking = new Map<number | null, string[]>();
    for (const key of plan.delist) {
      const price = askingByKey.get(key) ?? null;
      const bucket = byAsking.get(price) ?? [];
      bucket.push(key);
      byAsking.set(price, bucket);
    }
    for (const [price, keys] of byAsking) {
      await update(keys, {
        listing_status: "removed",
        delisted_at: now,
        missing_since: null,
        last_asking_price: price,
      });
    }

    return {
      ran: true,
      delisted: plan.delist.length,
      suspected: plan.suspect.length,
      returned: plan.returned.length,
      eligible,
      seen: seenUrls.size,
      failed,
    };
  } catch (err) {
    return { ...idle, reason: (err as Error).message };
  }
}
