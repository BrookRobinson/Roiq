import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SEED_LISTINGS, mapListingInsert } from "@/lib/map/store";
import { fetchActiveListings } from "@/lib/map/sources";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Guarded by CRON_SECRET when set (Vercel Cron sends it); open in local dev. */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get("authorization") ?? req.headers.get("x-cron-secret") ?? "";
  return header === `Bearer ${secret}` || header === secret;
}

/**
 * POST /api/map/score-run — the every-24-hours scoring job (wired to a Vercel Cron
 * in vercel.json).
 *
 * TODO (live): fetchActiveListings() returns real OneRoof + realestate.co.nz
 *   listings; diff against map_listings to find NEW and PRICE-CHANGED listings,
 *   score those through the score-now pipeline (analyseProperty + repair costing +
 *   suburb rent/growth), and mark listings that disappeared as sold.
 * Today: the mock source returns the 20 pre-scored seed listings, which are
 *   persisted into map_listings so the DB path is exercised end to end.
 */
async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized", message: "Invalid cron secret." }, { status: 401 });
  }

  const raw = await fetchActiveListings(); // mock; real portals go here
  let scored = 0;
  let failed = 0;

  try {
    const supabase = createClient();
    for (const l of SEED_LISTINGS) {
      // Live: only NEW/CHANGED listings would run the full scoring pipeline here.
      // Seed listings are already scored, so persist their snapshot.
      const { error } = await supabase.from("map_listings").insert(mapListingInsert(l, "") as never);
      if (error) failed++;
      else scored++;
    }
  } catch (err) {
    console.error("[map/score-run]", err);
  }

  const run = {
    at: new Date().toISOString(),
    fetched: raw.length,
    scored,
    failed,
    // new / changed / sold counts are part of the live TODO above.
  };
  console.log("[map/score-run]", run);
  return NextResponse.json({ ok: true, run });
}

// Vercel Cron invokes via GET; manual/admin triggers use POST. Both run the job.
export { handle as GET, handle as POST };
