"use client";

import Navbar from "@/components/Navbar";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { loadReport, type StoredReport } from "@/lib/report-store";
import { RealReportView } from "@/components/RealReportView";
import { buildDemoReport } from "@/lib/scoring/demo";
import { SHARE_ID_PREFIX } from "@/lib/share";
import { fetchSavedReport } from "@/lib/reports/client";

// Built once: the demo report is fully powered by the real v3.1 engine, so the
// persona toggle recomputes on it exactly as it does on a live report.
const DEMO_REPORT = buildDemoReport();

// Generated reports are uuids; the demo and bundled samples use readable ids like
// `rpt_001`. Only the latter may fall back to the demo — rendering the demo for a
// uuid that wasn't found would present 14 Ferndale Rd as whatever property the
// viewer actually asked for, which is exactly what a map pin would do to them.
const isGeneratedId = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export default function ReportPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : String(params.id ?? "");
  const [report, setReport] = useState<StoredReport | null>(null);
  const [ready, setReady] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [needsPro, setNeedsPro] = useState(false);
  const [notFound, setNotFound] = useState(false);

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

    // Not in this tab's storage. Before falling back to the demo, ask the server
    // — a report saved yesterday, or opened in a new tab, lives there now. Only
    // the browser that created it can read it back.
    let live = true;
    fetchSavedReport(id)
      .then((res) => {
        if (!live) return;
        if (res.status === "ok") setReport(res.report);
        else if (res.status === "upgrade_required") setNeedsPro(true);
        else if (isGeneratedId(id)) setNotFound(true);
        setReady(true);
      })
      .catch(() => live && setReady(true));

    return () => {
      live = false;
    };
  }, [id, isShared]);

  // Avoid a hydration flash: sessionStorage is only available client-side.
  if (!ready) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
        <Navbar />
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
             style={{ background: "var(--brand)", color: "var(--on-accent)" }}>
            Analyse a property
          </a>
        </div>
      </div>
    );
  }

  // A real report id that isn't there — deleted, or never saved. Say so instead
  // of rendering the demo as if it were this property.
  if (notFound) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <h1 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Report not found
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            This report no longer exists, or it was never saved to your account.
          </p>
          <a
            href="/report/new"
            className="inline-block px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--brand)", color: "var(--on-accent)" }}
          >
            Analyse a property
          </a>
        </div>
      </div>
    );
  }

  // Someone else's report, opened from a map pin without Pro. Show the upgrade
  // rather than the demo report — rendering another property's analysis here
  // would be worse than showing nothing.
  if (needsPro) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <h1 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            This report is part of Pro
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            Pro opens every report on the map — every property anyone has analysed, scored out of
            1,000 and valued against its asking price.
          </p>
          <a
            href="/pricing?plan=pro"
            className="inline-block px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--brand)", color: "var(--on-accent)" }}
          >
            See Pro
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
