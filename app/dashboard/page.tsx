"use client";

import Link from "next/link";
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

const MOCK_REPORTS = [
  {
    id: "rpt_001",
    address: "14 Ferndale Rd, Remuera, Auckland",
    date: "03/06/2026",
    score: 724,
    vfm: "B+",
    status: "complete",
    price: "$1,150,000",
    type: "House",
    beds: 3,
    baths: 2,
    source: "trademe.co.nz",
  },
  {
    id: "rpt_002",
    address: "Unit 4/22 Willis St, Te Aro, Wellington",
    date: "01/06/2026",
    score: 541,
    vfm: "C+",
    status: "complete",
    price: "$495,000",
    type: "Apartment",
    beds: 2,
    baths: 1,
    source: "realestate.co.nz",
  },
  {
    id: "rpt_003",
    address: "88 Beach Rd, Sumner, Christchurch",
    date: "28/05/2026",
    score: 612,
    vfm: "A",
    status: "complete",
    price: "$720,000",
    type: "House",
    beds: 4,
    baths: 2,
    source: "harcourts.net",
  },
  {
    id: "rpt_004",
    address: "37 Victoria St West, Auckland CBD",
    date: "26/05/2026",
    score: null,
    vfm: null,
    status: "processing",
    price: "$680,000",
    type: "Apartment",
    beds: 1,
    baths: 1,
    source: "trademe.co.nz",
  },
];

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
            { label: "Reports", value: "4", icon: FileText, color: "#00d4c8" },
            { label: "This month", value: "3", icon: Clock, color: "#a78bfa" },
            { label: "Avg score", value: "626", icon: TrendingUp, color: "#00e676" },
            { label: "Best VFM", value: "A", icon: TrendingUp, color: "#fbbf24" },
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
        <div className="space-y-3">
          {MOCK_REPORTS.map((r) => (
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
            Starter from $49/mo · Pro with map from $99/mo
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
