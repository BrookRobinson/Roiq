// ============================================================
// Property Map — third-party data sources.
//
// SERVER ONLY. Rent and capital growth are now LIVE:
//   • rent   → MBIE / Tenancy Services bond data (official, free, no key)
//   • growth → the report pipeline's own web-search research (lib/ai/market.ts)
// Both cache per suburb and fall back to the seed figures rather than failing a
// scoring run, so a flat source degrades the map instead of emptying it.
//
// Listings are the one source still on mock data — see fetchActiveListings().
// ============================================================

import { SEED_LISTINGS } from "./seed";
import { fetchMarketRent, type SuburbRent } from "./market-rent";
import { fetchMarketData } from "@/lib/ai/market";
import { emptyListing } from "@/lib/scraper/types";

/** A raw listing as the portal APIs return it (before Tectara scoring). */
export interface RawListing {
  listingId: string;
  source: "oneroof" | "realestate";
  address: string;
  suburb: string;
  city: string;
  region: string;
  lat: number;
  lng: number;
  askingPrice: number;
  listingType: "sale" | "auction" | "tender";
  bedrooms: number;
  bathrooms: number;
  landArea: number | null;
  floorArea: number | null;
  photos: string[];
  description: string;
  listedAt: string;
  status: "active" | "sold";
}

/**
 * Fetch every active listing for sale nationwide.
 *
 * STILL MOCK — and unlike rent and growth, this one cannot be fixed by pointing
 * at a better URL. There is no free or licensed listings feed wired up:
 * OneRoof and realestate.co.nz publish no public API, both sit behind bot
 * protection, and SCRAPER_API_KEY is empty. Until a feed exists the map is
 * populated by properties users actually run through /api/map/score-now, which
 * is the intended long-run source anyway.
 *
 * TODO: swap for a licensed feed (the Cotality/CoreLogic enquiry) when it lands.
 *       Merge + de-dupe by address, then diff against map_listings.
 */
export async function fetchActiveListings(): Promise<RawListing[]> {
  // Mock: derive the raw shape from the seed listings.
  return SEED_LISTINGS.map((l, i) => ({
    listingId: l.id,
    source: i % 2 === 0 ? "oneroof" : "realestate",
    address: l.address,
    suburb: l.suburb ?? "",
    city: l.city ?? "",
    region: l.region ?? "",
    lat: l.lat,
    lng: l.lng,
    askingPrice: l.askingPrice,
    listingType: (l.listingType === "auction" ? "auction" : l.listingType === "tender" ? "tender" : "sale"),
    bedrooms: l.bedrooms ?? 0,
    bathrooms: l.bathrooms ?? 0,
    landArea: l.landAreaSqm,
    floorArea: l.floorAreaSqm,
    photos: l.photos,
    description: "",
    listedAt: "2026-06-01T00:00:00Z",
    status: l.status,
  }));
}

// ── Rent ────────────────────────────────────────────────────────────────────

const seedRent = (suburb: string, bedrooms: number | null): number | null =>
  SEED_LISTINGS.find((l) => l.suburb === suburb && l.bedrooms === bedrooms)?.estimatedWeeklyRent ??
  SEED_LISTINGS.find((l) => l.suburb === suburb)?.estimatedWeeklyRent ??
  null;

/**
 * Median weekly rent for a suburb + bedroom count, from MBIE's lodged-bond data.
 * Returns the full record (quartiles, sample size, period, citation) so callers
 * can show how solid the figure is; `fetchSuburbRent` below is the plain-number
 * version for the scoring maths.
 */
export async function fetchSuburbRentDetail(
  suburb: string,
  bedrooms: number | null,
  opts: { city?: string | null; propertyType?: string | null } = {}
): Promise<SuburbRent | null> {
  if (!suburb?.trim()) return null;
  try {
    return await fetchMarketRent(suburb, {
      city: opts.city,
      bedrooms,
      propertyType: opts.propertyType,
    });
  } catch (err) {
    console.error("[map/sources] rent lookup failed", suburb, err);
    return null;
  }
}

/** Median weekly rent, live where MBIE has the suburb, else the seed figure. */
export async function fetchSuburbRent(
  suburb: string,
  bedrooms: number | null,
  opts: { city?: string | null; propertyType?: string | null } = {}
): Promise<number | null> {
  const live = await fetchSuburbRentDetail(suburb, bedrooms, opts);
  return live?.weekly ?? seedRent(suburb, bedrooms);
}

// ── Capital growth ──────────────────────────────────────────────────────────

/**
 * Annual capital-growth rate for a suburb.
 *
 * There is no free NZ capital-growth feed — QV, REINZ and CoreLogic all sit
 * behind licences — so this reuses the research the report pipeline already
 * does (`lib/ai/market.ts`: web search over QV HPI / OneRoof / REINZ, source
 * cited, never invented). Cached for a week: a long-run growth rate does not
 * move day to day, and each miss costs a web search.
 */
const GROWTH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const growthCache = new Map<string, { at: number; value: number | null }>();

export async function fetchSuburbGrowth(
  suburb: string,
  opts: { city?: string | null; region?: string | null } = {}
): Promise<number | null> {
  const seed = SEED_LISTINGS.find((l) => l.suburb === suburb)?.suburbGrowthRatePct ?? null;
  if (!suburb?.trim()) return seed;

  const key = suburb.trim().toLowerCase();
  const hit = growthCache.get(key);
  if (hit && Date.now() - hit.at < GROWTH_TTL_MS) return hit.value ?? seed;

  let value: number | null = null;
  try {
    const listing = emptyListing("", "unknown");
    listing.suburb = suburb;
    listing.city = opts.city ?? null;
    listing.region = opts.region ?? null;
    const market = await fetchMarketData(listing);
    const rate = market.capitalGrowth?.annualRatePct;
    if (Number.isFinite(rate) && (rate as number) > 0) value = rate as number;
  } catch (err) {
    console.error("[map/sources] growth lookup failed", suburb, err);
  }

  growthCache.set(key, { at: Date.now(), value });
  return value ?? seed;
}
