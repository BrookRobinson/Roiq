import { NextResponse } from "next/server";

import { buildSampleReport, SAMPLE_PROFILES, SAMPLE_ID_PREFIX } from "@/lib/scoring/sample-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health/samples — do all thirty map-pin reports still build, and do
 * they still read as thirty different properties?
 *
 * These are the shop window: a visitor decides whether to pay by reading one.
 * They're generated through the real scoring engine, so a change to the model,
 * the catalogue or the engine can quietly flatten them — every pin landing on
 * the same score, or a costed item disappearing — without breaking a type. This
 * is the check that notices.
 */
export async function GET() {
  const rows = SAMPLE_PROFILES.map((p) => {
    const id = `${SAMPLE_ID_PREFIX}${p.seedId}`;
    const report = buildSampleReport(id);
    if (!report) return { id, ok: false as const, reason: "did not build" };

    const buyer = report.scores.buyer;
    const costed = report.subItems.filter((s) => s.estimatedReplacementCost);
    const repairs = costed.reduce(
      (sum, s) => sum + (s.estimatedReplacementCost!.low + s.estimatedReplacementCost!.high) / 2,
      0
    );
    return {
      id,
      ok: true as const,
      address: `${report.listing.address}, ${report.listing.suburb}`,
      archetype: p.archetype,
      built: p.buildYear,
      score: buyer.total,
      items: report.subItems.length,
      notAssessed: buyer.unassessed.length,
      costedItems: costed.length,
      repairEstimate: Math.round(repairs),
    };
  });

  const built = rows.filter((r) => r.ok);
  const scores = built.map((r) => (r as { score: number }).score);
  const distinctScores = new Set(scores).size;
  const addresses = new Set(built.map((r) => (r as { address: string }).address));

  // Every pin must be its own property. Duplicate ids in the seed table once
  // made two pins share a report, which is the failure this guards.
  const problems: string[] = [];
  if (built.length !== SAMPLE_PROFILES.length) problems.push(`${SAMPLE_PROFILES.length - built.length} failed to build`);
  if (addresses.size !== built.length) problems.push("duplicate addresses");
  if (distinctScores < built.length * 0.6) problems.push(`only ${distinctScores} distinct scores across ${built.length} properties`);
  if (built.some((r) => (r as { costedItems: number }).costedItems === 0))
    problems.push("a property has no costed work at all");

  return NextResponse.json({
    ok: problems.length === 0,
    count: built.length,
    distinctScores,
    scoreRange: scores.length ? [Math.min(...scores), Math.max(...scores)] : null,
    problems,
    rows,
  });
}
