import { NextRequest, NextResponse } from "next/server";
import { getActiveListings, isShowingSeedData, parseBBox, parseTypes, resolveVariables } from "@/lib/map/store";
import { SEED_LISTINGS } from "@/lib/map/seed";
import { computeListing, investorReady } from "@/lib/map/calc";
import { hasFeature } from "@/lib/supabase/auth";
import { PACKAGE_LABEL, packageFor, priceFor } from "@/lib/billing/plans";
import type { MapListing, MapMode } from "@/lib/map/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How many make the list. Ten reads as a shortlist; more is just the map again. */
const TOP_N = 10;

/**
 * GET /api/map/top?mode=homebuyer|investor&vars=<json>&bounds=…&types=…&demo=1
 *
 * The best analysed properties for THIS reader, ranked by the same figure that
 * colours their pin — computeListing() against their own variables:
 *   homebuyer → how far our valuation sits above the asking price
 *   investor  → projected net profit over their hold, as % of the cash put in
 *
 * Unlike /api/map/listings this names addresses and prices, which is exactly
 * what the map tier sells — blurred pins on the client don't protect it, so the
 * gate is here. The demo map (demo=1) serves only seed listings and stays open.
 *
 * Only pins with a verdict are ranked: an unanalysed or unvalued property has
 * no number to rank by, and putting one in a "top 10" would be inventing it.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const demo = url.searchParams.get("demo") === "1";

  if (!demo && !(await hasFeature("map").catch(() => false))) {
    const needs = packageFor("map");
    return NextResponse.json(
      {
        ok: false,
        error: "upgrade_required",
        needs,
        message: `${PACKAGE_LABEL[needs]} — $${priceFor(needs).toLocaleString("en-NZ")} — ranks the whole map for you.`,
      },
      { status: 402 }
    );
  }

  const mode: MapMode = url.searchParams.get("mode") === "investor" ? "investor" : "homebuyer";
  const bbox = parseBBox(url.searchParams.get("bounds"));
  const vars = await resolveVariables(req);
  if (mode === "investor" && !demo && !investorReady(vars)) {
    return NextResponse.json(
      { ok: false, error: "numbers_required", message: "Add your numbers in Variables to rank by investor return." },
      { status: 422 }
    );
  }
  // The map sends its filter; without one, the reader's saved types still apply.
  const types = parseTypes(url.searchParams.get("types")) ?? parseTypes(vars.propertyTypes?.join(",") || null);

  const inBox = (l: MapListing) =>
    !bbox || (l.lat >= bbox.minLat && l.lat <= bbox.maxLat && l.lng >= bbox.minLng && l.lng <= bbox.maxLng);
  const all = demo
    ? SEED_LISTINGS.filter(
        (l) => l.status === "active" && inBox(l) && (!types || types.includes((l.propertyType ?? "unknown") as never))
      )
    : await getActiveListings(bbox, types, true);

  // One house, one entry. A property analysed twice can carry two pins (an
  // older report beside a newer one, with different valuations), and listing
  // both reads as two houses. The newest report is the current read — keeping
  // the higher-ranked one instead would pick whichever flatters it.
  const newest = new Map<string, MapListing>();
  for (const l of all) {
    if (!l.analysed) continue;
    const key = `${l.address.trim().toLowerCase()}|${l.lat.toFixed(5)},${l.lng.toFixed(5)}`;
    const had = newest.get(key);
    if (!had || (l.lastScoredAt ?? "") > (had.lastScoredAt ?? "")) newest.set(key, l);
  }

  const ranked = [...newest.values()]
    .filter((l) => vars.budget <= 0 || l.askingPrice <= vars.budget)
    .map((l) => ({ l, c: computeListing(l, vars, mode) }))
    .filter((x): x is typeof x & { c: { pct: number } } => x.c.pct != null && Number.isFinite(x.c.pct))
    .sort((a, b) => b.c.pct - a.c.pct);

  const top = ranked.slice(0, TOP_N).map(({ l, c }) => ({
    id: l.id,
    lat: l.lat,
    lng: l.lng,
    address: l.address,
    suburb: l.suburb,
    city: l.city,
    askingPrice: l.askingPrice,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    propertyType: l.propertyType,
    photo: l.photos[0] ?? null,
    colour: c.colour,
    pct: Math.round(c.pct),
    valuation: c.roiqValuation,
    netProfit: c.netProfit,
    annualCashflow: c.annualCashflow,
    weeklyRent: c.weeklyRent,
  }));

  const seeded = demo ? true : await isShowingSeedData();
  return NextResponse.json({ ok: true, mode, holdYears: vars.holdPeriodYears, ranked: ranked.length, seeded, top });
}
