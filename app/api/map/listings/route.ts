import { NextRequest, NextResponse } from "next/server";
import { getActiveListings, parseBBox, resolveVariables } from "@/lib/map/store";
import { computeListing } from "@/lib/map/calc";
import type { MapMode } from "@/lib/map/types";

export const runtime = "nodejs";

/**
 * GET /api/map/listings?mode=homebuyer|investor&bounds=minLng,minLat,maxLng,maxLat&vars=<json>
 * Active listings in the viewport, each recomputed to a deal colour + % against the
 * requesting user's saved variables. Returns the minimal payload the map needs.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode: MapMode = url.searchParams.get("mode") === "investor" ? "investor" : "homebuyer";
  const bbox = parseBBox(url.searchParams.get("bounds"));
  const vars = await resolveVariables(req);
  const all = await getActiveListings(bbox);
  // Budget filter — hide anything above the user's max purchase price.
  const listings = vars.budget > 0 ? all.filter((l) => l.askingPrice <= vars.budget) : all;

  const points = listings.map((l) => {
    const c = computeListing(l, vars, mode);
    return { id: l.id, lat: l.lat, lng: l.lng, colour: c.colour, pct: Math.round(c.pct) };
  });

  return NextResponse.json({ ok: true, mode, count: points.length, listings: points });
}
