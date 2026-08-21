import { NextRequest, NextResponse } from "next/server";

import { ensureOwnerKey, readOwnerKey } from "@/lib/reports/owner";
import { listReports, saveReport } from "@/lib/reports/store";
import { getUser } from "@/lib/supabase/auth";
import type { StoredReport } from "@/lib/report-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/reports — persist a finished report.
 *
 * Called after the client has already written it to sessionStorage, so a
 * database that's away costs durability, not the report: the caller gets
 * `saved: false` with a reason and carries on to show it.
 */
export async function POST(req: NextRequest) {
  let report: StoredReport;
  try {
    report = (await req.json()) as StoredReport;
  } catch {
    return NextResponse.json({ error: "bad_json", message: "Invalid JSON body." }, { status: 400 });
  }

  if (!report?.id || !report.listing || !report.scores) {
    return NextResponse.json({ error: "missing_input", message: "Need a full report." }, { status: 400 });
  }

  // Mints the owner cookie on a first save, so a browser's reports stay theirs
  // even before they sign in; the user id attaches ownership properly when there is one.
  const ownerKey = ensureOwnerKey();
  const { authUser } = await getUser().catch(() => ({ authUser: null }));
  const result = await saveReport(report, ownerKey, authUser?.id ?? null);

  return NextResponse.json({
    ok: result.saved,
    id: report.id,
    saved: result.saved,
    reason: result.reason ?? null,
    detail: result.detail ?? null,
  });
}

/** GET /api/reports — the caller's saved reports, newest first. */
export async function GET() {
  const { authUser } = await getUser().catch(() => ({ authUser: null }));
  const reports = await listReports(readOwnerKey(), authUser?.id ?? null);
  return NextResponse.json({ ok: true, count: reports.length, reports });
}
