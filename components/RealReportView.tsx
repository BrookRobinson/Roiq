"use client";

import { useState, useMemo, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { PropertyTab } from "@/components/PropertyTab/PropertyTab";
import { HoldPeriodProvider, useHoldPeriod, urgencyScoreToYears } from "@/lib/hold-period/context";
import { HoldPeriodSlider } from "@/components/HoldPeriodSlider";
import { ReportGapBanner } from "@/components/ReportGapBanner";
import type { ReportGap } from "@/lib/property-tab/gaps";
import { urgencyColor } from "@/lib/property-tab/types";
import type { SubItem } from "@/lib/property-tab/types";
import type { StoredReport, DocAnalysis } from "@/lib/report-store";
import { loadReportPersona, saveReportPersona, saveReportDocs } from "@/lib/report-store";
import { scoreFor, improvementsCategories } from "@/lib/scoring/report";
import { PropertyInspections } from "@/components/PropertyInspections/PropertyInspections";
import {
  projectValue, cumulativeGrowthPct, grossYieldPct, netYieldPct, estimateAnnualCosts, vacancyRisk,
} from "@/lib/scoring/investment";
import type { CapitalGrowth, MarketRent } from "@/lib/scoring/investment";
import type { ScoreResult } from "@/lib/scoring/engine";
import type { Persona, Inspection } from "@/lib/scoring/model";
import {
  INSPECTION_ORDER,
  INSPECTION_META,
  ITEM_BY_ID,
  categoryKeys,
  isVerifiedDocItem,
} from "@/lib/scoring/catalog";
import {
  Home, Building2, Wrench, Calculator, ClipboardList, Shield,
  ExternalLink, AlertTriangle, ImageIcon, Info, Sparkles, ShieldAlert,
  TrendingUp, Zap, Percent,
} from "lucide-react";

type Tab = "overview" | "improvements" | "property" | "renovations" | "financial" | "healthyhomes";

const TAB_DEFS: { id: Tab; label: string; icon: React.ElementType; investorOnly?: boolean }[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "improvements", label: "Improvements", icon: Building2 },
  { id: "property", label: "Property", icon: ClipboardList },
  { id: "renovations", label: "Renovations", icon: Wrench },
  { id: "financial", label: "Financial", icon: Calculator },
  { id: "healthyhomes", label: "Healthy Homes", icon: Shield, investorOnly: true },
];

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;
const inspOf = (id: string): Inspection | undefined => ITEM_BY_ID[id]?.inspection;
const isImprovement = (s: SubItem) => inspOf(s.id) === "improvements";

// Indicative weekly rent uplift (investor only) when a flagged item is renovated.
const RENT_UPLIFT: Record<string, number> = {
  kit_cabinetry: 35, kit_appliances: 18, kit_benchtop: 12, kit_flooring: 8,
  bath_shower: 25, bath_waterproof: 15, bath_vanity: 10, bath_flooring: 6,
  liv_heating: 25, liv_insulation: 22, liv_flooring: 15,
  bath_ventilation: 10, bath_hotwater: 10, bed_heating: 12,
};
const rentUplift = (id: string): number => RENT_UPLIFT[id] ?? 0;

// Short money: $1.40M / $43k / $900
const fmtShort = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (a >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
};

// Renovation include/exclude state: included=false → removed; customCost set → patch.
interface RenoToggle { included: boolean; customCost: number | null }
const lineMid = (l: { low: number; high: number }) => (l.low + l.high) / 2;
const lineCost = (l: { key: string; low: number; high: number }, t?: RenoToggle): number =>
  t && t.customCost != null ? t.customCost : lineMid(l);

/** Total of the toggled-on reno lines that fall within the hold period. */
function selectedRenoCost(
  lines: { key: string; low: number; high: number; urgencyYears: number }[],
  toggles: Record<string, RenoToggle>,
  withinHold: (years: number) => boolean
): number {
  return lines
    .filter((l) => withinHold(l.urgencyYears))
    .filter((l) => toggles[l.key]?.included !== false)
    .reduce((sum, l) => sum + lineCost(l, toggles[l.key]), 0);
}

