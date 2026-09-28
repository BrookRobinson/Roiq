// ============================================================
// Property Map — server-side data access. Reads scored listings from Supabase
// `map_listings`; when that table is empty / unreadable (it currently is, until
// the 24h job runs against live portals) it falls back to the 20 seed listings,
// so the map always renders. Route handlers only.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import type { Database, MapListingRow } from "@/lib/supabase/types";
import { SEED_LISTINGS, seedById } from "./seed";
import { getUserListings, getUserListingById } from "./user-listings";
import { DEFAULT_VARIABLES, withDefaults, variablesFromColumns } from "./variables";
import { computeListing, valuationForScore } from "./calc";
import { isScorable } from "@/lib/scoring/investment";
import { readAllPages } from "@/lib/supabase/paged";
import type { MapListing, UserVariables } from "./types";
import type { PinFinance } from "./pin-finance";

type MapListingInsert = Database["public"]["Tables"]["map_listings"]["Insert"];

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export function parseBBox(s: string | null): BBox | null {
  if (!s) return null;
  const p = s.split(",").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return null;
  return { minLng: p[0], minLat: p[1], maxLng: p[2], maxLat: p[3] };
}

const inBBox = (l: MapListing, b: BBox): boolean =>
  l.lng >= b.minLng && l.lng <= b.maxLng && l.lat >= b.minLat && l.lat <= b.maxLat;

/** A stored finance record, or null if it isn't one this code understands. */
function readFinance(v: unknown): PinFinance | null {
  if (!v || typeof v !== "object") return null;
  const f = v as Partial<PinFinance>;
  return f.v === 1 && typeof f.price === "number" && Array.isArray(f.reno) ? (f as PinFinance) : null;
}

function rowToMapListing(r: MapListingRow): MapListing {
  const photos = Array.isArray(r.photos) ? (r.photos as string[]) : [];
  const score = isScorable(r.quick_quality_score) ? r.quick_quality_score : null;
  const breakdown =
    r.repair_breakdown && typeof r.repair_breakdown === "object" && !Array.isArray(r.repair_breakdown)
      ? (r.repair_breakdown as Record<string, number>)
      : {};
  return {
    // Prefer our stable pin key; `id` is a generated uuid the app never coins.
    id: r.source_key ?? r.id,
    address: r.address ?? "",
    suburb: r.suburb,
    city: r.city ?? null,
    region: r.region,
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
    askingPrice: r.asking_price ?? 0,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    propertyType: r.property_type,
    floorAreaSqm: r.floor_area_sqm,
    landAreaSqm: r.land_area_sqm,
    photos,
    listingType: (r.listing_type as MapListing["listingType"]) ?? null,
    roiqScore: score,
    // No score, no valuation — on the way OUT as well as in. See valuationForScore().
    roiqValuation: valuationForScore(r.roiq_valuation, r.asking_price, score),
    medianPerSqm: null,
    repairAllowance: r.repair_allowance ?? 0,
    repairBreakdown: breakdown,
    estimatedWeeklyRent: r.estimated_weekly_rent ?? 0,
    suburbGrowthRatePct: r.suburb_growth_rate_pct ?? 0,
    // Older report pins stored "report:<id>" here before the real URL was kept;
    // that's a reference, not somewhere to send anyone.
    listingUrl: r.listing_url && /^https?:\/\//i.test(r.listing_url) ? r.listing_url : null,
    fullReportId: r.full_report_ref ?? r.full_report_id,
    status:
      r.listing_status === "sold" || r.listing_status === "removed" ? r.listing_status : "active",
    // Only a real analysis ever writes a score, so its presence is the test.
    analysed: r.quick_quality_score != null,
    lastScoredAt: r.last_scored_at ?? null,
    finance: readFinance(r.finance),
  };
}

/**
 * Active listings, optionally within a viewport.
 *
 * Supabase first. Failing that, the pins users have contributed by running
 * reports — and the seed listings ONLY while there are none, so a brand new map
 * isn't empty. Once a real property is on there the demo data steps aside:
 * mixing invented listings in with real ones, on a product whose whole promise
 * is sourced numbers, would be the wrong trade.
 */

