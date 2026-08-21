// ============================================================
// Property Map — third-party data sources. Every function here is scaffolded
// with a clear TODO and returns mock data in the real shape, so the scoring job
// and the rest of the feature run today. Swap the bodies for live calls.
// ============================================================

import { SEED_LISTINGS } from "./seed";

/** A raw listing as the portal APIs return it (before BDR scoring). */
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
 * TODO: replace with live OneRoof + realestate.co.nz API calls
 *       (ONEROOF_API_KEY, REALESTATE_API_KEY). Merge + de-dupe by address.
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

/**
 * Median weekly rent for a suburb + bedroom count.
 * TODO: rental data source (Trade Me Rentals API, else MBIE rental-bond data).
 */
export async function fetchSuburbRent(suburb: string, bedrooms: number | null): Promise<number | null> {
  const match = SEED_LISTINGS.find((l) => l.suburb === suburb && l.bedrooms === bedrooms);
  return match?.estimatedWeeklyRent ?? SEED_LISTINGS.find((l) => l.suburb === suburb)?.estimatedWeeklyRent ?? null;
}

/**
 * Annual capital-growth rate for a suburb.
 * TODO: capital-growth source (CoreLogic / QV / Infometrics). Cache per suburb,
 *       refresh weekly; fall back to the regional average when suburb data is thin.
 */
export async function fetchSuburbGrowth(suburb: string): Promise<number | null> {
  return SEED_LISTINGS.find((l) => l.suburb === suburb)?.suburbGrowthRatePct ?? null;
}
