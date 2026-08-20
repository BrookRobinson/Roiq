import { NextRequest, NextResponse } from "next/server";
import { seedById } from "@/lib/map/seed";
import { getListingById, resolveVariables } from "@/lib/map/store";
import { computeListing } from "@/lib/map/calc";

export const runtime = "nodejs";

/**
 * GET /api/map/listings/[id]?vars=<json>&demo=1
 * Full detail plus both-mode figures for the property sheet.
 *
 * `demo=1` resolves from the seeded demo set only, matching the landing-page
 * map so a pin and the sheet it opens can never disagree about the property.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const demo = new URL(req.url).searchParams.get("demo") === "1";
  const listing = demo ? (seedById(params.id) ?? null) : await getListingById(params.id);
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
