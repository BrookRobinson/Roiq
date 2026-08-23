import { NextRequest, NextResponse } from "next/server";

import { ZONING_COUNCILS } from "@/lib/zoning/councils";
import { councilFor, lookupZone } from "@/lib/zoning/district-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health/zoning?lat=&lng=&ta=
 *
 * Can we actually retrieve a district-plan zone, and from which councils?
 *
 * Fifty separate council services, each free to rename a field or reorder a
 * layer without telling anybody, is not something to find out about through a
 * report that quietly stopped mentioning zoning. With no parameters this runs a
 * spread of real addresses across different councils and field conventions —
 * Auckland's coded values, Christchurch's `Type`/`TypeGroup`, Dunedin's
 * `Sub_Zone` — so a change in any of them shows up here first.
 */
const SAMPLES: { label: string; ta: string; lat: number; lng: number; expect: string }[] = [
  { label: "20 Ilam Road, Christchurch", ta: "Christchurch City", lat: -43.5297688333, lng: 172.58021285, expect: "residential" },
  { label: "14 Ferndale Road, Auckland", ta: "Auckland", lat: -36.8981771667, lng: 174.83023995, expect: "residential" },
  { label: "20 Kelburn Parade, Wellington", ta: "Wellington City", lat: -41.2875658333, lng: 174.7683230167, expect: "zone" },
  { label: "20 Highgate, Dunedin", ta: "Dunedin City", lat: -45.8727919, lng: 170.48113365, expect: "residential" },
];

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const ta = req.nextUrl.searchParams.get("ta");

  if (Number.isFinite(lat) && Number.isFinite(lng) && ta) {
    const started = Date.now();
    const zone = await lookupZone(lat, lng, ta);
    return NextResponse.json({
      ok: !!zone,
      councils: ZONING_COUNCILS.length,
      hasService: councilFor(ta) !== null,
      ms: Date.now() - started,
      zone,
      summary: zone
        ? `${zone.zone} (${zone.council})`
        : councilFor(ta)
          ? "That council publishes a zone layer but nothing came back for this point."
          : `No queryable zone service for "${ta}" — the report has to say so rather than guess.`,
    });
  }

  const results = await Promise.all(
    SAMPLES.map(async (s) => {
      const started = Date.now();
      const zone = await lookupZone(s.lat, s.lng, s.ta);
      return {
        council: s.ta,
        address: s.label,
        ms: Date.now() - started,
        zone: zone?.zone ?? null,
        group: zone?.group ?? null,
        looksRight: !!zone && new RegExp(s.expect, "i").test(zone.zone),
      };
    })
  );

  const good = results.filter((r) => r.looksRight).length;
  return NextResponse.json({
    ok: good === results.length,
    councils: ZONING_COUNCILS.length,
    resolved: `${good}/${results.length}`,
    results,
    summary:
      good === results.length
        ? `All ${results.length} sample councils returned a sensible zone.`
        : `${results.length - good} of ${results.length} sample councils did not — a field or layer has probably moved.`,
  });
}
