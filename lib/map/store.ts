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
import { computeListing } from "./calc";
import type { MapListing, UserVariables } from "./types";

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

function rowToMapListing(r: MapListingRow): MapListing {
  const photos = Array.isArray(r.photos) ? (r.photos as string[]) : [];
  const breakdown =
    r.repair_breakdown && typeof r.repair_breakdown === "object" && !Array.isArray(r.repair_breakdown)
      ? (r.repair_breakdown as Record<string, number>)
      : {};
  return {
    id: r.id,
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
    roiqScore: r.quick_quality_score ?? 0,
    roiqValuation: r.roiq_valuation ?? 0,
    medianPerSqm: null,
    repairAllowance: r.repair_allowance ?? 0,
    repairBreakdown: breakdown,
    estimatedWeeklyRent: r.estimated_weekly_rent ?? 0,
    suburbGrowthRatePct: r.suburb_growth_rate_pct ?? 0,
    fullReportId: r.full_report_id,
    status: r.listing_status === "sold" ? "sold" : "active",
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
export async function getActiveListings(bbox: BBox | null): Promise<MapListing[]> {
  try {
    const supabase = createClient();
    let q = supabase.from("map_listings").select("*").eq("listing_status", "active");
    if (bbox) {
      q = q.gte("lat", bbox.minLat).lte("lat", bbox.maxLat).gte("lng", bbox.minLng).lte("lng", bbox.maxLng);
    }
    const { data, error } = await q.limit(2000);
    if (!error && data && data.length > 0) return data.map(rowToMapListing);
  } catch {
    /* DB unavailable — fall through to the local pins */
  }

  const contributed = (await getUserListings()).filter((l) => l.status === "active");
  const pool = contributed.length > 0 ? contributed : SEED_LISTINGS.filter((l) => l.status === "active");
  return bbox ? pool.filter((l) => inBBox(l, bbox)) : pool;
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
    const { data, error } = await supabase.from("map_listings").select("*").eq("id", id).single();
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
  const inv = computeListing(l, DEFAULT_VARIABLES, "investor");
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
    profit_10yr_est: inv.netProfit,
    opportunity_grade: null,
    roiq_valuation: l.roiqValuation,
    valuation_vs_asking_pct: Math.round(hb.valuationGapPct * 10) / 10,
    repair_allowance: l.repairAllowance,
    repair_breakdown: l.repairBreakdown,
    estimated_weekly_rent: l.estimatedWeeklyRent,
    suburb_growth_rate_pct: l.suburbGrowthRatePct,
    projected_cashflow: inv.annualCashflow,
    projected_capital_gain: inv.capitalGain,
    projected_net_profit: inv.netProfit,
    five_year_return_pct: Math.round(inv.returnOnDepositPct * 10) / 10,
    home_buyer_colour: hb.colour,
    investor_colour: inv.colour,
    full_report_id: l.fullReportId,
    listing_status: l.status,
    first_seen: now,
    last_seen: now,
    source_portal: sourceUrl ? "manual" : "seed",
    last_scored_at: now,
    last_checked_at: now,
  };
}

export { SEED_LISTINGS };
