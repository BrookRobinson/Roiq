"use client";

import Navbar from "@/components/Navbar";
import { useState } from "react";
import {
  Share2,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Home,
  Map,
  Shield,
  Calculator,
  Building2,
  Wrench,
  Info,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PropertyTab } from "@/components/PropertyTab/PropertyTab";
import { DEMO_PROPERTY_DATA } from "@/lib/property-tab/mock-data";
import { HoldPeriodProvider } from "@/lib/hold-period/context";
import { HoldPeriodSlider } from "@/components/HoldPeriodSlider";
import { ReportGapBanner } from "@/components/ReportGapBanner";
import { DEMO_GAPS } from "@/lib/property-tab/gaps";

type Tab =
  | "overview"
  | "property"
  | "renovations"
  | "financial"
  | "hazard"
  | "healthyhomes";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview",     label: "Overview",      icon: Home       },
  { id: "property",     label: "Property",       icon: Building2  },
  { id: "renovations",  label: "Renovations",    icon: Wrench     },
  { id: "financial",    label: "Financial",      icon: Calculator },
  { id: "hazard",       label: "Hazard",         icon: Map        },
  { id: "healthyhomes", label: "Healthy Homes",  icon: Shield     },
];

export default function ReportPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [mode, setMode] = useState<"buyer" | "investor">("buyer");

  return (
    <HoldPeriodProvider defaultYears={10}>
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Navbar user={{ email: "jane@example.com" }} plan="starter" />

      {/* Report header */}
      <div
        className="border-b"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                {/* Back to dashboard */}
                <a href="/dashboard" className="flex items-center gap-1 hover:underline cursor-pointer" style={{ color: "var(--text-muted)" }}>
                  ← Dashboard
                </a>
                <span>·</span>
                <a href="https://www.trademe.co.nz" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline cursor-pointer" style={{ color: "var(--brand)" }}>
                  trademe.co.nz <ExternalLink size={11} />
                </a>
                <span>·</span>
                <span>3 June 2026</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                14 Ferndale Road, Remuera, Auckland
              </h1>
              <div className="flex items-center flex-wrap gap-3 mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                <span>$1,150,000</span>
                <span>·</span>
                <span>3 bed · 2 bath · 1 car</span>
                <span>·</span>
                <span>House · 185m² floor · 612m² land</span>
                <span>·</span>
                <span>c.1975 · Freehold</span>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              <button className="btn-secondary py-2 px-3 text-sm gap-2">
                <Share2 size={14} />
                Share
              </button>
              <button className="btn-secondary py-2 px-3 text-sm gap-2">
                <Download size={14} />
                PDF
              </button>
            </div>
          </div>

          {/* Buyer / Investor toggle */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Mode:</span>
            <div
              className="flex rounded-lg p-0.5"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              {(["buyer", "investor"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all capitalize"
                  style={{
                    background: mode === m ? "var(--bg)" : "transparent",
                    color: mode === m ? "var(--text-primary)" : "var(--text-secondary)",
                    boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Hold period slider — always visible */}
          <div className="mb-4">
            <HoldPeriodSlider />
          </div>

          {/* Gap banner — slim, not alarming */}
          <ReportGapBanner gaps={DEMO_GAPS} />

          {/* Tab navigation */}
          <div className="flex gap-0 overflow-x-auto -mb-px">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap cursor-pointer border-b-2 transition-colors"
                style={{
                  color: tab === t.id ? "var(--brand)" : "var(--text-secondary)",
                  borderBottomColor: tab === t.id ? "var(--brand)" : "transparent",
                }}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tab === "overview"     && <OverviewTab mode={mode} />}
        {tab === "property"     && <PropertyTab data={DEMO_PROPERTY_DATA} />}
        {tab === "renovations"  && <RenovationsTab />}
        {tab === "financial"    && <FinancialTab mode={mode} />}
        {tab === "hazard"       && <HazardTab />}
        {tab === "healthyhomes" && <HealthyHomesTab />}
      </div>

      {/* Disclaimer */}
      <div
        className="border-t px-4 py-4 text-center text-xs"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}
      >
        AI-generated analysis of publicly available listing data. Not a registered valuation or building inspection. Verify all findings before making an offer. ·{" "}
        <a href="https://www.trademe.co.nz" target="_blank" rel="noopener noreferrer" className="underline cursor-pointer" style={{ color: "var(--brand)" }}>View original listing</a>
      </div>
    </div>
    </HoldPeriodProvider>
  );
}

/* ─── TAB: OVERVIEW ─── */
function OverviewTab({ mode }: { mode: "buyer" | "investor" }) {
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Left column: scores */}
      <div className="space-y-5">
        {/* Quality score */}
        <div className="card p-5 text-center">
          <ScoreDial score={724} />
          <div className="text-3xl font-bold mt-2" style={{ color: "var(--text-primary)" }}>
            724<span className="text-base font-normal" style={{ color: "var(--text-muted)" }}>/1,000</span>
          </div>
          <div className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>Quality Score</div>
          <div className="badge badge-blue mx-auto">Above average</div>
        </div>

        {/* VFM */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Value for money
            </span>
            <Info size={14} style={{ color: "var(--text-muted)" }} />
          </div>
          <div className="text-5xl font-bold grade-b-plus">B+</div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Quality per dollar vs suburb average
          </div>
        </div>

        {/* Category scores */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-secondary)" }}>
            Category breakdown
          </h3>
          {[
            { label: "Structure & materials", score: 298, max: 400, color: "#00d4c8" },
            { label: "Location", score: 165, max: 200, color: "#a78bfa" },
            { label: "Land", score: 110, max: 150, color: "#00e676" },
            { label: "Legal / Title", score: 70, max: 100, color: "#f59e0b" },
            { label: "Financial", score: 57, max: 100, color: "#ef4444" },
            { label: "Liveability", score: 24, max: 50, color: "#6366f1" },
          ].map((c) => (
            <div key={c.label} className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: "var(--text-secondary)" }}>{c.label}</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{c.score}/{c.max}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                <div className="h-1.5 rounded-full" style={{ width: `${(c.score / c.max) * 100}%`, background: c.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Middle column: findings */}
      <div className="space-y-5 lg:col-span-2">
        {/* Key findings */}
        <div className="card p-5">
          <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Key findings</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { type: "positive", text: "Freehold title — confirmed via LINZ" },
              { type: "positive", text: "Heat pump installed — main living area" },
              { type: "positive", text: "Double-glazed throughout — confirmed" },
              { type: "positive", text: "New kitchen cabinetry — Tier 1 confidence" },
              { type: "positive", text: "Sunny north-facing aspect" },
              { type: "warning", text: "Iron roof shows surface rust — verify age at inspection" },
              { type: "warning", text: "Cross-slope section limits rear extension" },
              { type: "warning", text: "Days on market: 68 — price motivation likely" },
              { type: "negative", text: "No ceiling insulation visible in roof space photos" },
              { type: "negative", text: "Price above recent comparable sales by ~8%" },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
                {f.type === "positive" ? (
                  <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" style={{ color: "var(--success)" }} />
                ) : f.type === "warning" ? (
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" style={{ color: "var(--warning)" }} />
                ) : (
                  <XCircle size={15} className="mt-0.5 flex-shrink-0" style={{ color: "var(--danger)" }} />
                )}
                <span style={{ color: "var(--text-secondary)" }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Comparables */}
        <div className="card p-5">
          <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Recent comparable sales</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Address", "Sold", "Price", "m²", "$/m²", "vs asking"].map((h) => (
                    <th key={h} className="text-left pb-2 pr-4 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { addr: "8 Ferndale Rd", date: "Apr 26", price: "$1,080,000", sqm: 178, psm: "$6,067", diff: "-6%" },
                  { addr: "22 Orakei Rd", date: "Mar 26", price: "$1,240,000", sqm: 210, psm: "$5,905", diff: "+8%" },
                  { addr: "4 Ngapuhi Rd", date: "Feb 26", price: "$995,000", sqm: 160, psm: "$6,219", diff: "-13%" },
                  { addr: "31 Portland Rd", date: "Jan 26", price: "$1,150,000", sqm: 195, psm: "$5,897", diff: "0%" },
                ].map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle, var(--border))" }}>
                    <td className="py-2.5 pr-4" style={{ color: "var(--text-primary)" }}>{r.addr}</td>
                    <td className="py-2.5 pr-4" style={{ color: "var(--text-secondary)" }}>{r.date}</td>
                    <td className="py-2.5 pr-4 font-medium" style={{ color: "var(--text-primary)" }}>{r.price}</td>
                    <td className="py-2.5 pr-4" style={{ color: "var(--text-secondary)" }}>{r.sqm}</td>
                    <td className="py-2.5 pr-4" style={{ color: "var(--text-secondary)" }}>{r.psm}</td>
                    <td className="py-2.5">
                      <span className={`badge text-xs ${r.diff.startsWith("+") ? "badge-red" : r.diff === "0%" ? "badge-blue" : "badge-green"}`}>
                        {r.diff}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
            Based on sales within 500m, 3 bedrooms, similar land area. Source: PropertyValue.co.nz
          </p>
        </div>

        {/* Investor quick stats (investor mode) */}
        {mode === "investor" && (
          <div className="card p-5">
            <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Investor snapshot</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Gross yield", value: "4.8%", sub: "At $1,060/wk rent" },
                { label: "Net yield", value: "3.6%", sub: "After costs" },
                { label: "Weekly cashflow", value: "-$148", sub: "Top-up required", neg: true },
                { label: "10yr total return", value: "$891k", sub: "Capital + cashflow" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                  <div className="text-xl font-bold" style={{ color: s.neg ? "var(--danger)" : "var(--text-primary)" }}>
                    {s.value}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── TAB: PHOTOS (legacy — replaced by PropertyTab component) ─── */
function _PhotosTabUnused() {
  const photos = [
    {
      num: 1,
      label: "Front exterior",
      score: 72,
      tier: 1,
      confidence: 94,
      findings: ["Weatherboard cladding — good condition", "Iron roof — surface rust visible on ridgeline"],
      flags: ["Verify roof age at inspection"],
    },
    {
      num: 2,
      label: "Living room",
      score: 85,
      tier: 1,
      confidence: 91,
      findings: ["Heat pump installed — main living area", "Double-glazed windows — confirmed"],
      flags: [],
    },
    {
      num: 3,
      label: "Kitchen",
      score: 78,
      tier: 1,
      confidence: 93,
      findings: ["New cabinetry — modern finish", "Induction hob", "Stone benchtop"],
      flags: [],
    },
    {
      num: 4,
      label: "Main bedroom",
      score: 68,
      tier: 2,
      confidence: 76,
      findings: ["Carpet — good condition", "Built-in wardrobe"],
      flags: ["Verify at inspection: ceiling insulation access"],
    },
    {
      num: 5,
      label: "Bathroom",
      score: 62,
      tier: 2,
      confidence: 71,
      findings: ["Tiled throughout", "Bath + separate shower"],
      flags: ["Grout condition — verify at inspection"],
    },
    {
      num: 6,
      label: "Rear garden",
      score: 55,
      tier: 3,
      confidence: 58,
      findings: [],
      flags: ["Photo unclear — inspect for drainage issues"],
    },
  ];

  const tierColors: Record<number, string> = { 1: "#00e676", 2: "#f59e0b", 3: "#3d7872" };
  const tierLabels: Record<number, string> = {
    1: "Tier 1 — Confirmed",
    2: "Tier 2 — Verify at inspection",
    3: "Tier 3 — Unscored",
  };

  return (
    <div>
      {/* Tier legend */}
      <div
        className="rounded-xl p-4 mb-6 flex flex-wrap gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {[1, 2, 3].map((t) => (
          <div key={t} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ background: tierColors[t] }} />
            <span style={{ color: "var(--text-secondary)" }}>{tierLabels[t]}</span>
          </div>
        ))}
        <div className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
          Tier 1 ≥90% confidence · Tier 2 65–89% · Tier 3 &lt;65% (unscored)
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {photos.map((p) => (
          <div key={p.num} className="card overflow-hidden">
            {/* Photo placeholder */}
            <div
              className="h-44 flex items-center justify-center text-4xl font-bold"
              style={{
                background: `linear-gradient(135deg, ${tierColors[p.tier]}22 0%, ${tierColors[p.tier]}08 100%)`,
                borderBottom: "1px solid var(--border)",
                color: tierColors[p.tier],
              }}
            >
              #{p.num}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                  {p.label}
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: `${tierColors[p.tier]}18`, color: tierColors[p.tier] }}
                  >
                    T{p.tier}
                  </span>
                  {p.tier < 3 && (
                    <span className="text-sm font-bold" style={{ color: tierColors[p.tier] }}>
                      {p.score}/100
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                Confidence: {p.confidence}%
              </div>
              {p.findings.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {p.findings.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs">
                      <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" style={{ color: "var(--success)" }} />
                      <span style={{ color: "var(--text-secondary)" }}>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
              {p.flags.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {p.flags.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs">
                      <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" style={{ color: "var(--warning)" }} />
                      <span style={{ color: "var(--text-secondary)" }}>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── TAB: RENOVATIONS ─── */
function RenovationsTab() {
  const [expanded, setExpanded] = useState<string | null>("roof");
  const [active, setActive] = useState<Record<string, boolean>>({
    roof: true,
    ceiling_ins: true,
    kitchen: false,
    bathroom: false,
    heatpump: false,
  });

  const renos = [
    {
      id: "roof",
      name: "Roof replacement",
      urgency: "Urgent",
      urgencyColor: "#ef4444",
      low: 18000,
      high: 28000,
      netEquityHit: -15000,
      rentUplift: 0,
      formula: "185m² × $105–$155/m² (Marley tile replacement, Auckland rate)",
      patch: { cost: 4500, years: 5 },
    },
    {
      id: "ceiling_ins",
      name: "Ceiling insulation",
      urgency: "Urgent",
      urgencyColor: "#ef4444",
      low: 2400,
      high: 3800,
      netEquityHit: -1800,
      rentUplift: 25,
      formula: "185m² × $13–$21/m² (R3.2 batts, blow-in, Auckland)",
      patch: null,
    },
    {
      id: "kitchen",
      name: "Kitchen renovation",
      urgency: "Within 5 years",
      urgencyColor: "#f59e0b",
      low: 22000,
      high: 38000,
      netEquityHit: -8000,
      rentUplift: 75,
      formula: "Standard kitchen 12–16m² × $1,400–$2,400/m²",
      patch: null,
    },
    {
      id: "bathroom",
      name: "Bathroom renovation",
      urgency: "Within 5 years",
      urgencyColor: "#f59e0b",
      low: 14000,
      high: 22000,
      netEquityHit: -5000,
      rentUplift: 40,
      formula: "Standard bathroom 6–8m² × $2,000–$3,000/m²",
      patch: null,
    },
    {
      id: "heatpump",
      name: "Additional heat pump",
      urgency: "Optional",
      urgencyColor: "#6b7280",
      low: 2800,
      high: 4200,
      netEquityHit: 600,
      rentUplift: 30,
      formula: "Hi-wall 5–7kW supply + install, Auckland rate",
      patch: null,
    },
  ];

  const totalCost = renos
    .filter((r) => active[r.id])
    .reduce((sum, r) => sum + (r.low + r.high) / 2, 0);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-3">
        {renos.map((r) => (
          <div key={r.id} className="card overflow-hidden">
            <div
              className="flex items-center gap-4 p-4 cursor-pointer"
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
            >
              <input
                type="checkbox"
                checked={!!active[r.id]}
                onChange={(e) => {
                  e.stopPropagation();
                  setActive((a) => ({ ...a, [r.id]: e.target.checked }));
                }}
                className="w-4 h-4 cursor-pointer"
                aria-label={`Toggle ${r.name}`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                    {r.name}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${r.urgencyColor}15`, color: r.urgencyColor }}
                  >
                    {r.urgency}
                  </span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  ${r.low.toLocaleString()} – ${r.high.toLocaleString()}
                  {r.rentUplift > 0 && (
                    <span className="ml-2 text-success" style={{ color: "var(--success)" }}>
                      +${r.rentUplift}/wk rent
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold" style={{ color: r.netEquityHit >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {r.netEquityHit >= 0 ? "+" : ""}{r.netEquityHit < 0 ? "-$" : "$"}{Math.abs(r.netEquityHit).toLocaleString()}
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>net equity</div>
              </div>
              {expanded === r.id ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
            </div>
            {expanded === r.id && (
              <div
                className="px-4 pb-4 pt-0"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <div className="pt-4">
                  <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                    <strong>Cost formula:</strong> {r.formula}
                  </p>
                  {r.patch && (
                    <div
                      className="rounded-lg p-3 text-xs"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                    >
                      <strong style={{ color: "var(--text-primary)" }}>Patch option:</strong>{" "}
                      <span style={{ color: "var(--text-secondary)" }}>
                        ${r.patch.cost.toLocaleString()} patch — buys ~{r.patch.years} years before full replacement required.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="space-y-4">
        <div className="card p-5">
          <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Renovation summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--text-secondary)" }}>Selected items</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {Object.values(active).filter(Boolean).length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--text-secondary)" }}>Estimated cost</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                ${totalCost.toLocaleString()}
              </span>
            </div>
            <div
              className="flex justify-between text-sm pt-3"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <span style={{ color: "var(--text-secondary)" }}>Net equity impact</span>
              <span style={{ color: "var(--danger)", fontWeight: 700 }}>
                -${(totalCost * 0.6).toLocaleString()}
              </span>
            </div>
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
            Net = cost minus value recovery. Auckland 2026 rates.
          </p>
        </div>

        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: "var(--brand-light)", border: "1px solid var(--brand)", borderColor: "rgba(29,78,216,0.2)" }}
        >
          <p style={{ color: "var(--brand)" }}>
            <strong>Negotiating tip:</strong> Use urgent renovation costs as justification for an offer reduction of ${(totalCost * 0.5).toLocaleString()}–${totalCost.toLocaleString()}.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── TAB: FINANCIAL ─── */
function FinancialTab({ mode }: { mode: "buyer" | "investor" }) {
  const [deposit, setDeposit] = useState(mode === "investor" ? 35 : 20);
  const [rate, setRate] = useState(6.29);
  const [growth, setGrowth] = useState(4.5);
  const [rent, setRent] = useState(1060);

  const price = 1150000;
  const loan = price * (1 - deposit / 100);
  const weeklyMortgage = (loan * (rate / 100 / 52)) / (1 - Math.pow(1 + rate / 100 / 52, -52 * 25));
  const weeklyRates = 68;
  const weeklyInsurance = 32;
  const weeklyMaint = price * 0.01 / 52;
  const totalWeekly = weeklyMortgage + weeklyRates + weeklyInsurance + weeklyMaint;

  const equityData = Array.from({ length: 21 }, (_, year) => {
    const val = price * Math.pow(1 + growth / 100, year);
    const remaining = year === 0 ? loan : loan * Math.pow(1 - 1 / (52 * 25), year * 52);
    return {
      year: `Y${year}`,
      value: Math.round(val / 1000),
      equity: Math.round((val - Math.max(remaining, 0)) / 1000),
      loan: Math.round(Math.max(remaining, 0) / 1000),
    };
  });

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="card p-5">
        <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Calculator inputs</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">Deposit %</label>
            <input
              type="number"
              className="input"
              value={deposit}
              onChange={(e) => setDeposit(Number(e.target.value))}
              min={5}
              max={100}
            />
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              ${(price * deposit / 100).toLocaleString()}
            </div>
          </div>
          <div>
            <label className="label">Interest rate %</label>
            <input
              type="number"
              className="input"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              step={0.1}
            />
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>BNZ 2yr fixed rate</div>
          </div>
          <div>
            <label className="label">Growth rate %</label>
            <input
              type="number"
              className="input"
              value={growth}
              onChange={(e) => setGrowth(Number(e.target.value))}
              step={0.5}
            />
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Remuera 10yr avg</div>
          </div>
          {mode === "investor" && (
            <div>
              <label className="label">Weekly rent $</label>
              <input
                type="number"
                className="input"
                value={rent}
                onChange={(e) => setRent(Number(e.target.value))}
              />
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Suburb median</div>
            </div>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {mode === "buyer" ? (
          <>
            <MetricCard label="Weekly mortgage" value={`$${weeklyMortgage.toFixed(0)}`} />
            <MetricCard label="Total weekly cost" value={`$${totalWeekly.toFixed(0)}`} sub="Mortgage + rates + insurance + maint" />
            <MetricCard label="Value in 10 years" value={`$${(price * Math.pow(1.045, 10) / 1000).toFixed(0)}k`} />
            <MetricCard label="Equity in 10 years" value={`$${(equityData[10].equity)}k`} color="var(--success)" />
          </>
        ) : (
          <>
            <MetricCard label="Gross yield" value="4.8%" />
            <MetricCard label="Net yield" value="3.6%" />
            <MetricCard
              label="Weekly cashflow"
              value="-$148"
              sub="Top-up required"
              color="var(--danger)"
            />
            <MetricCard label="10yr total return" value="$891k" color="var(--success)" />
          </>
        )}
      </div>

      {/* Chart */}
      <div className="card p-5">
        <h3 className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          {mode === "buyer" ? "Equity timeline" : "Property value & equity"}
        </h3>
        <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
          At {growth}% annual growth, {deposit}% deposit, {rate}% interest
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={equityData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--text-muted)" }} interval={4} />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => `$${v}k`} />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number) => [`$${v}k`, ""]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="value" stroke="#00d4c8" name="Property value" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="equity" stroke="#00e676" name="Equity" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="loan" stroke="#ef4444" name="Loan remaining" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: color || "var(--text-primary)" }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{sub}</div>}
    </div>
  );
}

/* ─── TAB: HAZARD ─── */
function HazardTab() {
  const hazards = [
    {
      type: "Flood risk",
      status: "Low",
      statusColor: "#00e676",
      detail: "Property sits 24m above the 100-year ARI flood level. No FENZ flood zone designation. Stream 380m NE poses no risk at this elevation.",
      source: "Auckland Council GIS Flood Viewer",
      verified: true,
    },
    {
      type: "Coastal erosion",
      status: "Not applicable",
      statusColor: "#6b7280",
      detail: "Property is 4.2km from nearest coastline. Not within any coastal hazard zone under the Auckland Unitary Plan.",
      source: "Auckland Unitary Plan GIS",
      verified: true,
    },
    {
      type: "Liquefaction",
      status: "Low",
      statusColor: "#00e676",
      detail: "Remuera substrate is primarily Auckland volcanic basalt. Low liquefaction risk per Auckland Council geotechnical mapping.",
      source: "Auckland Council Geotechnical Atlas",
      verified: true,
    },
    {
      type: "Alpine fault",
      status: "Low",
      statusColor: "#00e676",
      detail: "Auckland is approximately 700km from the Alpine Fault. Seismic hazard is low (0.1g PGA) per NZGD Seismic Hazard Model.",
      source: "GNS Science NZGD",
      verified: true,
    },
  ];

  return (
    <div className="max-w-3xl space-y-4">
      <div
        className="rounded-xl p-4 text-sm"
        style={{ background: "var(--success-bg)", border: "1px solid rgba(16,185,129,0.2)" }}
      >
        <div className="flex items-center gap-2 font-semibold mb-1" style={{ color: "var(--success)" }}>
          <CheckCircle2 size={16} />
          No significant hazards identified
        </div>
        <p style={{ color: "var(--text-secondary)" }}>
          All four hazard categories assessed for 14 Ferndale Road, Remuera. No material hazards found.
          Findings are street-specific and sourced from primary data only.
        </p>
      </div>

      {hazards.map((h) => (
        <div key={h.type} className="card p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{h.type}</h3>
            <span
              className="badge flex-shrink-0"
              style={{ background: `${h.statusColor}18`, color: h.statusColor }}
            >
              {h.status}
            </span>
          </div>
          <p className="text-sm leading-relaxed mb-2" style={{ color: "var(--text-secondary)" }}>{h.detail}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Source: {h.source}</p>
        </div>
      ))}

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Hazard data sourced from Auckland Council, GNS Science, and FENZ. RoiQ reports street-specific
        findings only. Independent hazard assessment recommended for coastal, flood-prone, or TC-zone properties.
      </p>
    </div>
  );
}

/* ─── TAB: HEALTHY HOMES ─── */
function HealthyHomesTab() {
  const standards = [
    {
      name: "Heating",
      status: "Likely Compliant",
      statusColor: "#00e676",
      detail: "Heat pump (Samsung 5kW) confirmed in main living area — Tier 1. Meets the ≥1.5kW fixed heater requirement for a room of this size.",
      cost: null,
    },
    {
      name: "Insulation",
      status: "Likely Non-Compliant",
      statusColor: "#ef4444",
      detail: "No ceiling insulation visible in roof space photos (Tier 1 finding). c.1975 construction — typically uninsulated. Underfloor insulation status unknown.",
      cost: { low: 2400, high: 3800 },
    },
    {
      name: "Ventilation",
      status: "Probably Compliant",
      statusColor: "#f59e0b",
      detail: "Openable windows visible in kitchen and bathroom photos. Cannot confirm extractor fans are ducted to outside from listing photos — verify at inspection.",
      cost: null,
    },
    {
      name: "Moisture & drainage",
      status: "Probably Compliant",
      statusColor: "#f59e0b",
      detail: "Gutters and downpipes visible and appear clear. Rear section drainage unclear from photos. Verify subfloor moisture barrier at inspection.",
      cost: null,
    },
    {
      name: "Draught stopping",
      status: "Risk — Verify",
      statusColor: "#f97316",
      detail: "c.1975 construction typically has significant draughting issues around original joinery. Double glazing noted but some original windows may remain — check at inspection.",
      cost: { low: 800, high: 2500 },
    },
  ];

  const totalLow = standards.reduce((s, r) => s + (r.cost?.low || 0), 0);
  const totalHigh = standards.reduce((s, r) => s + (r.cost?.high || 0), 0);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        {standards.map((s) => (
          <div key={s.name} className="card p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{s.name}</h3>
              <span
                className="badge flex-shrink-0 text-xs"
                style={{ background: `${s.statusColor}18`, color: s.statusColor }}
              >
                {s.status}
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {s.detail}
            </p>
            {s.cost && (
              <div
                className="mt-3 p-2.5 rounded-lg text-xs"
                style={{ background: "var(--surface-2)" }}
              >
                Estimated remediation: <strong style={{ color: "var(--text-primary)" }}>
                  ${s.cost.low.toLocaleString()} – ${s.cost.high.toLocaleString()}
                </strong>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="space-y-4">
        <div className="card p-5">
          <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Compliance summary</h3>
          <div className="space-y-2">
            {[
              { label: "Likely Compliant", count: 1, color: "#00e676" },
              { label: "Probably Compliant", count: 2, color: "#f59e0b" },
              { label: "Risk — Verify", count: 1, color: "#f97316" },
              { label: "Likely Non-Compliant", count: 1, color: "#ef4444" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />
                  <span style={{ color: "var(--text-secondary)" }}>{r.label}</span>
                </div>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{r.count}</span>
              </div>
            ))}
          </div>
          <div
            className="mt-4 pt-4 space-y-2"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--text-secondary)" }}>Remediation cost</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                ${totalLow.toLocaleString()}–${totalHigh.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: "var(--warning-bg)", border: "1px solid rgba(245,158,11,0.2)" }}
        >
          <p style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--warning)" }}>Fine risk:</strong> Up to{" "}
            <strong>$7,200 per breach</strong> per Tenancy Services NZ. Factor remediation
            costs into your offer price.
          </p>
        </div>

        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Assessment is indicative only. Engage a certified Healthy Homes assessor before renting.
          Standards per Residential Tenancies (Healthy Homes Standards) Regulations 2019.
        </p>
      </div>
    </div>
  );
}

/* ─── Shared: Score Dial SVG ─── */
function ScoreDial({ score }: { score: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 1000);
  const color = score >= 750 ? "#00e676" : score >= 600 ? "#00d4c8" : score >= 450 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" className="mx-auto">
      <circle cx="52" cy="52" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
      <circle cx="52" cy="52" r={r} fill="none" stroke={color} strokeWidth="9" strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" transform="rotate(-90 52 52)" />
    </svg>
  );
}
