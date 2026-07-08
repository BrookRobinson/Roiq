import { NextRequest, NextResponse } from "next/server";
import { getListingById, resolveVariables } from "@/lib/map/store";
import { computeListing } from "@/lib/map/calc";

export const runtime = "nodejs";

/** GET /api/map/listings/[id]?vars=<json> — full detail + both-mode figures for the sheet. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const listing = await getListingById(params.id);
  if (!listing) {
    return NextResponse.json({ error: "not_found", message: "Listing not found." }, { status: 404 });
  }
  const vars = await resolveVariables(req);
  return NextResponse.json({
    ok: true,
    listing,
    homebuyer: computeListing(listing, vars, "homebuyer"),
    investor: computeListing(listing, vars, "investor"),
  });
}
