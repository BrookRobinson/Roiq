// ============================================================
// Property Map — persisting a pin to Supabase.
//
// SERVER ONLY. One place for the write, so the three callers (from-report,
// score-now, the daily job) can't drift apart on how they handle a database
// that isn't there.
//
// An UPSERT on `source_key`, not an insert: a property gets one row forever, so
// re-running a report or running the daily refresh updates its pin instead of
// stacking another copy. Uses the service role — see lib/supabase/admin.ts for
// why the anon key deliberately can't write here.
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseListingUrl, propertyKey } from "@/lib/reports/listing-key";
import { mapListingInsert } from "./store";
import type { MapListing } from "./types";

export interface PersistResult {
  persisted: boolean;
  /** Why not, when it didn't — surfaced by /api/health/db and the job's log. */
  reason?: "no_service_role" | "db_error";
  detail?: string;
}

export async function persistMapListing(listing: MapListing, sourceUrl = ""): Promise<PersistResult> {
  const supabase = createAdminClient();
  if (!supabase) return { persisted: false, reason: "no_service_role" };

  try {
    // supabase-js infers the Omit-based Insert type as `never`; cast the validated row.
    const { error } = await supabase
      .from("map_listings")
      .upsert(mapListingInsert(listing, sourceUrl) as never, { onConflict: "source_key" });

    if (error) return { persisted: false, reason: "db_error", detail: error.message };

    // The nightly discovery job may already have a bare pin here — same house,
    // no score. Now that a real analysis exists, that pin is a duplicate of
    // this one, so it goes. Without this the map shows the property twice, once
    // with a score and once without, and the second looks like a different house.
    await removeDiscoveredPinFor(sourceUrl, listing.address, listing.suburb, listing.id);

    return { persisted: true };
  } catch (err) {
    return { persisted: false, reason: "db_error", detail: (err as Error).message };
  }
}

/**
 * Drop the discovery pin for a property that now has a real report.
 *
 * Best-effort and deliberately narrow: only rows whose key starts `oneroof-`,
 * i.e. ones this codebase created from a sitemap and nobody has analysed. It
 * will never touch a pin that came from someone's report.
 */
async function removeDiscoveredPinFor(
  sourceUrl: string,
  address: string | null,
  suburb: string | null,
  keepKey: string
): Promise<void> {
  const urlKey = normaliseListingUrl(sourceUrl);
  const propKey = propertyKey(address, suburb);
  if (!urlKey && !propKey) return;

  const supabase = createAdminClient();
  if (!supabase) return;

  try {
    const { data } = await supabase
      .from("map_listings")
      .select("source_key, listing_url, address, suburb, full_report_ref")
      .like("source_key", "oneroof-%");

    const stale = (data ?? [])
      .filter(
        (r) =>
          r.source_key !== keepKey &&
          !r.full_report_ref &&
          ((!!urlKey && normaliseListingUrl(r.listing_url) === urlKey) ||
            (!!propKey && propertyKey(r.address, r.suburb) === propKey))
      )
      .map((r) => r.source_key as string);

    if (stale.length) await supabase.from("map_listings").delete().in("source_key", stale);
  } catch (err) {
    // A duplicate pin is untidy; failing the report's map contribution over it
    // would be worse.
    console.warn("[map] couldn't clear the discovery pin:", (err as Error)?.message);
  }
}
