import { NextRequest, NextResponse } from "next/server";

import { readOwnerKey } from "@/lib/reports/owner";
import { deleteReport, loadReport, loadReportForPro } from "@/lib/reports/store";
import { getUser, getUserPlan } from "@/lib/supabase/auth";
import { FEATURE_FROM, PLAN_LABEL, planIncludes } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reports/[id] — one saved report, for the browser that created it.
 *
 * 404s rather than 403s when the caller doesn't own it: map pins publish report
 * ids, so confirming "this id exists, you just can't have it" would leak which
 * properties have been analysed.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { authUser } = await getUser().catch(() => ({ authUser: null }));

  // Your own report, always.
  const own = await loadReport(params.id, readOwnerKey(), authUser?.id ?? null);
  if (own) return NextResponse.json({ ok: true, report: own, access: "owner" });

  // Someone else's, off the map. This is what the map tiers buy — every analysis
  // anyone has run on a property that's publicly for sale.
  const plan = await getUserPlan().catch(() => "free" as const);
  const allowed = planIncludes(plan, "mapReports");
  if (allowed) {
    const shared = await loadReportForPro(params.id);
    if (shared) return NextResponse.json({ ok: true, report: shared, access: "map" });
  }

  // 404 rather than 403 for a report that exists but isn't theirs would hide the
  // upsell, so name the tier that opens it — without leaking anything about the
  // report itself beyond the fact that the map already shows the property.
  if (authUser && !allowed) {
    const exists = await loadReportForPro(params.id);
    if (exists) {
      const from = PLAN_LABEL[FEATURE_FROM.mapReports];
      return NextResponse.json(
        {
          ok: false,
          error: "upgrade_required",
          plan,
          message: `${from} opens every report on the map.`,
        },
        { status: 402 }
      );
    }
  }

  return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
}

/** DELETE /api/reports/[id] — remove one of the caller's own reports. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { authUser } = await getUser().catch(() => ({ authUser: null }));
  const deleted = await deleteReport(params.id, readOwnerKey(), authUser?.id ?? null);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