/**
 * The property types the map can filter on, in the order they're offered.
 *
 * `unknown` is a real option, not a gap to hide: most pins are discovered from
 * a sitemap that carries an address and nothing else, so "we don't know yet" is
 * the honest state for them and the reader is entitled to filter it in or out.
 */
export const MAP_PROPERTY_TYPES = [
  "house",
  "apartment",
  "townhouse",
  "unit",
  "section",
  "lifestyle",
  "rural",
  "unknown",
] as const;

export type MapPropertyType = (typeof MAP_PROPERTY_TYPES)[number];

export function parseTypes(param: string | null): MapPropertyType[] | null {
  if (!param) return null;
  const wanted = param
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t): t is MapPropertyType => (MAP_PROPERTY_TYPES as readonly string[]).includes(t));
  return wanted.length ? wanted : null;
}

export async function getActiveListings(
  bbox: BBox | null,
  types: MapPropertyType[] | null = null,
  /**
   * Only rows a report stands behind — the same test as `analysed` in
   * rowToMapListing. The Top list ranks these alone, and filtering in the query
   * reads a handful of rows instead of every pin in the country (~7s → well
   * under a second on a national view).
   */
  analysedOnly = false
): Promise<MapListing[]> {
  try {
    const supabase = createClient();
    const rows = await readAllPages(() => {
      // A listing with no coordinates is NOT a pin. Discovery records an address
      // from the sitemap and geocodes it later, and `rowToMapListing` defaults a
      // null to 0 — so an un-geocoded listing was being served as a point at
      // 0,0. With a handful in the queue that was an invisible nuisance; after
      // the national backfill it was 34,851 of them, which is one enormous
      // cluster in the Gulf of Guinea and every count on the map wrong. They
      // reappear on their own once the nightly geocoder reaches them.
      let q = supabase
        .from("map_listings")
        .select("*")
        .eq("listing_status", "active")
        .not("lat", "is", null)
        .not("lng", "is", null);
      if (analysedOnly) q = q.not("quick_quality_score", "is", null);
      if (bbox) {
        q = q.gte("lat", bbox.minLat).lte("lat", bbox.maxLat).gte("lng", bbox.minLng).lte("lng", bbox.maxLng);
      }
      if (types?.length) {
        // "unknown" is a null column, which `in` can't express — so asking for
        // it is an OR against null rather than a value match.
        const named = types.filter((t) => t !== "unknown");
        const wantsUnknown = types.includes("unknown");
        if (wantsUnknown && named.length) {
          q = q.or(`property_type.is.null,property_type.in.(${named.join(",")})`);
        } else if (wantsUnknown) {
          q = q.is("property_type", null);
        } else {
          q = q.in("property_type", named);
        }
      }
      return q;
    });
    if (rows.length > 0) return rows.map(rowToMapListing);
    // Nothing matched. That is only "the map is empty" if the TABLE is — a
    // filter that matches nothing (no analysed sections, an empty stretch of
    // sea) is an answer, and falling back from it served the local pins with
    // the filter ignored: a unit and a house topped a Section-only list.
    const { data: any } = await supabase.from("map_listings").select("id").limit(1);
    if (any && any.length > 0) return [];
  } catch {
    /* DB unavailable — fall through to the local pins */
  }

  const contributed = (await getUserListings()).filter((l) => l.status === "active");
  const pool = contributed.length > 0 ? contributed : SEED_LISTINGS.filter((l) => l.status === "active");
  // The same filters as the query, or the fallback answers a different question.
  return pool.filter(
    (l) =>
      (!bbox || inBBox(l, bbox)) &&
      (!analysedOnly || l.analysed) &&
      (!types?.length || types.includes((l.propertyType ?? "unknown") as MapPropertyType))
  );
}

/**
 * Pins that stand for REAL properties: whatever is in the database, else the ones
 * contributed locally. Never the seed set.
 *
 * The daily job uses this rather than `getActiveListings`, which falls back to
 * seed listings so the map isn't empty. That fallback is a display decision —
 * writing invented properties into the database would make them indistinguishable
 * from real ones on the next read.
 */
export async function getRealListings(): Promise<MapListing[]> {
  try {
    const supabase = createClient();
    const rows = await readAllPages(() =>
      supabase.from("map_listings").select("*").eq("listing_status", "active")
    );
    if (rows.length > 0) return rows.map(rowToMapListing);
  } catch {
    /* DB unavailable — fall through to the local pins */
  }
  return (await getUserListings()).filter((l) => l.status === "active");
}

