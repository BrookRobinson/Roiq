import { NextRequest, NextResponse } from "next/server";

import { hasLinzKey, lookupLinzPropertyRecord } from "@/lib/linz/property-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health/linz?address=3+Hobson+Street,+Kawerau
 *
 * Is the public-record lookup working, and how long is it taking?
 *
 * Worth its own endpoint for two reasons. The enrichment fails silently by
 * design — a report is expected to be missing a title rather than to fail — so
 * a broken key or a slow LINZ looks exactly like a property with no record.
 * And the two halves have very different coverage: every property in the
 * country has a title, but the district valuation roll is published for only
 * about 12% of them, so "no valuation" is the normal answer and not a fault.
 *
 * The default address is deliberately one in a district that DOES publish its
 * roll, so a healthy response exercises both halves.
 */
export async function GET(req: NextRequest) {
  if (!hasLinzKey()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      summary:
        "LINZ_API_KEY isn't set. Titles and rating valuations are skipped; reports fall back to what the listing says.",
    });
  }

  const address = req.nextUrl.searchParams.get("address")?.trim() || "3 Hobson Street, Kawerau";
  const started = Date.now();
  const record = await lookupLinzPropertyRecord(address).catch(() => null);
  const ms = Date.now() - started;

  if (!record) {
    return NextResponse.json({
      ok: false,
      configured: true,
      address,
      ms,
      summary:
        "No record came back. Either the address doesn't resolve to exactly one property — which is a deliberate refusal, not a fault — or LINZ is slow and the 15s budget ran out.",
    });
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    address,
    matched: record.address,
    ms,
    title: record.title,
    valuation: record.valuation,
    summary: record.valuation
      ? "Title and rating valuation both resolved."
      : "Title resolved. No rating valuation — normal, the roll covers roughly 12% of properties.",
  });
}
