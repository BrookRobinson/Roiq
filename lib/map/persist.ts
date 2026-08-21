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
    return { persisted: true };
  } catch (err) {
    return { persisted: false, reason: "db_error", detail: (err as Error).message };
  }
}