export function RealReportView({ report }: { report: StoredReport }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [persona, setPersona] = useState<Persona>("buyer");

  // Default the toggle from the saved per-report choice (client-only).
  useEffect(() => {
    const saved = loadReportPersona(report.id);
    if (saved) setPersona(saved);
  }, [report.id]);

  // Verified legal documents (LIM / consent / EQC / title) read by Claude.
  const [verifiedDocs, setVerifiedDocs] = useState<Record<string, DocAnalysis>>(report.verifiedDocs ?? {});
  useEffect(() => { setVerifiedDocs(report.verifiedDocs ?? {}); }, [report.id, report.verifiedDocs]);

  // Effective scores: a verified document overrides the score for its item;
  // an unverified document item (LIM/consent/EQC) is excluded from the total
  // entirely until a document is uploaded.
  const effectiveSubItems = useMemo(
    () =>
      report.subItems.map((s) => {
        const v = verifiedDocs[s.id];
        if (v && v.docTypeConfirmed && v.score != null) return { ...s, score: v.score as typeof s.score };
        if (isVerifiedDocItem(s.id)) return { ...s, score: null as typeof s.score };
        return s;
      }),
    [report.subItems, verifiedDocs]
  );

  // THE SCORE: re-runs scoreProperty() for the chosen persona + verified docs.
  // Pure + instant — drives the dial, bars, grade, and gating. Recomputes the
  // moment a document is uploaded (auto-rescore).
  const scored: ScoreResult = useMemo(
    () => scoreFor({ subItems: effectiveSubItems, extraDwellings: report.extraDwellings, context: report.context }, persona),
    [persona, effectiveSubItems, report.extraDwellings, report.context]
  );

  function onPersonaToggle(next: Persona) {
    setPersona(next);
    saveReportPersona(report.id, next);
  }

  function onVerified(itemId: string, doc: DocAnalysis) {
    setVerifiedDocs((prev) => {
      const next = { ...prev, [itemId]: doc };
      saveReportDocs(report.id, next);
      return next;
    });
  }

  // Renovation include/exclude toggles (lifted so the header price + yield read
  // the same selection). Default: every line included at full cost.
  const [renoToggles, setRenoToggles] = useState<Record<string, RenoToggle>>({});
  const renoLines = useMemo(() => buildRenoLines(report.subItems), [report.subItems]);
  function setRenoToggle(key: string, patch: Partial<RenoToggle>) {
    setRenoToggles((prev) => ({
      ...prev,
      [key]: { included: prev[key]?.included ?? true, customCost: prev[key]?.customCost ?? null, ...patch },
    }));
  }

  // Healthy Homes is investor-only; bounce off it if the persona flips to buyer.
  const tabs = TAB_DEFS.filter((t) => !t.investorOnly || persona === "investor");
  useEffect(() => {
    if (persona === "buyer" && tab === "healthyhomes") setTab("overview");
  }, [persona, tab]);

  const { listing, subItems, gaps, photosAnalysed, model } = report;

  const bannerGaps: ReportGap[] = gaps.map((g, i) => ({
    id: `gap_${i}`,
    gapType: /photo/i.test(g.gapType) ? "missing_photo" : "missing_data",
    area: g.area,
    label: g.area,
    description: g.description,
    inAgentLetter: g.includedInAgentLetter,
    inLimLetter: g.includedInLimLetter,
    resolved: false,
  }));

  const facts = [
    listing.askingPrice ? fmt(listing.askingPrice) : listing.priceText,
    [listing.bedrooms && `${listing.bedrooms} bed`, listing.bathrooms && `${listing.bathrooms} bath`, listing.carParks && `${listing.carParks} car`].filter(Boolean).join(" · "),
    [listing.propertyType !== "unknown" ? listing.propertyType : null, listing.floorAreaSqm && `${listing.floorAreaSqm}m² floor`, listing.landAreaSqm && `${listing.landAreaSqm}m² land`].filter(Boolean).join(" · "),
    [listing.buildYear && `c.${listing.buildYear}`, listing.titleType !== "unknown" ? listing.titleType : null].filter(Boolean).join(" · "),
  ].filter(Boolean);

  return (
    <HoldPeriodProvider defaultYears={10}>
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
        <Navbar user={{ email: "jane@example.com" }} plan="starter" />

        {/* Header */}
        <div className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                  <a href="/dashboard" className="hover:underline" style={{ color: "var(--text-muted)" }}>← Dashboard</a>
                  <span>·</span>
                  <a href={listing.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: "var(--brand)" }}>
                    {listing.portal} <ExternalLink size={11} />
                  </a>
                  <span>·</span>
                  <span className="flex items-center gap-1" style={{ color: "var(--brand)" }}>
                    <Sparkles size={11} /> live analysis
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                  {listing.address ?? "Address not found"}
                </h1>
                <div className="flex items-center flex-wrap gap-2 mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {[listing.suburb, listing.region ?? listing.city].filter(Boolean).join(", ")}
                  {facts.map((f, i) => (<span key={i}><span className="mx-1">·</span>{f}</span>))}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1"><ImageIcon size={12} /> {listing.photoUrls.length} found · {photosAnalysed} analysed</span>
                  <span className="mono">{model}</span>
                  {(!listing.scrapedOk || photosAnalysed === 0) && (
                    <span style={{ color: "#fb923c" }}>⚠ scrape partial — leans Tier 3</span>
                  )}
                </div>
              </div>

              {/* Quality score + predicted future sale price (replaces VFM grade) */}
              <div className="text-right flex-shrink-0">
                <div className="text-4xl font-bold mono leading-none" style={{ color: "var(--brand)" }}>
                  {scored.total}
                  <span className="text-base font-normal" style={{ color: "var(--text-muted)" }}> /1,000</span>
                </div>
                <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  quality score · base {scored.base}{scored.dwellingBonus > 0 ? ` + ${scored.dwellingBonus}` : ""}
                </div>
                <FutureSalePrice askingPrice={listing.askingPrice} capitalGrowth={report.capitalGrowth} renoLines={renoLines} renoToggles={renoToggles} align="right" />
              </div>
            </div>

            {/* Persona toggle */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Scoring as:</span>
              <div className="flex rounded-lg p-0.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                {([["buyer", "Home Buyer"], ["investor", "Investor"]] as const).map(([m, label]) => (
                  <button key={m} onClick={() => onPersonaToggle(m)} className="px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all"
                    style={{ background: persona === m ? "var(--bg)" : "transparent", color: persona === m ? "var(--text-primary)" : "var(--text-secondary)", boxShadow: persona === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Re-weights all 1,000 points for your goal — instantly.
              </span>
            </div>

            <div className="mb-4"><HoldPeriodSlider /></div>
            {bannerGaps.length > 0 && <ReportGapBanner gaps={bannerGaps} />}

            {/* Tabs */}
            <div className="flex gap-0 overflow-x-auto -mb-px">
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap cursor-pointer border-b-2 transition-colors"
                  style={{ color: tab === t.id ? "var(--brand)" : "var(--text-secondary)", borderBottomColor: tab === t.id ? "var(--brand)" : "transparent" }}>
                  <t.icon size={14} />{t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {tab === "overview" && <OverviewReal report={report} subItems={effectiveSubItems} scored={scored} persona={persona} renoLines={renoLines} renoToggles={renoToggles} />}
          {tab === "improvements" && <PropertyTab data={{ categories: improvementsCategories(subItems), extraDwellings: report.extraDwellings, overallScore: scored.total }} />}
          {tab === "property" && <PropertyInspections scored={scored} subItems={subItems} onSeeRenovations={() => setTab("renovations")} verifiedDocs={verifiedDocs} onVerified={onVerified} />}
          {tab === "renovations" && <RenovationsReal renoLines={renoLines} renoToggles={renoToggles} setRenoToggle={setRenoToggle} persona={persona} />}
          {tab === "financial" && <FinancialReal listing={listing} persona={persona} />}
          {tab === "healthyhomes" && <HealthyHomesReal buildYear={listing.buildYear} subItems={subItems} />}
        </div>

        <Disclaimer url={listing.url} />
      </div>
    </HoldPeriodProvider>
  );
}

// ── Score dial ────────────────────────────────────────────────────────────────
function ScoreDial({ total, base }: { total: number; base: number }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  const frac = Math.min(1, total / 1050);
  const dash = circ * frac;
  const color = base >= 800 ? "#00e676" : base >= 650 ? "#00d4c8" : base >= 450 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="flex-shrink-0">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" transform="rotate(-90 60 60)" />
      <text x="60" y="56" textAnchor="middle" className="mono" style={{ fontSize: 26, fontWeight: 700, fill: "var(--text-primary)" }}>{total}</text>
      <text x="60" y="74" textAnchor="middle" style={{ fontSize: 10, fill: "var(--text-muted)" }}>/ 1,000</text>
    </svg>
  );
}

// ── Predicted future sale price (replaces VFM grade) ──────────────────────────
function FutureSalePrice({
  askingPrice, capitalGrowth, renoLines, renoToggles, align = "right",
}: {
  askingPrice: number | null;
  capitalGrowth?: CapitalGrowth;
  renoLines: RenoLine[];
  renoToggles: Record<string, RenoToggle>;
  align?: "right" | "left";
}) {
  const { holdYears, withinHold } = useHoldPeriod();
  if (!askingPrice) return <div className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>Add a price for a sale estimate</div>;
  const indicative = capitalGrowth?.annualRatePct == null;
  const rate = capitalGrowth?.annualRatePct ?? 3.5;
  const reno = selectedRenoCost(renoLines, renoToggles, withinHold);
  const grown = projectValue(askingPrice, rate, holdYears);
  const predicted = grown - reno;
  const cumPct = cumulativeGrowthPct(rate, holdYears);
  return (
    <div className={`mt-1.5 ${align === "right" ? "text-right" : ""}`}>
      <div className="text-lg font-bold mono leading-tight" style={{ color: predicted >= askingPrice ? "#00e676" : "var(--text-primary)" }}>
        Est. {fmtShort(predicted)} <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>in {holdYears} yrs</span>
      </div>
      <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
        {fmtShort(askingPrice)} + {cumPct.toFixed(0)}% growth{reno > 0 ? ` − ${fmtShort(reno)} reno` : ""}{indicative ? " · indicative" : ""}
      </div>
    </div>
  );
}

// ── Capital growth panel (all users) ──────────────────────────────────────────
function CapitalGrowthPanel({ capitalGrowth, askingPrice }: { capitalGrowth?: CapitalGrowth; askingPrice: number | null }) {
  if (!capitalGrowth || !askingPrice) return null;
  const rate = capitalGrowth.annualRatePct;
  const proj = (yrs: number) => ({ label: `${yrs}-year`, year: 2026 + yrs, value: projectValue(askingPrice, rate, yrs), pct: cumulativeGrowthPct(rate, yrs) });
  const projections = [proj(5), proj(10)];
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp size={16} style={{ color: "#00e676" }} />
        <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Capital growth</h3>
        <span className="text-xs px-1.5 py-0.5 rounded mono" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{rate}% p.a. trend</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 my-4">
        {projections.map((p) => (
          <div key={p.label} className="rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{p.label} · by {p.year}</div>
            <div className="text-xl font-bold mono" style={{ color: "var(--text-primary)" }}>Est. {fmtShort(p.value)}</div>
            <div className="text-xs font-semibold" style={{ color: "#00e676" }}>+{p.pct.toFixed(0)}%</div>
          </div>
        ))}
      </div>
      <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>{capitalGrowth.why}</p>
      {capitalGrowth.recentNote && <p className="text-xs mt-2" style={{ color: "#fbbf24" }}>⚠ {capitalGrowth.recentNote}</p>}
      <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>Source: {capitalGrowth.source}</p>
    </div>
  );
}

// ── Investor Rating panel (investor only) — yield + growth, separate from the
//    1,000-pt quality score (panels approach). ─────────────────────────────────
function InvestorRatingPanel({
  askingPrice, marketRent, renoLines, renoToggles, growthScore, qualityBase,
}: {
  askingPrice: number | null;
  marketRent?: MarketRent;
  renoLines: RenoLine[];
  renoToggles: Record<string, RenoToggle>;
  growthScore: number | null;
  qualityBase: number;
}) {
  const { withinHold } = useHoldPeriod();
  const [override, setOverride] = useState<string>("");
  if (!askingPrice) return <div className="card p-5 text-sm" style={{ color: "var(--text-secondary)" }}>Enter a purchase price to calculate yield.</div>;

  const weekly = override !== "" ? Number(override) : marketRent?.weekly ?? null;
  const reno = selectedRenoCost(renoLines, renoToggles, withinHold);
  const totalInvestment = askingPrice + reno;

  if (weekly == null || !Number.isFinite(weekly) || weekly <= 0) {
    return (
      <div className="card p-5" style={{ border: "1px solid var(--border)" }}>
        <h3 className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Investor rating</h3>
        <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>Enter an estimated weekly rent to calculate yield (no market-rent figure on file).</p>
        <input type="number" value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Weekly rent $" className="rounded-lg px-3 py-2 text-sm w-40" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      </div>
    );
  }

  const gross = grossYieldPct(weekly, totalInvestment);
  const annualCosts = estimateAnnualCosts(askingPrice, weekly);
  const net = netYieldPct(weekly, totalInvestment, annualCosts);
  const vac = vacancyRisk(growthScore);
  const strong = gross >= 6;
  const lowCondition = qualityBase < 660;
  const rating = gross >= 6.5 ? { label: "Strong", c: "#00e676" } : gross >= 4.5 ? { label: "Moderate", c: "#fbbf24" } : { label: "Modest", c: "#ff5f5f" };

  return (
    <div className="card p-5" style={{ border: `1px solid ${rating.c}33` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Percent size={16} style={{ color: rating.c }} />
          <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Investor rating</h3>
        </div>
        <span className="text-sm font-bold px-2.5 py-1 rounded-full" style={{ background: `${rating.c}1a`, color: rating.c }}>{rating.label} yield</span>
      </div>

      {strong && lowCondition && (
        <div className="rounded-lg p-3 mb-4 flex items-start gap-2 text-sm" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)" }}>
          <Zap size={15} className="mt-0.5 flex-shrink-0" style={{ color: "#fbbf24" }} />
          <span style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "#fbbf24" }}>High-yield property</strong> — {gross.toFixed(1)}% gross return may offset the lower condition score ({qualityBase}/1,000). Weigh cashflow against the repair list.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Metric label="Gross yield" value={`${gross.toFixed(1)}%`} color={rating.c} />
        <Metric label="Net yield" value={`${net.toFixed(1)}%`} sub="after rates, ins, PM" />
        <Metric label="Total invested" value={fmtShort(totalInvestment)} sub={reno > 0 ? `incl. ${fmtShort(reno)} reno` : "no reno added"} />
        <Metric label="Vacancy risk" value={vac.label} color={vac.color} />
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Weekly rent</span>
        <input type="number" value={override} onChange={(e) => setOverride(e.target.value)} placeholder={String(marketRent?.weekly ?? "")} className="rounded-lg px-2 py-1 text-sm w-24 mono" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          /wk{override === "" && marketRent ? ` · ${marketRent.source}${marketRent.isEstimate ? " (estimate)" : ""}` : " · your figure"}
        </span>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-xl font-bold mono" style={{ color: color || "var(--text-primary)" }}>{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{sub}</div>}
    </div>
  );
}

// ── Inspection + category breakdowns (driven by the scored result) ────────────
function InspectionBars({ scored }: { scored: ScoreResult }) {
  return (
    <div className="space-y-3">
      {INSPECTION_ORDER.map((insp) => {
        const v = scored.byInspection[insp];
        const meta = INSPECTION_META[insp];
        const col = v.pct >= 80 ? "#00e676" : v.pct >= 55 ? "#fbbf24" : "#ff5f5f";
        return (
          <div key={insp} className="flex items-center gap-3">
            <div className="w-36 text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
              <span>{meta.icon}</span>{meta.label}
            </div>
            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${v.pct}%`, background: col }} />
            </div>
            <div className="w-20 text-right text-xs mono" style={{ color: "var(--text-secondary)" }}>{v.earned}/{v.max}</div>
          </div>
        );
      })}
    </div>
  );
}

function CategoryBars({ scored }: { scored: ScoreResult }) {
  const rows = categoryKeys()
    .map((c) => ({ ...c, v: scored.byCategory[c.key] }))
    .filter((c) => c.v && c.v.max > 0);
  return (
    <div className="space-y-2.5">
      {rows.map((c) => {
        const col = c.v.pct >= 80 ? "#00e676" : c.v.pct >= 55 ? "#fbbf24" : "#ff5f5f";
        return (
          <div key={c.key} className="flex items-center gap-3">
            <div className="w-44 text-xs flex items-center gap-1.5 truncate" style={{ color: "var(--text-secondary)" }}>
              <span style={{ color: "var(--text-muted)" }}>{INSPECTION_META[c.inspection].icon}</span>
              <span className="truncate">{c.category}</span>
            </div>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.v.pct}%`, background: col }} />
            </div>
            <div className="w-10 text-right text-xs mono" style={{ color: "var(--text-muted)" }}>{c.v.pct}%</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────
function OverviewReal({ report, subItems, scored, persona, renoLines, renoToggles }: {
  report: StoredReport; subItems: SubItem[]; scored: ScoreResult; persona: Persona;
  renoLines: RenoLine[]; renoToggles: Record<string, RenoToggle>;
}) {
  const subs = subItems;
  const growthScore = subs.find((s) => s.id === "loc_growth")?.score ?? null;
  const tally = {
    critical: subs.filter((s) => s.score !== null && s.score <= 2).length,
    urgent: subs.filter((s) => s.score !== null && s.score >= 3 && s.score <= 4).length,
    monitor: subs.filter((s) => s.score !== null && s.score >= 5 && s.score <= 7).length,
    good: subs.filter((s) => s.score !== null && s.score >= 8).length,
    unscored: subs.filter((s) => s.score === null).length,
  };
  const repairs = subs
    .filter((s) => isImprovement(s) && ITEM_BY_ID[s.id]?.costBearing && s.score !== null && s.score <= 4)
    .sort((a, b) => (a.score ?? 9) - (b.score ?? 9));
  const risks = subs
    .filter((s) => !isImprovement(s) && s.score !== null && s.score <= 4)
    .sort((a, b) => (a.score ?? 9) - (b.score ?? 9));

  return (
    <div className="space-y-6">
      {/* Score hero — dial + grade + inspection breakdown */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <ScoreDial total={scored.total} base={scored.base} />
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Quality score</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              base {scored.base}{scored.dwellingBonus > 0 ? ` + ${scored.dwellingBonus} bonus` : ""}
            </div>
            <FutureSalePrice askingPrice={report.listing.askingPrice} capitalGrowth={report.capitalGrowth} renoLines={renoLines} renoToggles={renoToggles} align="left" />
          </div>
        </div>
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-secondary)" }}>Inspection breakdown</h3>
          <InspectionBars scored={scored} />
        </div>
      </div>

      {/* Investor Rating (investor only) — separate from the 1,000-pt quality score */}
      {persona === "investor" && (
        <InvestorRatingPanel
          askingPrice={report.listing.askingPrice}
          marketRent={report.marketRent}
          renoLines={renoLines}
          renoToggles={renoToggles}
          growthScore={growthScore}
          qualityBase={scored.base}
        />
      )}

      {/* Capital growth — all users */}
      <CapitalGrowthPanel capitalGrowth={report.capitalGrowth} askingPrice={report.listing.askingPrice} />

      {/* Tally */}
      <div className="grid sm:grid-cols-5 gap-3">
        {[
          { label: "Critical", v: tally.critical, c: "#ff5f5f" },
          { label: "Urgent", v: tally.urgent, c: "#fb923c" },
          { label: "Monitor", v: tally.monitor, c: "#fbbf24" },
          { label: "Good", v: tally.good, c: "#00e676" },
          { label: "Not assessed", v: tally.unscored, c: "var(--text-muted)" },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-2xl font-bold mono" style={{ color: s.c }}>{s.v}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Priority repairs */}
      {repairs.length > 0 && (
        <div className="card p-5" style={{ border: "1px solid rgba(255,95,95,0.2)" }}>
          <div className="flex items-center gap-2 font-semibold text-sm mb-3" style={{ color: "#ff5f5f" }}>
            <AlertTriangle size={15} /> Priority repairs — act before making an offer
          </div>
          <div className="space-y-2">
            {repairs.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</span>
                  <span style={{ color: "var(--text-secondary)" }}> — {s.urgencyLabel}</span>
                </div>
                {s.estimatedReplacementCost && (
                  <span className="text-xs mono flex-shrink-0" style={{ color: "var(--brand)" }}>
                    {fmt(s.estimatedReplacementCost.low)}–{fmt(s.estimatedReplacementCost.high)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk flags — Location / Land / Legal */}
      {risks.length > 0 && (
        <div className="card p-5" style={{ border: "1px solid rgba(251,146,60,0.2)" }}>
          <div className="flex items-center gap-2 font-semibold text-sm mb-3" style={{ color: "#fb923c" }}>
            <ShieldAlert size={15} /> Risk flags — investigate during due diligence
          </div>
          <div className="space-y-2.5">
            {risks.map((s) => (
              <div key={s.id} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                    {INSPECTION_META[inspOf(s.id)!].label}
                  </span>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</span>
                  <span style={{ color: "var(--text-secondary)" }}>· {s.urgencyLabel}</span>
                </div>
                {s.aiSummary && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.aiSummary}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      <div className="card p-5">
        <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Category scores</h3>
        <CategoryBars scored={scored} />
      </div>

      {report.extraDwellings.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Extra dwellings ({report.extraDwellings.length}) · +{scored.dwellingBonus} bonus pts
          </h3>
          {report.extraDwellings.map((d) => (
            <p key={d.id} className="text-sm" style={{ color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--text-primary)" }}>{d.type}</strong> — {d.condition} · {fmt(d.estimatedReplacementCost.low)}–{fmt(d.estimatedReplacementCost.high)} ({d.consentStatus})
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Renovations ──────────────────────────────────────────────────────────────
interface RenoLine {
  key: string;
  name: string;
  detail: string;
  badge?: string; // inspection label for remediation items
  low: number;
  high: number;
  urgencyYears: number;
  detailColor: string;
  uplift: number;
  notes?: string;
}

// Unified renovation list: Improvement replacement costs + Location/Land/Legal
// remediation line items, both obeying the hold-period rule.
function buildRenoLines(subItems: SubItem[]): RenoLine[] {
  const lines: RenoLine[] = [];
  for (const s of subItems) {
    if (isImprovement(s) && (s.renovationLink || (s.score !== null && s.score <= 6)) && s.estimatedReplacementCost) {
      const col = urgencyColor(s.score);
      lines.push({
        key: s.id,
        name: s.name,
        detail: s.urgencyLabel,
        low: s.estimatedReplacementCost.low,
        high: s.estimatedReplacementCost.high,
        urgencyYears: urgencyScoreToYears(s.score),
        detailColor: col === "red" ? "#ff5f5f" : col === "amber" ? "#fbbf24" : "#00e676",
        uplift: rentUplift(s.id),
        notes: s.estimatedReplacementCost.notes || undefined,
      });
    }
    if (s.remediation) {
      const insp = ITEM_BY_ID[s.id]?.inspection;
      lines.push({
        key: s.id + "_rem",
        name: s.remediation.renovationLineItem,
        detail: s.remediation.description,
        badge: insp ? INSPECTION_META[insp].label : undefined,
        low: s.remediation.low,
        high: s.remediation.high,
        urgencyYears: s.remediation.urgencyYears,
        detailColor: "var(--brand)",
        uplift: 0,
        notes: undefined,
      });
    }
  }
  return lines;
}

function RenovationsReal({ renoLines, renoToggles, setRenoToggle, persona }: {
  renoLines: RenoLine[];
  renoToggles: Record<string, RenoToggle>;
  setRenoToggle: (key: string, patch: Partial<RenoToggle>) => void;
  persona: Persona;
}) {
  const { withinHold, holdYears } = useHoldPeriod();
  const items = renoLines.filter((l) => withinHold(l.urgencyYears));
  const deferred = renoLines.length - items.length;
  const total = selectedRenoCost(renoLines, renoToggles, withinHold);
  const isOn = (key: string) => renoToggles[key]?.included !== false;
  const selectedCount = items.filter((l) => isOn(l.key)).length;
  const upliftTotal = persona === "investor" ? items.filter((l) => isOn(l.key)).reduce((sum, l) => sum + l.uplift, 0) : 0;

  if (renoLines.length === 0) {
    return <div className="card p-6 text-sm" style={{ color: "var(--text-secondary)" }}>No renovation or remediation items flagged from the analysis — the property scored well across assessed items.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Within your {holdYears}-year hold</div>
          <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{selectedCount} of {items.length} selected</div>
          {deferred > 0 && <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{deferred} more beyond the hold period (hidden)</div>}
        </div>
        {persona === "investor" && upliftTotal > 0 && (
          <div className="text-right">
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Est. rent uplift</div>
            <div className="text-2xl font-bold mono" style={{ color: "#00e676" }}>+{fmt(upliftTotal)}<span className="text-sm">/wk</span></div>
          </div>
        )}
        <div className="text-right">
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Budget — feeds yield + sale price</div>
          <div className="text-2xl font-bold mono" style={{ color: "var(--brand)" }}>{fmt(total)}</div>
        </div>
      </div>
      {items.map((l) => {
        const t = renoToggles[l.key];
        const included = t?.included !== false;
        const custom = t?.customCost ?? null;
        return (
          <div key={l.key} className="card p-4" style={{ opacity: included ? 1 : 0.55, transition: "opacity 0.15s" }}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={included} onChange={(e) => setRenoToggle(l.key, { included: e.target.checked })} className="mt-1 w-4 h-4 cursor-pointer flex-shrink-0" aria-label={`Include ${l.name}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{l.name}</span>
                  {l.badge && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(0,212,200,0.1)", color: "var(--brand)" }}>{l.badge} remedy</span>}
                  {!included && <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>removed</span>}
                </div>
                <div className="text-xs mt-0.5" style={{ color: l.detailColor }}>{l.detail}</div>
                {l.notes && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{l.notes}</p>}
                {included && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Patch instead of replace?</span>
                    <span className="text-xs mono" style={{ color: "var(--text-muted)" }}>$</span>
                    <input type="number" value={custom ?? ""} placeholder={String(Math.round(lineMid(l)))}
                      onChange={(e) => setRenoToggle(l.key, { customCost: e.target.value === "" ? null : Number(e.target.value) })}
                      className="rounded px-2 py-0.5 text-xs w-24 mono" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                    {custom != null && <button onClick={() => setRenoToggle(l.key, { customCost: null })} className="text-xs cursor-pointer" style={{ color: "var(--brand)" }}>reset to full</button>}
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold mono" style={{ color: included ? "var(--brand)" : "var(--text-muted)" }}>
                  {custom != null ? fmt(custom) : `${fmt(l.low)}–${fmt(l.high)}`}
                </div>
                {custom != null && <div className="text-[10px] mono" style={{ color: "var(--text-muted)" }}>was {fmt(l.low)}–{fmt(l.high)}</div>}
                {persona === "investor" && included && l.uplift > 0 && (
                  <div className="text-xs mono mt-0.5" style={{ color: "#00e676" }}>+${l.uplift}/wk</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Toggle items off to remove them, or enter a cheaper &quot;patch&quot; cost — the budget updates live and feeds the predicted sale price and the investor yield.
        {persona === "investor" && " Rent-uplift figures are indicative typical-market estimates."}
      </p>
    </div>
  );
}

// ── Financial (basic, from real price) ───────────────────────────────────────
function FinancialReal({ listing, persona }: { listing: StoredReport["listing"]; persona: Persona }) {
  const price = listing.askingPrice;
  if (!price) {
    return <div className="card p-6 text-sm" style={{ color: "var(--text-secondary)" }}>The listing price wasn&apos;t available ({listing.priceText ?? "price by negotiation"}), so financials can&apos;t be calculated. Enter a price manually once the full calculator is wired.</div>;
  }
  const depositPct = persona === "investor" ? 0.35 : 0.2;
  const deposit = price * depositPct;
  const loan = price - deposit;
  const r = 0.065 / 52, n = 30 * 52;
  const weekly = (loan * r) / (1 - Math.pow(1 + r, -n));
  const years = 10, growth = 0.05;
  const futureValue = price * Math.pow(1 + growth, years);
  const equity = futureValue - loan;

  const rows = [
    ["Purchase price", fmt(price)],
    [`Deposit (${Math.round(depositPct * 100)}%)`, fmt(deposit)],
    ["Loan", fmt(loan)],
    ["Weekly mortgage (P&I, 6.5%, 30yr)", fmt(weekly) + "/wk"],
    [`Projected value at ${years}yr (5% p.a.)`, fmt(futureValue)],
    ["Indicative equity at hold", fmt(equity)],
  ];

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-semibold mb-4 capitalize" style={{ color: "var(--text-primary)" }}>Quick numbers — {persona === "investor" ? "Investor" : "Home Buyer"}</h3>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-2.5 text-sm">
              <span style={{ color: "var(--text-secondary)" }}>{k}</span>
              <span className="font-semibold mono" style={{ color: "var(--text-primary)" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      {persona === "investor" && (
        <div className="card p-4 text-sm flex items-start gap-2" style={{ color: "var(--text-secondary)" }}>
          <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          Rental yield and cashflow need suburb median-rent data, which isn&apos;t wired yet — coming with the market-data integration.
        </div>
      )}
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Indicative only, using default assumptions ({Math.round(depositPct * 100)}% deposit, 6.5% rate, 30-year P&I, 5% growth). The full adjustable calculator with renovation integration is a later build.
      </p>
    </div>
  );
}

// (The old Hazard tab is retired — Land/Legal now live in the Property tab,
//  rendered with full depth by components/PropertyInspections.)

// ── Healthy Homes (investor only — build-era + flagged items) ────────────────
function HealthyHomesReal({ buildYear, subItems }: { buildYear: number | null; subItems: SubItem[] }) {
  const hhFlagged = subItems.filter((s) => ITEM_BY_ID[s.id]?.affectsHealthyHomes);
  const era = !buildYear
    ? { v: "Unknown", d: "Build year unconfirmed — a certified Healthy Homes assessment is recommended before tenanting." }
    : buildYear >= 2019 ? { v: "Likely compliant", d: "Built to modern code — confirm heating capacity and R-values." }
    : buildYear >= 2008 ? { v: "Probably compliant", d: "Confirm insulation R-values and extractor ducting." }
    : buildYear >= 2000 ? { v: "Risk — verify", d: "May be below current standard; assessment recommended." }
    : buildYear >= 1978 ? { v: "Risk — verify", d: "Likely below current insulation/heating standard." }
    : { v: "Likely non-compliant", d: "Pre-1978 — budget for insulation, fixed heating, ventilation, and draught-stopping remediation." };

  const standards = ["Heating (fixed, ≥1.5kW, main living room)", "Insulation (ceiling + underfloor)", "Ventilation (extractors ducted outside)", "Moisture & drainage (gutters, ground barrier)", "Draught stopping"];

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Build-era indication</h3>
          <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ background: "var(--brand-light)", color: "var(--brand)" }}>{era.v}</span>
        </div>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>{era.d}</p>
      </div>

      {hhFlagged.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Items relevant to the standards</h3>
          <div className="space-y-3">
            {hhFlagged.map((s) => {
              const col = urgencyColor(s.score);
              const colHex = col === "red" ? "#ff5f5f" : col === "amber" ? "#fbbf24" : col === "green" ? "#00e676" : "var(--text-muted)";
              return (
                <div key={s.id} className="flex items-start gap-3">
                  <div className="w-12 flex-shrink-0 text-center">
                    <span className="text-sm font-bold mono" style={{ color: colHex }}>{s.score ?? "—"}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>/10</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</div>
                    {s.aiSummary && <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{s.aiSummary}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card p-5">
        <h3 className="font-semibold mb-3" style={{ color: "var(--text-primary)" }}>The 5 standards</h3>
        <ul className="space-y-2">
          {standards.map((s) => (
            <li key={s} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <Shield size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />{s}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Indicative only — a full per-standard assessment with remediation costs is a later build. Engage a certified assessor before renting.
      </p>
    </div>
  );
}

function Disclaimer({ url }: { url: string }) {
  return (
    <div className="border-t px-4 py-4 text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}>
      AI analysis of publicly available listing data and photos. Not a registered valuation or building inspection. Verify all material facts before making an offer.{" "}
      <a href={url} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>View original listing →</a>
    </div>
  );
}
