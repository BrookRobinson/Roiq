import { NextResponse } from "next/server";
import { lookupLinzPropertyRecord } from "@/lib/linz/property-records";
import { fetchAerialCrop } from "@/lib/imagery/aerial-crop";

// The aerial picture the analysis is shown for an address, so it can be looked
// at by a person: /api/health/aerial?address=172 Park Street, Hokitika
// Returns the JPEG itself, or JSON saying why there isn't one.
export const runtime = "nodejs";

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address")?.trim();
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });
  const record = await lookupLinzPropertyRecord(address);
  if (!record) return NextResponse.json({ ok: false, reason: "LINZ could not pin that address to one property" }, { status: 404 });
  if (!record.site) return NextResponse.json({ ok: false, reason: "no surveyed boundary for this property" }, { status: 404 });
  const crop = await fetchAerialCrop(record.site);
  if (!crop) return NextResponse.json({ ok: false, reason: "no usable LINZ aerial imagery (no key, outside coverage, or mostly blank)" }, { status: 404 });
  return new NextResponse(new Uint8Array(crop.buf), {
    headers: {
      "Content-Type": crop.media,
      "Cache-Control": "no-store",
      "X-Aerial-Zoom": String(crop.zoom),
      "X-Metres-Per-Pixel": crop.metresPerPixel.toFixed(3),
    },
  });
}
