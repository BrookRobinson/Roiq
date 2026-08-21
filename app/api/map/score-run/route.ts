import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SEED_LISTINGS, mapListingInsert } from "@/lib/map/store";
import { fetchActiveListings, fetchSuburbRentDetail, fetchSuburbGrowth } from "@/lib/map/sources";

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
 * POST /api/map/score-run — the every-24-hours job (wired to a Vercel Cron in
 * vercel.json). It does two things:
 *
 * 1. REFRESH (live today) — re-reads each listing's weekly rent from MBIE's
 *    lodged-bond data, and fills in any missing capital-growth rate. Both are
 *    real feeds, so the map's investor maths stays current without re-running
 *    the AI analysis (the 1000-pt score is a property fact, not a market one).
 * 2. INTAKE (still mock) — fetchActiveListings() has no live portal feed behind
 *    it yet, so there are no new listings to diff and score. Once a feed lands,
 *    diff against map_listings for NEW / PRICE-CHANGED, run those through the
 *    score-now pipeline, and mark the ones that disappeared as sold.
 */
async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized", message: "Invalid cron secret." }, { status: 401 });
  }

  const raw = await fetchActiveListings(); // mock until a listings feed exists
  let scored = 0;
  let failed = 0;
  let rentRefreshed = 0;
  let growthRefreshed = 0;

  // Refresh the market figures on each listing before persisting. Rent is a free
  // MBIE lookup so it always runs; growth costs a web search, so it only runs when
  // the listing has none. Either failing leaves the existing figure alone.
  //
  // Sequential on purpose: tenancy.govt.nz is a public service we don't want to
  // fan 20 concurrent requests at, and going one at a time lets the per-suburb
  // cache actually hit when several listings share a suburb.
  const listings: typeof SEED_LISTINGS = [];
  for (const l of SEED_LISTINGS) {
    if (!l.suburb) {
      listings.push(l);
      continue;
    }

    const rent = await fetchSuburbRentDetail(l.suburb, l.bedrooms, {
      city: l.city,
      propertyType: l.propertyType,
    });
    if (rent) rentRefreshed++;

    let growth = l.suburbGrowthRatePct;
    if (!growth) {
      const live = await fetchSuburbGrowth(l.suburb, { city: l.city, region: l.region });
      if (live) {
        growth = live;
        growthRefreshed++;
      }
    }

    listings.push({ ...l, estimatedWeeklyRent: rent?.weekly ?? l.estimatedWeeklyRent, suburbGrowthRatePct: growth });
  }

  try {
    const supabase = createClient();
    for (const l of listings) {
      // Live: only NEW/CHANGED listings would run the full scoring pipeline here.
      // Seed listings are already scored, so persist their refreshed snapshot.
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
    rentRefreshed,
    growthRefreshed,
    scored,
    failed,
    // new / changed / sold counts arrive with the listings feed.
  };
  console.log("[map/score-run]", run);
  return NextResponse.json({ ok: true, run });
}

// Vercel Cron invokes via GET; manual/admin triggers use POST. Both run the job.
export { handle as GET, handle as POST };
