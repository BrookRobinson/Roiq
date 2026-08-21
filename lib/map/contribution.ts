// ============================================================
// Property Map — how a finished report becomes a map pin.
//
// The map has no listings feed (no NZ portal publishes an API), so it fills up
// from properties users actually run through BDR Report. This is the payload
// that carries a completed report to /api/map/from-report: just the fields the
// map needs, rather than the whole StoredReport, which is mostly per-item prose
// the map never reads.
//
// Client + server safe — types and pure functions only.
// ============================================================

import type { StoredReport } from "@/lib/report-store";
import type { ScrapedListing } from "@/lib/scraper/types";
import type { MarketRent, CapitalGrowth, SuburbValue } from "@/lib/scoring/investment";
import { computeRepairAllowance } from "./repair-allowance";

export interface ReportContribution {
  /** The report this came from, so the pin can link back to it. */
  reportId: string;
  listing: ScrapedListing;
  /** Buyer base score, 0–1000. */
  score: number;
  /** Cost of the work the report pre-ticks, at Replace-Budget / tradie. */
  repairAllowance: number;
  repairBreakdown: Record<string, number>;
  marketRent?: MarketRent;
  capitalGrowth?: CapitalGrowth;
  suburbValue?: SuburbValue;
}

/**
 * Whether a report should go on the shared map.
 *
 * Only properties that are PUBLICLY FOR SALE belong there. A property the
 * pipeline resolved to a live listing is already public — its address, price and
 * photos are on the open web. A manual photo upload is not: it may well be the
 * user's own house, or one they walked through, and publishing that would be a
 * privacy breach dressed up as a feature.
 *
 * So the test is that the analysis actually FOUND the property listed for sale
 * (`scrapedOk`, set by both the direct scrape and the address search) with a
 * price and an address to place it by — and that its photos came off the web
 * rather than out of the user's camera roll, which is what tells an upload apart
 * from a listing the upload flow marks `scrapedOk` too.
 */
export function isPublicListing(listing: ScrapedListing): boolean {
  if (!listing?.scrapedOk) return false;
  if (!listing.address?.trim()) return false;
  if (!(typeof listing.askingPrice === "number" && listing.askingPrice > 0)) return false;

  const photos = listing.photoUrls ?? [];
  const uploaded = photos.some((u) => typeof u === "string" && u.startsWith("data:"));
  return !uploaded;
}

/** Pull the map-relevant slice out of a finished report. */
export function contributionFrom(report: StoredReport): ReportContribution {
  return {
    reportId: report.id,
    listing: report.listing,
    score: Math.round(report.scores.buyer.base),
    ...(() => {
      const r = computeRepairAllowance(report.subItems ?? [], {
        floorAreaSqm: report.listing.floorAreaSqm,
        bedrooms: report.listing.bedrooms,
        bathrooms: report.listing.bathrooms,
      });
      return { repairAllowance: r.total, repairBreakdown: r.breakdown };
    })(),
    marketRent: report.marketRent,
    capitalGrowth: report.capitalGrowth,
    suburbValue: report.suburbValue,
  };
}

/**
 * Send a finished report to the map. Fire-and-forget on purpose: the user is
 * being navigated to their report, and a map contribution failing must never
 * block or interrupt that.
 */
export function contributeToMap(report: StoredReport): void {
  if (!isPublicListing(report.listing)) return;
  try {
    void fetch("/api/map/from-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contributionFrom(report)),
      keepalive: true, // survives the navigation to /report/[id]
    }).catch(() => {
      /* the report is what matters; the pin is a bonus */
    });
  } catch {
    /* non-fatal */
  }
}
