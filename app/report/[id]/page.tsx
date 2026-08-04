"use client";

import Navbar from "@/components/Navbar";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { loadReport, type StoredReport } from "@/lib/report-store";
import { RealReportView } from "@/components/RealReportView";
import { buildDemoReport } from "@/lib/scoring/demo";
import { SHARE_ID_PREFIX } from "@/lib/share";

// Built once: the demo report is fully powered by the real v3.1 engine, so the
// persona toggle recomputes on it exactly as it does on a live report.
const DEMO_REPORT = buildDemoReport();

export default function ReportPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : String(params.id ?? "");
  const [report, setReport] = useState<StoredReport | null>(null);
  const [ready, setReady] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // A share_<token> id is a report someone sent us: it isn't in this browser's
  // storage, so fetch the snapshot from the server and render it read-only.
  const isShared = id.startsWith(SHARE_ID_PREFIX);

  useEffect(() => {
    const stored = loadReport(id);
    if (stored) { setReport(stored); setReady(true); return; }

    if (isShared) {
      const token = id.slice(SHARE_ID_PREFIX.length);
      fetch(`/api/report/share?token=${encodeURIComponent(token)}`)
        .then(async (r) => {
          const j = await r.json().catch(() => null);
          if (r.ok && j?.ok && j.report) { setReport(j.report as StoredReport); }
          else { setShareError(j?.error ?? "This shared report couldn't be loaded."); }
          setReady(true);
        })
        .catch(() => { setShareError("Couldn't reach the server to load this shared report."); setReady(true); });
      return;
    }

    // Bundled live sample(s) served from /public so a real report (with real
    // photos, so the visualiser renders) can be opened at a stable URL for
    // testing/sharing — e.g. /report/sample-hokitika.
    if (id.startsWith("sample-")) {
      fetch(`/${id}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: StoredReport | null) => { setReport(j); setReady(true); })
        .catch(() => setReady(true));
      return;
    }
    setReady(true);
  }, [id, isShared]);

  // Avoid a hydration flash: sessionStorage is only available client-side.
  if (!ready) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
        <Navbar user={{ email: "jane@example.com" }} plan="starter" />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Loading report…
        </div>
      </div>
    );
  }

  // A shared link that failed to load: show the reason rather than silently
  // falling back to the demo report (which would be misleading).
  if (isShared && shareError) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
        <Navbar user={null} />
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <h1 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Report unavailable</h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>{shareError}</p>
          <a href="/report/new" className="inline-block px-4 py-2 rounded-lg text-sm font-semibold"
             style={{ background: "var(--brand)", color: "#fff" }}>
            Analyse a property
          </a>
        </div>
      </div>
    );
  }

  // A freshly generated real analysis renders the live report; otherwise the
  // built-in demo (e.g. /report/rpt_001 from the dashboard) renders — both go
  // through the same persona-aware viewer. Shared reports render read-only.
  return <RealReportView report={report ?? DEMO_REPORT} shared={isShared} />;
}
