import { NextResponse } from "next/server";
import { lookupLinzPropertyRecord } from "@/lib/linz/property-records";
import { readSiteLayout } from "@/lib/scoring/site-layout";

// ============================================================
// The section's shape, for a report that was written before we fetched it.
//
// `listing.siteLayout` is filled during the scrape now, so every new report
// carries its parcel boundary, its building footprints and the anchor the aerial
// imagery is aligned to. Reports written before that have none of it — and the
// alternative was telling somebody to spend another allowance and four minutes
// re-running an analysis whose FINDINGS were fine, purely to get a picture.
//
// So the report asks for it on open when it's missing. Nothing here re-analyses
// anything: it reads the public record for an address and returns geometry.
// ============================================================

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address")?.trim();
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

  try {
    const record = await lookupLinzPropertyRecord(address);
    // No parcel is a real answer. The address may not resolve to exactly one
    // property, which the record lookup refuses on purpose — a wrong boundary
    // drawn over somebody's aerial photo is the wrong-house failure with a
    // survey line on it.
    if (!record?.site || record.site.parcel.length < 3) {
      return NextResponse.json({ layout: null }, { headers: { "Cache-Control": "private, max-age=3600" } });
    }

    const layout = readSiteLayout({
      parcel: record.site.parcel,
      buildings: record.site.buildings,
      roadPoint: record.site.roadPoint,
      anchor: record.site.anchor,
    });

    return NextResponse.json(
      { layout, appellation: record.site.appellation, parcelAreaSqm: record.site.parcelAreaSqm },
      { headers: { "Cache-Control": "private, max-age=3600" } }
    );
  } catch (err) {
    console.warn("[site-geometry]", (err as Error)?.message);
    return NextResponse.json({ layout: null }, { status: 200 });
  }
}
