"use client";

import Navbar from "@/components/Navbar";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { loadReport, type StoredReport } from "@/lib/report-store";
import { RealReportView } from "@/components/RealReportView";
import { buildDemoReport } from "@/lib/scoring/demo";

// Built once: the demo report is fully powered by the real v3.1 engine, so the
// persona toggle recomputes on it exactly as it does on a live report.
const DEMO_REPORT = buildDemoReport();

export default function ReportPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : String(params.id ?? "");
  const [report, setReport] = useState<StoredReport | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReport(loadReport(id));
    setReady(true);
  }, [id]);

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

  // A freshly generated real analysis renders the live report; otherwise the
  // built-in demo (e.g. /report/rpt_001 from the dashboard) renders — both go
  // through the same persona-aware viewer.
  return <RealReportView report={report ?? DEMO_REPORT} />;
}
