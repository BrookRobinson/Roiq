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
import { normaliseListingUrl } from "@/lib/reports/listing-key";
import type { DiscoveredListing } from "@/lib/map/discovery";

export interface DiscoveryPersistResult {
  added: number;
  updated: number;
  /** Already on the map because someone analysed it — left alone. */
  skippedAnalysed: number;
  /** Listings whose portal page changed since we last saw it. */
  changed: DiscoveredListing[];
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
      .select("source_key, listing_url, portal_last_modified, full_report_ref");
    if (error) throw new Error(error.message);

    const byUrl = new Map<string, (typeof existing)[number]>();
    const byKey = new Map<string, (typeof existing)[number]>();
    for (const row of existing ?? []) {
      const u = normaliseListingUrl(row.listing_url);
      if (u) byUrl.set(u, row);
      if (row.source_key) byKey.set(row.source_key, row);
    }

    const result: DiscoveryPersistResult = { ...empty, changed: [] };
    const rows: Record<string, unknown>[] = [];
    const now = new Date().toISOString();

    for (const l of listings) {
      const key = sourceKeyFor(l);
      const urlKey = normaliseListingUrl(l.url);
      const priorByUrl = urlKey ? byUrl.get(urlKey) : undefined;
      const prior = byKey.get(key) ?? priorByUrl;

      // Already a real, analysed pin for this property under a different key.
      // Leave it entirely alone — it has a score and this row wouldn't.
      if (prior && prior.source_key !== key && prior.full_report_ref) {
        result.skippedAnalysed++;
        continue;
      }

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
        portal_last_modified: l.lastModified,
        discovered_at: prior ? undefined : now,
        last_seen: now,
      });

      if (prior) result.updated++;
      else result.added++;
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
