import { NextRequest, NextResponse } from "next/server";

import { readOwnerKey } from "@/lib/reports/owner";
import { deleteReport, loadReport } from "@/lib/reports/store";

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
  const report = await loadReport(params.id, readOwnerKey());
  if (!report) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, report });
}

/** DELETE /api/reports/[id] — remove one of the caller's own reports. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const deleted = await deleteReport(params.id, readOwnerKey());
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
