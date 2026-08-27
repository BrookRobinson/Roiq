// ============================================================
// Property Map — build a scored map pin from a completed analysis.
//
// SERVER ONLY. Shared by the two ways a property reaches the map:
//   • /api/map/from-report — a report a user just ran (the main source)
//   • /api/map/score-now   — an admin scoring one property on demand
// Both arrive with an analysis already done, so this never re-runs the AI; it
// costs the market figures and geocode.
// ============================================================

import { isScorable } from "@/lib/scoring/investment";
import { geocodeAddress } from "./geocode";
import { fetchSuburbRentDetail, fetchSuburbGrowth } from "./sources";
import type { ReportContribution } from "./contribution";
import type { SuburbRent } from "./market-rent";
import type { MapListing } from "./types";

export interface BuiltListing {
  listing: MapListing;
  geocoded: boolean;
  /** Where each live figure came from, so callers can cite rather than assert. */
  sources: {
    rent: { live: boolean; source: string; activeBonds?: number; exactMatch?: boolean };
    growth: string | null;
  };
}

/**
 * Turn a finished analysis into a map pin, filling in the market figures the
 * report itself doesn't carry. `id` is the caller's — reports use their report
 * id so re-running the same property replaces its pin instead of stacking up.
 */
export async function buildMapListing(c: ReportContribution, id: string): Promise<BuiltListing> {
  const { listing } = c;
  const address = listing.address ?? "";
  const suburb = listing.suburb ?? "";
  const asking = listing.askingPrice ?? 0;

  // Rent: MBIE's lodged-bond median for this exact suburb/size/type beats the
  // analysis's web-searched figure — same dataset, matched precisely, with a
  // sample size behind it. Falls back to the analysis where MBIE is thin.
  let bondRent: SuburbRent | null = null;
  if (suburb) {
    bondRent = await fetchSuburbRentDetail(suburb, listing.bedrooms, {
      city: listing.city,
      propertyType: listing.propertyType,
    });
  }
  const estimatedWeeklyRent = Math.round(bondRent?.weekly ?? c.marketRent?.weekly ?? 0);

  // Growth: the analysis already researched it; only go looking when it didn't.
  const suburbGrowthRatePct =
    c.capitalGrowth?.annualRatePct ??
    (suburb ? await fetchSuburbGrowth(suburb, { city: listing.city, region: listing.region }) : null) ??
    0;

  const medianPerSqm = c.suburbValue?.medianPerSqm ?? null;
  const floor = listing.floorAreaSqm ?? 0;
  const geo = await geocodeAddress(address);

  return {
    listing: {
      id,
      address,
      suburb: listing.suburb,
      city: listing.city,
      region: listing.region,
      lat: geo?.lat ?? 0,
      lng: geo?.lng ?? 0,
      askingPrice: asking,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      propertyType: listing.propertyType,
      floorAreaSqm: listing.floorAreaSqm,
      landAreaSqm: listing.landAreaSqm,
      // Only http(s) photos — a base64 upload would bloat every map response.
      photos: (listing.photoUrls ?? []).filter((u) => typeof u === "string" && u.startsWith("http")).slice(0, 6),
      listingType: null,
      // Null when nothing could be assessed — see isScorable(). Publishing a
      // "0/1000" against a real address claims the property is the worst in the
      // country, when what happened is that we couldn't see enough of it.
      roiqScore: isScorable(c.score) ? c.score : null,
      // THE report's valuation, carried, never recomputed. The map used to
      // work out its own here — suburb $/m² × condition × floor area, with no
      // land in it — which gave a different answer for the same house. Null
      // when the report couldn't value it: the pin then shows a score and no
      // price, which is the truth.
      roiqValuation: c.roiqValuation ?? null,
      medianPerSqm,
      repairAllowance: c.repairAllowance ?? 0,
      repairBreakdown: c.repairBreakdown ?? {},
      estimatedWeeklyRent,
      suburbGrowthRatePct,
      fullReportId: c.reportId || null,
      status: "active",
    listingUrl: listing.url ?? null,
    // This one came from a real report, by definition.
    analysed: true,
    },
    geocoded: !!geo,
    sources: {
      rent: bondRent
        ? { live: true, source: bondRent.source, activeBonds: bondRent.activeBonds, exactMatch: bondRent.exactMatch }
        : { live: false, source: c.marketRent?.source ?? "estimate" },
      growth: c.capitalGrowth?.source ?? null,
    },
  };
}
