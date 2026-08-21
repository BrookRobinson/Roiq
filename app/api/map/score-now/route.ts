import { NextRequest, NextResponse } from "next/server";
import { resolveListing, resolveListingByAddress } from "@/lib/listing-resolver";
import { analyseProperty } from "@/lib/ai/analyze";
import { costThreeTier } from "@/lib/reno-costing/three-tier";
import { roiqFairValue } from "@/lib/scoring/investment";
import { geocodeAddress } from "@/lib/map/geocode";
import { createClient } from "@/lib/supabase/server";
import { mapListingInsert } from "@/lib/map/store";
import type { MapListing } from "@/lib/map/types";

export const runtime = "nodejs";
export const maxDuration = 300; // Claude vision can take a while

/**
 * POST /api/map/score-now { url } | { address }
 * Manually score ONE property through the real BDR Report pipeline (dev/admin): resolve →
 * Claude Vision analysis → 1000-pt score → summed repair allowance → BDR valuation →
 * geocode → upsert into map_listings. Returns the scored listing.
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

    const score = Math.round(result.scores.buyer.base);

    // Repair allowance = sum of detected replacement costs (Replace-Budget / tradie).
    let repairAllowance = 0;
    const repairBreakdown: Record<string, number> = {};
    for (const s of result.subItems) {
      if (!s.estimatedReplacementCost) continue;
      const t = costThreeTier({
        id: s.id,
        name: s.name,
        floorSqm: listing.floorAreaSqm,
        bedrooms: listing.bedrooms,
        fallback: s.estimatedReplacementCost,
      });
      const cost = Math.round(t.budget.tradieTotal);
      if (cost > 0) {
        repairAllowance += cost;
        repairBreakdown[s.name] = cost;
      }
    }

    const medianPerSqm = result.suburbValue?.medianPerSqm ?? null;
    const floor = listing.floorAreaSqm ?? 0;
    const asking = listing.askingPrice ?? 0;
    const roiqValuation = medianPerSqm && floor ? roiqFairValue(medianPerSqm, score, floor) : asking;
    const addr = listing.address ?? address ?? "";
    const geo = await geocodeAddress(addr);

    const mapListing: MapListing = {
      id: `manual-${Date.now()}`,
      address: addr,
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
      photos: listing.photoUrls?.slice(0, 6) ?? [],
      listingType: null,
      roiqScore: score,
      roiqValuation,
      medianPerSqm,
      repairAllowance,
      repairBreakdown,
      estimatedWeeklyRent: Math.round(result.marketRent?.weekly ?? 0),
      suburbGrowthRatePct: result.capitalGrowth?.annualRatePct ?? 0,
      fullReportId: null,
      status: "active",
    };

    // Best-effort persist — RLS may block the write; the caller still gets the result.
    try {
      const supabase = createClient();
      // supabase-js infers the Omit-based Insert type as `never`; cast the validated row.
      await supabase.from("map_listings").insert(mapListingInsert(mapListing, url ?? "") as never);
    } catch {
      /* ignore persistence failure */
    }

    return NextResponse.json({ ok: true, listing: mapListing, geocoded: !!geo });
  } catch (err) {
    console.error("[map/score-now]", err);
    return NextResponse.json({ error: "score_failed", message: (err as Error).message }, { status: 500 });
  }
}
