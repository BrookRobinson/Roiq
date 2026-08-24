import { NextRequest, NextResponse } from "next/server";
import { getRealListings } from "@/lib/map/store";
import { persistMapListing } from "@/lib/map/persist";
import { fetchSuburbRentDetail, fetchSuburbGrowth } from "@/lib/map/sources";
import { discoverListings } from "@/lib/map/discovery";
import { persistDiscoveredListings, geocodeMissingPins } from "@/lib/map/discovery-store";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Only Vercel Cron may run this.
 *
 * The job crawls a portal, geocodes hundreds of addresses and hits a public
 * bond-data service. Left open, anyone who found the URL could run it on a
 * loop — burning the Mapbox and LINZ allowances and pointing our traffic at
 * OneRoof, under our name.
 *
 * Missing secret is refused in production rather than waved through. Open by
 * default is the wrong way round for a job with side effects: the failure is
 * silent, and the only sign is a bill or a blocked crawler. Local development
 * stays open so the job can be run by hand.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
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
    return NextResponse.json(
      {
        error: "unauthorized",
        message: process.env.CRON_SECRET
          ? "Invalid cron secret."
          : "CRON_SECRET isn't set. Add it to the Vercel project's environment variables — Vercel Cron sends it automatically as a bearer token.",
      },
      { status: 401 }
    );
  }

  let scored = 0;
  let failed = 0;
  let rentRefreshed = 0;
  let growthRefreshed = 0;

  // ── 2. Discovery ─────────────────────────────────────────────────────────
  // Nightly: only what the portal touched since yesterday — re-reading the whole
  // index every night would be pointless traffic.
  //
  // BUT incremental alone never fills the map. The `since` filter means a
  // listing that was already for sale before we started, and hasn't been edited
  // since, is never seen — so after two nights the map held 1,918 of roughly
  // 30,000 listings, and Hokitika showed 4 of its 46. `?full=1` drops the filter
  // and reads every URL in every shard, which is what a first run (or a rebuild)
  // actually needs. `?regions=west-coast` narrows it to matching shard names so
  // a backfill can be done a region at a time inside the route's time ceiling.
  const url = new URL(req.url);
  const full = url.searchParams.get("full") === "1";
  const regionsParam = url.searchParams.get("regions");
  const regions = regionsParam ? regionsParam.split(",").map((r) => r.trim()).filter(Boolean) : null;

  const since = full ? null : new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  const found = await discoverListings({ since, regions });
  const discovery = await persistDiscoveredListings(found.listings);

  // Sitemap URLs carry an address but no coordinates, and a pin without them
  // lands at 0,0 rather than on the map. Capped per run so a backlog drains
  // over several nights instead of eating a month of allowance in one — a
  // backfill can raise both caps, since it is a deliberate one-off rather than
  // something running unattended every night.
  const geo = await geocodeMissingPins({
    limit: Number(url.searchParams.get("geocodeLimit")) || undefined,
    timeBudgetMs: Number(url.searchParams.get("geocodeMs")) || undefined,
    // Raised only for a deliberate, attended backfill. The nightly default stays
    // at 4: LINZ is a public service and a job running unattended every night
    // should not lean on it. A miss there falls through to Mapbox, so a single
    // address can cost two round trips — which is why the nightly run drains
    // roughly 80 an hour and a 30,000-listing backfill needs its own pass.
    concurrency: Number(url.searchParams.get("geocodeConcurrency")) || undefined,
  });

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
  // Only the analysed pins. A discovered listing has no rent, no growth rate
  // and no score, so there is nothing on it to refresh — and now that the map
  // holds the national index rather than a handful of reports, walking all of
  // them would spend the whole run doing lookups against empty rows and blow
  // the route's budget before reaching the ones that matter.
  const targets = (await getRealListings()).filter((l) => l.analysed);
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
