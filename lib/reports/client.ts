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
 * Fetch a saved report. Returns null when this browser doesn't own it — the
 * server 404s rather than 403s, so a report id someone found on a map pin
 * reveals nothing.
 */
export async function fetchSavedReport(id: string): Promise<StoredReport | null> {
  try {
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.ok && json.report ? (json.report as StoredReport) : null;
  } catch {
    return null;
  }
}
