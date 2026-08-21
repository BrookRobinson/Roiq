"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import {
  Plus,
  FileText,
  Clock,
  TrendingUp,
  Share2,
  Download,
  ExternalLink,
  Search,
  Filter,
} from "lucide-react";
import type { ReportSummary } from "@/lib/reports/store";

/** A saved report, shaped for the card below. */
interface Card {
  id: string;
  address: string;
  date: string;
  score: number | null;
  vfm: string | null;
  status: string;
  price: string;
  type: string;
  beds: number | null;
  baths: number | null;
  source: string;
}

const money = (n: number | null) => (n ? `$${Math.round(n).toLocaleString("en-NZ")}` : "Price undisclosed");

function toCard(r: ReportSummary): Card {
  let source = "manual upload";
  if (r.listingUrl) {
    try {
      source = new URL(r.listingUrl).hostname.replace(/^www\./, "");
    } catch {
      source = "listing";
    }
  }
  return {
    id: r.id,
    address: r.address ?? "Address not recorded",
    date: new Date(r.createdAt).toLocaleDateString("en-NZ"),
    score: r.score,
    // Real reports don't carry a value-for-money grade; the card hides it when null.
    vfm: null,
    status: "complete",
    price: money(r.askingPrice),
    type: r.propertyType ?? "Property",
    beds: r.bedrooms,
    baths: r.bathrooms,
    source,
  };
}

function scoreColor(s: number | null) {
  if (!s) return "var(--text-muted)";
  if (s >= 750) return "#00e676";
  if (s >= 600) return "#00d4c8";
  if (s >= 450) return "#fbbf24";
  return "#ff5f5f";
}

function vfmClass(v: string | null) {
  if (!v) return "";
  if (v.startsWith("A")) return "grade-a-plus";
  if (v.startsWith("B")) return "grade-b-plus";
  if (v.startsWith("C")) return "grade-c-plus";
  return "grade-d";
}

export default function DashboardPage() {
  const [reports, setReports] = useState<Card[] | null>(null);

  // Reports are owned by an httpOnly cookie, so the browser can't read them
  // itself — the server resolves "mine" from the request.
  useEffect(() => {
    let live = true;
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => live && setReports(((d?.reports ?? []) as ReportSummary[]).map(toCard)))
      .catch(() => live && setReports([]));
    return () => {
      live = false;
    };
  }, []);

  // Derived from the real list — a hardcoded headline that disagrees with the
  // reports underneath it is worse than no headline.
  const list = reports ?? [];
  const scored = list.filter((r) => typeof r.score === "number");
  const now = new Date();
  const thisMonth = list.filter((r) => {
    const d = new Date(r.date.split("/").reverse().join("-"));
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const avgScore = scored.length
    ? Math.round(scored.reduce((a, r) => a + (r.score as number), 0) / scored.length)
    : null;
  const bestScore = scored.length ? Math.max(...scored.map((r) => r.score as number)) : null;
  const dash = (v: number | null) => (reports === null ? "—" : v === null ? "—" : String(v));

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Navbar user={{ email: "jane@example.com" }} plan="starter" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Dashboard
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Your saved property reports
            </p>
          </div>
          <Link href="/report/new" className="btn-primary">
            <Plus size={16} />
            New report
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Reports", value: dash(reports === null ? null : list.length), icon: FileText, color: "#00d4c8" },
            { label: "This month", value: dash(reports === null ? null : thisMonth), icon: Clock, color: "#a78bfa" },
            { label: "Avg score", value: dash(avgScore), icon: TrendingUp, color: "#00e676" },
            { label: "Best score", value: dash(bestScore), icon: TrendingUp, color: "#fbbf24" },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${s.color}18` }}
                >
                  <s.icon size={14} style={{ color: s.color }} />
                </div>
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  {s.label}
                </span>
              </div>
              <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Search and filter */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              className="input pl-9"
              placeholder="Search reports…"
              style={{ paddingLeft: 36 }}
            />
          </div>
          <button className="btn-secondary gap-2">
            <Filter size={14} />
            Filter
          </button>
        </div>

        {/* Report cards */}
        {reports !== null && reports.length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-sm mb-1" style={{ color: "var(--text-primary)" }}>No reports yet</p>
            <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
              Analyse a listing and it will be saved here.
            </p>
            <Link href="/report/new" className="btn-primary inline-flex gap-2" style={{ textDecoration: "none" }}>
              <Plus size={14} /> New report
            </Link>
            <p className="text-xs mt-5" style={{ color: "var(--text-muted)" }}>
              Or open the <Link href="/report/rpt_001" style={{ color: "var(--brand)" }}>sample report</Link> to see what one looks like.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {(reports ?? []).map((r) => (
            <Link
              key={r.id}
              href={`/report/${r.id}`}
              className="card p-5 flex items-center gap-4 cursor-pointer hover:-translate-y-0.5 transition-transform"
              style={{ textDecoration: "none", display: "flex" }}
            >
              {/* Score */}
              <div
                className="w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                style={{
                  background:
                    r.score
                      ? `${scoreColor(r.score)}14`
                      : "var(--surface-2)",
                  border: `1.5px solid ${r.score ? `${scoreColor(r.score)}30` : "var(--border)"}`,
                }}
              >
                {r.status === "processing" ? (
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "var(--brand)" }}
                    />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>…</span>
                  </div>
                ) : (
                  <>
                    <span className="text-lg font-bold" style={{ color: scoreColor(r.score) }}>
                      {r.score}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>/1k</span>
                  </>
                )}
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3
                    className="font-semibold text-sm truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {r.address}
                  </h3>
                  {r.status === "processing" && (
                    <span className="badge badge-amber text-xs flex-shrink-0">Processing</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: "var(--text-muted)" }}>
                  <span>{r.date}</span>
                  <span>·</span>
                  <span>{r.price}</span>
                  <span>·</span>
                  <span>{r.beds}bd {r.baths}ba</span>
                  <span>·</span>
                  <span>{r.type}</span>
                  <span>·</span>
                  <span>{r.source}</span>
                </div>
              </div>

              {/* VFM */}
              {r.vfm && (
                <div className="hidden sm:block text-right flex-shrink-0">
                  <div className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>VFM</div>
                  <div className={`text-xl ${vfmClass(r.vfm)}`}>{r.vfm}</div>
                </div>
              )}

              {/* Actions. The whole card is already a link to the report, so these
                  can't be nested <a>/<button> inside it (invalid HTML → hydration
                  error). They're visual affordances; the card handles opening, and
                  share/download stop the click so they don't navigate. */}
              <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                  aria-hidden="true"
                >
                  <ExternalLink size={14} />
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                  aria-label="Share report"
                >
                  <Share2 size={14} />
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                  aria-label="Download PDF"
                >
                  <Download size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Upgrade prompt for free users */}
        <div
          className="mt-8 rounded-2xl p-6 text-center"
          style={{
            background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)",
          }}
        >
          <h3 className="font-bold text-white text-lg mb-1">
            Get unlimited reports and the NZ investment map
          </h3>
          <p className="text-[var(--text-secondary)] text-sm mb-4">
            Starter $49 / month · Pro with map $99 / month
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-[var(--brand)] font-semibold text-sm cursor-pointer hover:bg-[var(--brand-light)] transition-colors"
          >
            Upgrade plan
          </Link>
        </div>
      </div>
    </div>
  );
}
