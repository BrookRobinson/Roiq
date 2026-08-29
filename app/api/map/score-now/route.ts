import { NextRequest, NextResponse } from "next/server";
import { resolveListing, resolveListingByAddress } from "@/lib/listing-resolver";
import { analyseProperty } from "@/lib/ai/analyze";
import { buildMapListing } from "@/lib/map/from-analysis";
import { addUserListing } from "@/lib/map/user-listings";
import { persistMapListing } from "@/lib/map/persist";
import { computeRepairAllowance } from "@/lib/map/repair-allowance";
import { valueProperty } from "@/lib/scoring/property-value";
import type { ReportContribution } from "@/lib/map/contribution";
import { whyIncomplete, INCOMPLETE_REASON } from "@/lib/map/report-completeness";

export const runtime = "nodejs";
export const maxDuration = 300; // Claude vision can take a while

/**
 * POST /api/map/score-now { url } | { address }
 *
 * Score ONE property onto the map from scratch (dev/admin): resolve → Claude
 * Vision analysis → 1000-pt score → repair allowance → Tectara valuation → live
 * rent → geocode → store.
 *
 * The normal way properties reach the map is /api/map/from-report, which reuses
 * an analysis a user already ran. This route exists for the case where no report
 * has been run yet, so it pays for the analysis itself.
 */
export async function POST(req: NextRequest) {
  let body: { url?: string; address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json", message: "Invalid JSON body." }, { status: 400 });
  }
  const { url, address } = body;
  if (!url && !address) {
    return NextResponse.json({ error: "missing_input", message: "Provide a listing url or address." }, { status: 400 });
  }

  try {
    const listing = url ? await resolveListing(url) : await resolveListingByAddress(address!);
    const result = await analyseProperty(listing);

    const contribution: ReportContribution = {
      reportId: "",
      listing,
      score: Math.round(result.scores.buyer.base),
      ...(() => {
        const r = computeRepairAllowance(result.subItems, {
          floorAreaSqm: listing.floorAreaSqm,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
        });
        return { repairAllowance: r.total, repairBreakdown: r.breakdown };
      })(),
      marketRent: result.marketRent,
      capitalGrowth: result.capitalGrowth,
      suburbValue: result.suburbValue,
      // The same valuation the report would show — one method, one number.
      roiqValuation:
        valueProperty({
          subItems: result.subItems,
          floorAreaSqm: listing.floorAreaSqm,
          bathrooms: listing.bathrooms,
          landAreaSqm: listing.landAreaSqm,
          extraDwellings: result.extraDwellings,
          suburbValue: result.suburbValue,
          titleType: listing.titleType,
          propertyType: listing.propertyType,
          landShareFraction: listing.landShareFraction,
        landCoOwners: listing.landCoOwners,
          crossLeaseSharing: result.context?.crossLeaseSharing,
        })?.total ?? null,
      completeness: {
        photosAnalysed: result.photosAnalysed ?? 0,
        assessedPoints: result.scores.buyer.assessedPoints,
        unassessedPoints: result.scores.buyer.unassessedPoints,
        score: Math.round(result.scores.buyer.base),
      },
    };

    const incomplete = whyIncomplete(contribution.completeness);
    if (incomplete) {
      return NextResponse.json({
        ok: false, added: false, reason: "incomplete_analysis", detail: INCOMPLETE_REASON[incomplete],
      });
    }

    const built = await buildMapListing(contribution, `manual-${Date.now()}`);
    const local = await addUserListing(built.listing);

    // Best-effort persist — the caller still gets the result, and the local copy
    // still serves the map, if the database is away.
    const db = await persistMapListing(built.listing, url ?? "");

    return NextResponse.json({
      ok: true,
      listing: built.listing,
      geocoded: built.geocoded,
      stored: local.stored,
      persisted: db.persisted,
      persistReason: db.reason ?? null,
      // Where each live figure came from, so the caller can cite it rather than
      // present a bond median and a fallback estimate as the same number.
      sources: built.sources,
    });
  } catch (err) {
    console.error("[map/score-now]", err);
    return NextResponse.json({ error: "score_failed", message: (err as Error).message }, { status: 500 });
  }
}