/** True while the map is still showing demo data rather than real reports. */
export async function isShowingSeedData(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("map_listings").select("id").limit(1);
    if (!error && data && data.length > 0) return false;
  } catch {
    /* fall through */
  }
  return (await getUserListings()).filter((l) => l.status === "active").length === 0;
}

export async function getListingById(id: string): Promise<MapListing | null> {
  try {
    const supabase = createClient();
    // Pins are addressed by source_key — `id` is a uuid the app never sees.
    const { data, error } = await supabase.from("map_listings").select("*").eq("source_key", id).maybeSingle();
    if (!error && data) return rowToMapListing(data);
  } catch {
    /* fall through */
  }
  return (await getUserListingById(id)) ?? seedById(id) ?? null;
}

/**
 * Which variables to score against. The endpoint recomputes deal colours per the
 * requesting user's saved variables (spec): the client passes them as a `vars`
 * query param (they live in localStorage while auth is bypassed); a real signed-in
 * user's row is used otherwise; else the defaults.
 */
export async function resolveVariables(req: Request): Promise<UserVariables> {
  const raw = new URL(req.url).searchParams.get("vars");
  if (raw) {
    try {
      return withDefaults(JSON.parse(raw) as Partial<UserVariables>);
    } catch {
      /* bad param — ignore */
    }
  }
  try {
    const { profile } = await getUser();
    if (profile) return variablesFromColumns(profile);
  } catch {
    /* not signed in */
  }
  return DEFAULT_VARIABLES;
}

/** A scored MapListing → the Supabase `map_listings` insert row. Colours + projections
 *  are stored as a default-variables snapshot; the read endpoints recompute per user. */
export function mapListingInsert(l: MapListing, sourceUrl = ""): MapListingInsert {
  const hb = computeListing(l, DEFAULT_VARIABLES, "homebuyer");
  const now = new Date().toISOString();
  return {
    listing_url: sourceUrl,
    address: l.address,
    suburb: l.suburb,
    region: l.region,
    city: l.city,
    lat: l.lat,
    lng: l.lng,
    asking_price: l.askingPrice,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    property_type: l.propertyType,
    title_type: null,
    build_year: null,
    floor_area_sqm: l.floorAreaSqm,
    land_area_sqm: l.landAreaSqm,
    photos: l.photos,
    description: null,
    listing_type: l.listingType,
    quick_quality_score: l.roiqScore,
    vfm_grade: null,
    gross_yield_est:
      l.askingPrice > 0 ? Math.round(((l.estimatedWeeklyRent * 52) / l.askingPrice) * 1000) / 10 : null,
    profit_10yr_est: null, // reader-specific — see the investor columns below
    opportunity_grade: null,
    roiq_valuation: l.roiqValuation,
    valuation_vs_asking_pct:
      hb.valuationGapPct == null ? null : Math.round(hb.valuationGapPct * 10) / 10,
    repair_allowance: l.repairAllowance,
    repair_breakdown: l.repairBreakdown,
    estimated_weekly_rent: l.estimatedWeeklyRent,
    suburb_growth_rate_pct: l.suburbGrowthRatePct,
    // Investor returns depend on the READER's deposit, rate and hold, so none is
    // stored: a figure worked out on default numbers is a return nobody chose.
    // The map computes it per reader from `finance`. Nothing reads these.
    projected_cashflow: null,
    projected_capital_gain: null,
    projected_net_profit: null,
    five_year_return_pct: null,
    home_buyer_colour: hb.colour,
    investor_colour: null,
    finance: (l.finance ?? null) as never,
    // Our stable pin id — the upsert key, so a property keeps one row.
    source_key: l.id,
    // full_report_id is a FK to public.reports, which nothing writes to, so
    // setting it would fail the insert. The plain-text ref carries it instead.
    full_report_id: null,
    full_report_ref: l.fullReportId,
    listing_status: l.status,
    first_seen: now,
    last_seen: now,
    source_portal: sourceUrl ? "manual" : "seed",
    last_scored_at: now,
    last_checked_at: now,
  };
}

export { SEED_LISTINGS };
