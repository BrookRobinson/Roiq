// ============================================================
// Reports — the browser's half of persistence.
//
// sessionStorage stays the fast path: it's already written by the time the user
// lands on their report, needs no round trip, and keeps the report readable if
// the database is away. The server copy is what makes a report outlive the tab.
// ============================================================

import type { StoredReport } from "@/lib/report-store";

/**
 * Save a finished report to the server. Fire-and-forget: the user is being
 * navigated to their report, and durability failing must never hold that up or
 * surface an error — sessionStorage has it either way.
 */
export function persistReport(report: StoredReport): void {
  try {
    void fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      keepalive: true, // survives the navigation to /report/[id]
    }).catch(() => {
      /* the report still renders from sessionStorage */
    });
  } catch {
    /* non-fatal */
  }
}

/**
 * Fetch a saved report. Three outcomes: it's yours (or you're Pro), it exists but
 * needs Pro, or there's nothing here. A report that simply doesn't exist 404s
 * without confirming anything.
 */
export type SavedReportResult =
  | { status: "ok"; report: StoredReport }
  | { status: "upgrade_required" }
  | { status: "not_found" };

export async function fetchSavedReport(id: string): Promise<SavedReportResult> {
  try {
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}`);
    // 402: the report exists and it isn't theirs — Pro opens it.
    if (res.status === 402) return { status: "upgrade_required" };
    if (!res.ok) return { status: "not_found" };
    const json = await res.json();
    return json?.ok && json.report
      ? { status: "ok", report: json.report as StoredReport }
      : { status: "not_found" };
  } catch {
    return { status: "not_found" };
  }
}
