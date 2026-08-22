import { NextRequest, NextResponse } from "next/server";
import { getRealListings } from "@/lib/map/store";
import { persistMapListing } from "@/lib/map/persist";
import { fetchSuburbRentDetail, fetchSuburbGrowth } from "@/lib/map/sources";
import { discoverListings } from "@/lib/map/discovery";
import { persistDiscoveredListings, geocodeMissingPins } from "@/lib/map/discovery-store";

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
 * 2. DISCOVERY (live) — reads OneRoof's published for-sale sitemap and records
 *    what exists: address, region, and the portal's own last-modified date.
 *    Nothing is analysed. Discovery costs a couple of dozen static file reads;
 *    an analysis costs about NZ$1.45, and roughly 260 listings appear daily —
 *    analysing them all would be ~$13,000 a month spent on properties nobody
 *    may ever open. Users analyse the pins they care about, from their own
 *    allowance.
 *
 *    OneRoof only. realestate.co.nz's robots.txt prohibits automated access and
 *    names this business model specifically; Trade Me blocks it outright. See
 *    lib/map/discovery.ts.
 */
async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized", message: "Invalid cron secret." }, { status: 401 });
  }

  let scored = 0;
  let failed = 0;
  let rentRefreshed = 0;
  let growthRefreshed = 0;

  // ── 2. Discovery ─────────────────────────────────────────────────────────
  // Only what the portal touched since yesterday — the whole index is ~30,000
  // listings and re-reading all of it nightly would be pointless traffic.
  const since = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  const found = await discoverListings({ since });
  const discovery = await persistDiscoveredListings(found.listings);

  // Sitemap URLs carry an address but no coordinates, and a pin without them
  // lands at 0,0 rather than on the map. Capped per night so a backlog drains
  // over several runs instead of eating a month of Mapbox allowance in one.
  const geo = await geocodeMissingPins();

  if (discovery.changed.length) {
    // A portal edit on a property we already hold means a cached report may now
    // describe a price or a set of photos that are gone. The reuse check
    // catches that on the next paste anyway — this is the early warning.
    console.warn(`[discovery] ${discovery.changed.length} indexed listing(s) changed on the portal`);
  }

  // ── 1. Refresh ───────────────────────────────────────────────────────────
  // Refresh the market figures on each listing before persisting. Rent is a free
  // MBIE lookup so it always runs; growth costs a web search, so it only runs when
  // the listing has none. Either failing leaves the existing figure alone.
  //
  // Sequential on purpose: tenancy.govt.nz is a public service we don't want to
  // fan 20 concurrent requests at, and going one at a time lets the per-suburb
  // cache actually hit when several listings share a suburb.
  const targets = await getRealListings();
  const listings: typeof targets = [];
  for (const l of targets) {
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

  let persistReason: string | null = null;
  for (const l of listings) {
    // Live: only NEW/CHANGED listings would run the full scoring pipeline here.
    // Seed listings are already scored, so persist their refreshed snapshot.
    const db = await persistMapListing(l, "");
    if (db.persisted) {
      scored++;
    } else {
      failed++;
      persistReason ??= db.detail ?? db.reason ?? null;
    }
  }
  if (persistReason) console.warn("[map/score-run] not persisted:", persistReason);

  const run = {
    at: new Date().toISOString(),
    discovery: {
      since,
      shardsRead: found.shardsRead,
      shardsFailed: found.shardsFailed,
      seen: found.listings.length,
      added: discovery.added,
      updated: discovery.updated,
      skippedAnalysed: discovery.skippedAnalysed,
      changedOnPortal: discovery.changed.length,
      failed: discovery.failed,
      reason: discovery.reason ?? null,
    },
    geocoding: geo,
    refreshing: targets.length,
    rentRefreshed,
    growthRefreshed,
    scored,
    failed,
    persistReason,
    // Nothing here analyses a listing — see the header comment for why.
  };
  console.log("[map/score-run]", run);
  return NextResponse.json({ ok: true, run });
}

// Vercel Cron invokes via GET; manual/admin triggers use POST. Both run the job.
export { handle as GET, handle as POST };
