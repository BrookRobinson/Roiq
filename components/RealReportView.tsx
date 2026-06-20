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
import { MANDATORY_CATEGORIES, categoryLabel } from "@/lib/photo-categories";
import {
  projectValue, cumulativeGrowthPct, grossYieldPct, netYieldPct, estimateAnnualCosts, vacancyRisk,
  qualityMultiplier, roiqFairValue,
} from "@/lib/scoring/investment";
import type { CapitalGrowth, MarketRent, SuburbValue } from "@/lib/scoring/investment";
import { costThreeTier, tierTotal, TIER_ORDER, scaleTier, isScalableKind } from "@/lib/reno-costing/three-tier";
import type { ThreeTierCost, TierCost, Tier, LabourMode } from "@/lib/reno-costing/three-tier";
import { RenoVisualiser } from "@/components/RenoVisualiser";
import { visualKindFor } from "@/lib/visualiser";
import { summarise, defaultInputs, FINANCE_DEFAULTS, PURCHASE_COST_LABELS } from "@/lib/finance/calculator";
import type { FinanceInputs, LoanType, PurchaseCostKey } from "@/lib/finance/calculator";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
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
  TrendingUp, Zap, Percent, ChevronDown, RefreshCw, Loader2, ArrowRight,
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

// Renovation selection state per line:
//   included=false → removed from the budget
//   tier → "patch" | "budget" | "premium" (default "budget")
//   labour → "diy" (materials only) | "tradie" (adds labour); default per tier
interface RenoToggle { included: boolean; tier: Tier; labour: LabourMode; affectedPct?: number }

/** Fraction (0–1) of the property this line affects — only AREA/LINEAR items scale. */
const lineFrac = (c: ThreeTierCost | undefined, t?: RenoToggle): number =>
  c && isScalableKind(c.kind) ? (t?.affectedPct ?? 100) / 100 : 1;
const lineMid = (l: { low: number; high: number }) => (l.low + l.high) / 2;

// Effective cost for a line: chosen tier total under the chosen labour mode.
const lineCost = (l: { costing?: ThreeTierCost; low: number; high: number }, t?: RenoToggle): number => {
  const c = l.costing;
  if (!c) return lineMid(l);
  const tier: Tier = t?.tier ?? "budget";
  const labour: LabourMode = t?.labour ?? c[tier].defaultLabour;
  return tierTotal(scaleTier(c[tier], lineFrac(c, t)), labour);
};

/** Total of the toggled-on reno lines that fall within the hold period. */
function selectedRenoCost(
  lines: { key: string; costing?: ThreeTierCost; low: number; high: number; urgencyYears: number }[],
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
  const [continuedWithoutPhotos, setContinuedWithoutPhotos] = useState(false);

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
  // No photos at all → we cannot visually confirm ANY Improvements condition, so
  // we must not show a score for those items (a scraped 0-photo listing was giving
  // "Roof 5/10" with nothing to look at). Location/Land/Legal are fact-based and
  // keep their scores.
  const noPhotos = report.photosAnalysed === 0;
  const effectiveSubItems = useMemo(
    () =>
      report.subItems.map((s) => {
        const v = verifiedDocs[s.id];
        if (v && v.docTypeConfirmed && v.score != null) return { ...s, score: v.score as typeof s.score };
        if (isVerifiedDocItem(s.id)) return { ...s, score: null as typeof s.score };
        if (noPhotos && isImprovement(s)) return { ...s, score: null as typeof s.score, noPhotoNotAssessed: true };
        // A 1-10 *condition* score must be backed by a photo of that element. When an
        // Improvements item is Tier 3 ("not visible — inferred") the number is pure
        // build-era guesswork (e.g. a foundation that isn't in any photo) → drop the
        // score to "Not assessed". The AI reasoning + "Not visible — inferred" badge
        // stay, so the inferred risk is still explained, just not scored. (Location /
        // Land / Legal are fact-based and are meant to be inferred + scored.)
        if (isImprovement(s) && s.confidenceTier === 3) return { ...s, score: null as typeof s.score };
        return s;
      }),
    [report.subItems, verifiedDocs, noPhotos]
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
  const renoLines = useMemo(() => buildRenoLines(report.subItems, report.listing), [report.subItems, report.listing]);
  function setRenoToggle(key: string, patch: Partial<RenoToggle>) {
    setRenoToggles((prev) => ({
      ...prev,
      [key]: {
        included: prev[key]?.included ?? true,
        tier: prev[key]?.tier ?? "budget",
        labour: prev[key]?.labour ?? "tradie",
        affectedPct: prev[key]?.affectedPct ?? 100,
        ...patch,
      },
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
                {listing.dataSource && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs rounded-md px-2 py-1" style={{ background: "rgba(0,212,200,0.08)", color: "var(--brand)", border: "1px solid var(--border)" }}>
                    <Info size={12} /> {listing.dataSource}
                  </div>
                )}
                {report.photoCoverage && (
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-xs">
                    <span style={{ color: report.photoCoverage.missingMandatory.length === 0 ? "var(--success)" : "#fb923c" }}>
                      {report.photoCoverage.missingMandatory.length === 0 ? "✅" : "⚠"} {MANDATORY_CATEGORIES.length - report.photoCoverage.missingMandatory.length} of {MANDATORY_CATEGORIES.length} required areas covered
                    </span>
                    {report.photoCoverage.missingOptional.length > 0 && (
                      <span style={{ color: "var(--text-muted)" }}>💡 {report.photoCoverage.missingOptional.length} optional areas not photographed</span>
                    )}
                  </div>
                )}
              </div>

              {/* Predicted future sale price. The 1,000-pt quality score is hidden —
                  it runs in the background and powers the Value Verdict on the
                  Financial tab. */}
              <div className="text-right flex-shrink-0">
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
                Re-weights the whole report for your goal — instantly.
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
          {noPhotos && !continuedWithoutPhotos && (
            <div className="card p-5 mb-6" style={{ border: "1px solid var(--brand)", background: "rgba(0,212,200,0.05)" }}>
              <div className="flex items-center gap-2 font-semibold text-base mb-1" style={{ color: "var(--text-primary)" }}>📷 No listing photos found</div>
              <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                We couldn&apos;t retrieve photos from this listing. TradeMe and some other portals block photo access. Without photos we can&apos;t give condition scores — only build-year risk flags. To get a full RoIQ report you have two options:
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <a href={`/report/upload?address=${encodeURIComponent(listing.address ?? "")}${listing.askingPrice ? `&price=${listing.askingPrice}` : ""}`}
                  className="btn-primary text-sm px-4 py-2">Upload photos manually <ArrowRight size={15} /></a>
                <button onClick={() => setContinuedWithoutPhotos(true)} className="btn-secondary text-sm px-4 py-2 cursor-pointer">Continue without photos</button>
              </div>
            </div>
          )}
          {report.photoCoverage && report.photoCoverage.missingOptional.length > 0 && (
            <div className="card p-4 mb-6" style={{ border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.06)" }}>
              <div className="text-sm font-semibold mb-1" style={{ color: "#fbbf24" }}>💡 Your report could be more accurate</div>
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                These areas weren&apos;t photographed: {report.photoCoverage.missingOptional.map(categoryLabel).join("  ·  ")}
              </div>
              <a href="/report/upload" className="text-xs mt-1.5 inline-block hover:underline" style={{ color: "var(--brand)" }}>Upload additional photos →</a>
            </div>
          )}
          {tab === "overview" && <OverviewReal report={report} subItems={effectiveSubItems} scored={scored} persona={persona} renoLines={renoLines} renoToggles={renoToggles} />}
          {tab === "improvements" && <PropertyTab data={{ categories: improvementsCategories(effectiveSubItems), extraDwellings: report.extraDwellings, overallScore: scored.total }} region={listing.region ?? listing.city ?? undefined} floorSqm={listing.floorAreaSqm} noPhotos={noPhotos} buildYear={listing.buildYear} />}
          {tab === "property" && <PropertyInspections scored={scored} subItems={subItems} onSeeRenovations={() => setTab("renovations")} verifiedDocs={verifiedDocs} onVerified={onVerified} />}
          {tab === "renovations" && <RenovationsReal renoLines={renoLines} renoToggles={renoToggles} setRenoToggle={setRenoToggle} persona={persona} listing={listing} />}
          {tab === "financial" && <FinanceTab listing={listing} persona={persona} marketRent={report.marketRent} capitalGrowth={report.capitalGrowth} renoLines={renoLines} renoToggles={renoToggles} score={scored.total} suburbValue={report.suburbValue} />}
          {tab === "healthyhomes" && <HealthyHomesReal buildYear={listing.buildYear} subItems={subItems} />}
        </div>

        <Disclaimer url={listing.url} />
      </div>
    </HoldPeriodProvider>
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
            <strong style={{ color: "#fbbf24" }}>High-yield property</strong> — {gross.toFixed(1)}% gross return may offset the property&apos;s lower condition. Weigh cashflow against the repair list.
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
            <div className="w-12 text-right text-xs mono" style={{ color: "var(--text-secondary)" }}>{v.pct}%</div>
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
      {/* Predicted value + condition breakdown (the 1,000-pt score is hidden — see
          the RoIQ Value Verdict on the Financial tab). */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 flex flex-col justify-center">
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Predicted sale value</div>
          <FutureSalePrice askingPrice={report.listing.askingPrice} capitalGrowth={report.capitalGrowth} renoLines={renoLines} renoToggles={renoToggles} align="left" />
          <div className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
            See the <strong style={{ color: "var(--brand)" }}>Financial</strong> tab for the RoIQ Value Verdict — whether the asking price is fair once renovations are factored in.
          </div>
        </div>
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-secondary)" }}>Condition by inspection area</h3>
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
            Extra dwellings ({report.extraDwellings.length})
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
  category?: string; // improvements category (e.g. "Bathroom", "Kitchen") — drives the visualiser
  photoRefs?: number[]; // listing photo numbers for this item's room
  costing?: ThreeTierCost; // Patch Up / Replace Budget / Replace High End
}

// Unified renovation list: Improvement replacement costs + Location/Land/Legal
// remediation line items, both obeying the hold-period rule.
function buildRenoLines(subItems: SubItem[], listing: StoredReport["listing"]): RenoLine[] {
  const lines: RenoLine[] = [];
  const ctx = {
    floorSqm: listing.floorAreaSqm ?? null,
    bedrooms: listing.bedrooms ?? null,
  };
  for (const s of subItems) {
    if (isImprovement(s) && (s.renovationLink || (s.score !== null && s.score <= 6)) && s.estimatedReplacementCost) {
      const col = urgencyColor(s.score);
      const category = ITEM_BY_ID[s.id]?.category;
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
        category,
        photoRefs: s.photoReferences,
        costing: costThreeTier({ id: s.id, name: s.name, category, ...ctx, fallback: { low: s.estimatedReplacementCost.low, high: s.estimatedReplacementCost.high } }),
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
        costing: costThreeTier({ id: s.id + "_rem", name: s.remediation.renovationLineItem, ...ctx, fallback: { low: s.remediation.low, high: s.remediation.high } }),
      });
    }
  }
  return lines;
}

// Itemised material + labour breakdown for one tier (the "See breakdown" view).
function TierBreakdown({ tier, labour }: { tier: TierCost; labour: LabourMode }) {
  const total = labour === "tradie" ? tier.tradieTotal : tier.diyTotal;
  return (
    <div className="mt-2 rounded-md p-2.5 space-y-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Materials</div>
      <ul className="space-y-0.5">
        {tier.materials.map((m, i) => (
          <li key={i} className="text-[11px] flex items-start justify-between gap-2">
            <span className="min-w-0" style={{ color: "var(--text-secondary)" }}>
              {m.description}<span style={{ color: "var(--text-muted)" }}> · {m.source}</span>
            </span>
            <span className="mono whitespace-nowrap flex-shrink-0" style={{ color: "var(--text-muted)" }}>{m.qty} × {fmt(m.unitPrice)} = {fmt(m.lineCost)}</span>
          </li>
        ))}
      </ul>
      <div className="text-[11px] mono flex items-center justify-between pt-1" style={{ borderTop: "1px solid var(--border)", color: "var(--text-secondary)" }}>
        <span>Materials subtotal</span><span>{fmt(tier.materialsCost)}</span>
      </div>
      {labour === "tradie" && tier.labour.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-wide pt-1" style={{ color: "var(--text-muted)" }}>Labour (Pay someone)</div>
          {tier.labour.map((l, i) => (
            <div key={i} className="text-[11px] mono flex items-center justify-between" style={{ color: "var(--text-secondary)" }}>
              <span>{l.working}</span><span>{fmt(l.cost)}</span>
            </div>
          ))}
        </>
      )}
      <div className="text-[12px] mono flex items-center justify-between pt-1 font-bold" style={{ borderTop: "1px solid var(--border)", color: "var(--text-primary)" }}>
        <span>Total</span><span>{fmt(total)}</span>
      </div>
      {!tier.itemised && <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Allowance estimate — no itemised parts list for this item type yet.</div>}
    </div>
  );
}

// Three-tier chooser: Patch Up / Replace Budget / Replace High End, each with a
// DIY vs Pay-someone toggle and a collapsible itemised breakdown.
function ThreeTier({ line, toggle, onTier, onLabour, onPct }: {
  line: RenoLine;
  toggle?: RenoToggle;
  onTier: (tier: Tier) => void;
  onLabour: (mode: LabourMode) => void;
  onPct: (pct: number) => void;
}) {
  const [open, setOpen] = useState<Tier | null>(null);
  const c = line.costing;
  if (!c) return <div className="text-sm mono mt-2" style={{ color: "var(--brand)" }}>{fmt(line.low)}–{fmt(line.high)}</div>;
  const selTier: Tier = toggle?.tier ?? "budget";
  const selLabour: LabourMode = toggle?.labour ?? c[selTier].defaultLabour;
  const scalable = isScalableKind(c.kind);
  const pct = scalable ? (toggle?.affectedPct ?? 100) : 100;
  const frac = pct / 100;
  const scaledQty = Math.round(c.quantity * frac * 10) / 10;
  return (
    <div className="mt-2.5">
      {scalable && (
        <div className="rounded-lg px-3 py-2 mb-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>% of property affected</span>
            <span className="text-xs font-bold mono px-1.5 py-0.5 rounded" style={{ color: "var(--brand)", background: "var(--brand-light)" }}>{pct}%</span>
          </div>
          <input type="range" min={10} max={100} step={5} value={pct}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onPct(Number(e.target.value))}
            className="w-full mt-1.5 cursor-pointer" style={{ accentColor: "var(--brand)" }}
            aria-label={`Percentage of ${line.name} affected`} />
          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {c.quantity}{c.quantityUnit} total × {pct}% = <span className="mono" style={{ color: "var(--text-secondary)" }}>{scaledQty}{c.quantityUnit}</span> to do
          </div>
        </div>
      )}
      <div className="grid md:grid-cols-3 gap-2">
        {TIER_ORDER.map((tk) => {
          const t = scaleTier(c[tk], frac);
          const active = selTier === tk;
          const labourMode: LabourMode = active ? selLabour : t.defaultLabour;
          const total = labourMode === "tradie" ? t.tradieTotal : t.diyTotal;
          return (
            <div key={tk} role="button" tabIndex={0} onClick={() => onTier(tk)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTier(tk); } }}
              className="rounded-lg p-2.5 cursor-pointer flex flex-col transition-colors"
              style={{ border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`, background: active ? "rgba(0,212,200,0.06)" : "var(--surface)" }}>
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{t.icon} {t.label}</span>
                <span className="text-sm font-bold mono" style={{ color: active ? "var(--brand)" : "var(--text-secondary)" }}>{fmt(total)}</span>
              </div>
              <p className="text-[11px] mt-1 flex-1" style={{ color: "var(--text-secondary)" }}>{t.scope}</p>
              <div className="flex items-center gap-1 mt-2">
                {(["diy", "tradie"] as LabourMode[]).map((m) => (
                  <button key={m} onClick={(e) => { e.stopPropagation(); onTier(tk); onLabour(m); }}
                    className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
                    style={{ background: labourMode === m ? "var(--brand)" : "var(--surface-2)", color: labourMode === m ? "#04110f" : "var(--text-muted)", border: "1px solid var(--border)" }}>
                    {m === "diy" ? "DIY" : "Pay someone"}
                  </button>
                ))}
              </div>
              <button onClick={(e) => { e.stopPropagation(); setOpen(open === tk ? null : tk); }}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] cursor-pointer self-start" style={{ color: "var(--brand)" }}>
                <ChevronDown size={11} style={{ transform: open === tk ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                {open === tk ? "Hide" : "See"} breakdown
              </button>
              {open === tk && <TierBreakdown tier={t} labour={labourMode} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RenovationsReal({ renoLines, renoToggles, setRenoToggle, persona, listing }: {
  renoLines: RenoLine[];
  renoToggles: Record<string, RenoToggle>;
  setRenoToggle: (key: string, patch: Partial<RenoToggle>) => void;
  persona: Persona;
  listing: StoredReport["listing"];
}) {
  const { withinHold, holdYears } = useHoldPeriod();
  const items = renoLines.filter((l) => withinHold(l.urgencyYears));
  const deferred = renoLines.length - items.length;
  const total = selectedRenoCost(renoLines, renoToggles, withinHold);
  const isOn = (key: string) => renoToggles[key]?.included !== false;
  const selected = items.filter((l) => isOn(l.key));
  const upliftTotal = persona === "investor" ? selected.reduce((sum, l) => sum + l.uplift, 0) : 0;
  const price = listing.askingPrice ?? 0;

  if (renoLines.length === 0) {
    return <div className="card p-6 text-sm" style={{ color: "var(--text-secondary)" }}>No renovation or remediation items flagged from the analysis — the property scored well across assessed items.</div>;
  }

  const rowFor = (l: RenoLine) => {
    const t = renoToggles[l.key];
    const c = l.costing;
    const tier: Tier = t?.tier ?? "budget";
    const labour: LabourMode = t?.labour ?? (c ? c[tier].defaultLabour : "tradie");
    return { tierLabel: c ? c[tier].label : "—", labour, cost: lineCost(l, t), pct: lineFrac(c, t) };
  };

  return (
    <div className="space-y-4">
      {/* Renovation Budget Summary — updates live as tiers are chosen */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Within your {holdYears}-year hold</div>
            <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{selected.length} of {items.length} selected</div>
            {deferred > 0 && <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{deferred} more beyond the hold period (hidden)</div>}
          </div>
          {persona === "investor" && upliftTotal > 0 && (
            <div className="text-right">
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Est. rent uplift</div>
              <div className="text-2xl font-bold mono" style={{ color: "#00e676" }}>+{fmt(upliftTotal)}<span className="text-sm">/wk</span></div>
            </div>
          )}
          <div className="text-right">
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Total renovation</div>
            <div className="text-2xl font-bold mono" style={{ color: "var(--brand)" }}>{fmt(total)}</div>
          </div>
        </div>
        {selected.length > 0 && (
          <div className="mt-3 pt-3 space-y-1" style={{ borderTop: "1px solid var(--border)" }}>
            {selected.map((l) => {
              const r = rowFor(l);
              return (
                <div key={l.key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate" style={{ color: "var(--text-secondary)" }}>{l.name}</span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <span style={{ color: "var(--text-muted)" }}>{r.tierLabel}{r.labour === "diy" ? " · DIY" : ""}{r.pct < 1 ? ` · ${Math.round(r.pct * 100)}%` : ""}</span>
                    <span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(r.cost)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {price > 0 && (
          <div className="mt-3 pt-3 space-y-1 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between"><span style={{ color: "var(--text-secondary)" }}>Total renovation cost</span><span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(total)}</span></div>
            <div className="flex items-center justify-between"><span style={{ color: "var(--text-secondary)" }}>Purchase price</span><span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(price)}</span></div>
            <div className="flex items-center justify-between font-bold"><span style={{ color: "var(--text-primary)" }}>Total investment</span><span className="mono" style={{ color: "var(--brand)" }}>{fmt(price + total)}</span></div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Total investment feeds the yield calc and the predicted sale price.</div>
          </div>
        )}
      </div>

      {items.map((l) => {
        const t = renoToggles[l.key];
        const included = t?.included !== false;
        return (
          <div key={l.key} className="card p-4" style={{ opacity: included ? 1 : 0.55, transition: "opacity 0.15s" }}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={included} onChange={(e) => setRenoToggle(l.key, { included: e.target.checked })} className="mt-1 w-4 h-4 cursor-pointer flex-shrink-0" aria-label={`Include ${l.name}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{l.name}</span>
                  {l.badge && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(0,212,200,0.1)", color: "var(--brand)" }}>{l.badge} remedy</span>}
                  {persona === "investor" && included && l.uplift > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded mono" style={{ background: "rgba(0,230,118,0.12)", color: "#00e676" }}>+${l.uplift}/wk rent</span>
                  )}
                  {!included && <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>removed</span>}
                </div>
                <div className="text-xs mt-0.5" style={{ color: l.detailColor }}>{l.detail}</div>
                {l.costing && <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Est. quantity: {l.costing.quantityNote || `${l.costing.quantity} ${l.costing.quantityUnit}`}</div>}
                {included && (
                  <ThreeTier line={l} toggle={t}
                    onTier={(tier) => setRenoToggle(l.key, { tier, labour: l.costing ? l.costing[tier].defaultLabour : "tradie" })}
                    onLabour={(mode) => setRenoToggle(l.key, { labour: mode })}
                    onPct={(pct) => setRenoToggle(l.key, { affectedPct: pct })} />
                )}
              </div>
            </div>
            {included && l.costing && visualKindFor(l.costing.kind) && (
              <RenoVisualiser
                kind={visualKindFor(l.costing.kind)!}
                photoUrls={listing.photoUrls}
                photoRefs={l.photoRefs}
                costing={l.costing}
                labour={t?.labour ?? l.costing[t?.tier ?? "budget"].defaultLabour}
                selectedTier={t?.tier ?? "budget"}
                onSelectTier={(tier) => setRenoToggle(l.key, { tier, labour: l.costing![tier].defaultLabour, included: true })}
              />
            )}
          </div>
        );
      })}
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Choose a tier per item — 🩹 Patch Up, 🔨 Replace Budget or ✨ Replace High End — and DIY vs Pay someone. Tap See breakdown for the itemised materials (from the NZ materials database) plus labour. The total feeds the predicted sale price and investor yield.
        {persona === "investor" && " Rent-uplift figures are indicative typical-market estimates."}
      </p>
    </div>
  );
}

// ── Financial (basic, from real price) ───────────────────────────────────────
// ── Finance tab field helpers ────────────────────────────────────────────────
function FinNum({ label, value, onChange, hint, disabled }: { label: string; value: number; onChange: (n: number) => void; hint?: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <span style={{ color: "var(--text-secondary)" }}>{label}{hint && <span className="text-[11px] ml-1" style={{ color: "var(--text-muted)" }}>· {hint}</span>}</span>
      <span className="inline-flex items-center gap-1 flex-shrink-0">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>$</span>
        <input type="number" value={value} disabled={disabled} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="rounded px-2 py-1 text-sm w-28 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)", opacity: disabled ? 0.4 : 1 }} />
      </span>
    </div>
  );
}
function FinRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm py-1" style={strong ? { fontWeight: 700 } : undefined}>
      <span style={{ color: strong ? "var(--text-primary)" : "var(--text-secondary)" }}>{label}</span>
      <span className="mono" style={{ color: strong ? "var(--brand)" : "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
function FinSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{title}</h3>
      {children}
    </div>
  );
}

// ── RoIQ Value Verdict (Change 1) — the headline number, top of the Finance tab.
// Suburb median $/m² (scraped) × condition multiplier (the hidden quality score)
// × floor area = RoIQ fair value; compared against asking + selected renovations.
function ValueVerdict({ asking, renoTotal, score, floorSqm, suburbValue }: {
  asking: number; renoTotal: number; score: number; floorSqm: number; suburbValue?: SuburbValue;
}) {
  const [open, setOpen] = useState(false);

  if (!asking || !floorSqm || !suburbValue) {
    const why = !asking
      ? "Add a purchase price to see the verdict."
      : !floorSqm
        ? "No floor area is on file for this property, so we can't estimate a per-m² value."
        : "We couldn't fetch enough recent comparable sales for this suburb to estimate a fair value.";
    return (
      <div className="card p-5" style={{ border: "1px solid var(--border)" }}>
        <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: "var(--brand)" }}>RoIQ Value Verdict</div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{why}</p>
      </div>
    );
  }

  const mult = qualityMultiplier(score);
  const fairValue = roiqFairValue(suburbValue.medianPerSqm, score, floorSqm);
  const trueCost = asking + renoTotal;
  const diff = fairValue - trueCost; // + = below comparable value (good), − = overpriced
  const pctOff = fairValue > 0 ? (diff / fairValue) * 100 : 0;
  const verdict = Math.abs(pctOff) <= 10 ? "fair" : diff < 0 ? "over" : "under";
  const VC = verdict === "over" ? "#ff5f5f" : verdict === "under" ? "#00e676" : "#fbbf24";

  return (
    <div className="card p-5" style={{ border: `1px solid ${VC}55` }}>
      <div className="text-[11px] uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>RoIQ Value Verdict</div>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between"><span style={{ color: "var(--text-secondary)" }}>Asking price</span><span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(asking)}</span></div>
        <div className="flex items-center justify-between"><span style={{ color: "var(--text-secondary)" }}>Selected renovation costs</span><span className="mono" style={{ color: "var(--text-primary)" }}>+{fmt(renoTotal)}</span></div>
        <div className="flex items-center justify-between font-bold pt-1.5" style={{ borderTop: "1px solid var(--border)" }}><span style={{ color: "var(--text-primary)" }}>True cost to you</span><span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(trueCost)}</span></div>
        <div className="flex items-center justify-between pt-2"><span style={{ color: "var(--text-secondary)" }}>RoIQ estimated renovated value</span><span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(fairValue)}</span></div>
      </div>

      <div className="mt-4 rounded-lg p-3" style={{ background: `${VC}14`, border: `1px solid ${VC}40` }}>
        {verdict === "over" && <div className="font-bold text-sm" style={{ color: VC }}>⚠️ OVERPRICED by ~{fmt(Math.abs(diff))}</div>}
        {verdict === "under" && <div className="font-bold text-sm" style={{ color: VC }}>✅ UNDERVALUED by ~{fmt(diff)}</div>}
        {verdict === "fair" && <div className="font-bold text-sm" style={{ color: VC }}>⚖️ FAIRLY PRICED — within 10% of the RoIQ estimate</div>}
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          {verdict === "over" && "This property costs more than comparable renovated homes in this suburb once renovation work is factored in."}
          {verdict === "under" && "Strong opportunity. Even after renovation costs this property is below comparable renovated homes in this suburb."}
          {verdict === "fair" && "The true cost is in line with comparable renovated homes in this suburb."}
        </p>
      </div>

      <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
        RoIQ estimates are based on recent comparable sales and property condition. Always obtain a registered valuation before purchasing.
      </p>

      <button onClick={() => setOpen(!open)} className="mt-2 inline-flex items-center gap-1 text-xs cursor-pointer" style={{ color: "var(--brand)" }}>
        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        {open ? "Hide working" : "How we calculated this"}
      </button>

      {open && (
        <div className="mt-2 rounded-lg p-3 text-xs space-y-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div>
            <div className="font-semibold" style={{ color: "var(--text-primary)" }}>Suburb median $/m² — {suburbValue.suburb}</div>
            <div style={{ color: "var(--text-secondary)" }}>Based on {suburbValue.sampleSize} recent sales from {suburbValue.source}</div>
            {suburbValue.medianSalePrice ? <div style={{ color: "var(--text-secondary)" }}>Median sale price: {fmt(suburbValue.medianSalePrice)}</div> : null}
            {suburbValue.medianFloorArea ? <div style={{ color: "var(--text-secondary)" }}>Median floor area: {suburbValue.medianFloorArea}m²</div> : null}
            <div className="mono" style={{ color: "var(--text-primary)" }}>Median $/m²: {fmt(suburbValue.medianPerSqm)}/m²</div>
            <div style={{ color: "var(--text-muted)" }}>Data retrieved: {suburbValue.retrieved}</div>
            {suburbValue.widenedNote && <div style={{ color: "#fbbf24" }}>⚠ {suburbValue.widenedNote}</div>}
          </div>
          <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="font-semibold" style={{ color: "var(--text-primary)" }}>RoIQ estimated value</div>
            <div className="mono" style={{ color: "var(--text-secondary)" }}>{fmt(suburbValue.medianPerSqm)}/m² × {mult.toFixed(2)}× condition × {floorSqm}m² = {fmt(fairValue)}</div>
            <div style={{ color: "var(--text-muted)" }}>The condition multiplier reflects this property&apos;s assessed quality vs the median home in the suburb.</div>
          </div>
          <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="font-semibold" style={{ color: "var(--text-primary)" }}>True cost to you</div>
            <div className="mono" style={{ color: "var(--text-secondary)" }}>Asking {fmt(asking)} + renovations {fmt(renoTotal)} = {fmt(trueCost)}</div>
          </div>
          <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="font-semibold" style={{ color: "var(--text-primary)" }}>Verdict</div>
            <div className="mono" style={{ color: "var(--text-secondary)" }}>fair value {fmt(fairValue)} − true cost {fmt(trueCost)} = {diff >= 0 ? "+" : "−"}{fmt(Math.abs(diff))} ({pctOff >= 0 ? "+" : "−"}{Math.abs(pctOff).toFixed(0)}%)</div>
          </div>
        </div>
      )}
    </div>
  );
}

function FinanceTab({ listing, persona, marketRent, capitalGrowth, renoLines, renoToggles, score, suburbValue }: {
  listing: StoredReport["listing"];
  persona: Persona;
  marketRent?: MarketRent;
  capitalGrowth?: CapitalGrowth;
  renoLines: RenoLine[];
  renoToggles: Record<string, RenoToggle>;
  score: number;
  suburbValue?: SuburbValue;
}) {
  const { holdYears, withinHold } = useHoldPeriod();
  const renoTotal = selectedRenoCost(renoLines, renoToggles, withinHold);
  const price = listing.askingPrice ?? 0;
  const floorSqm = listing.floorAreaSqm ?? 0;
  const growthPct = capitalGrowth?.annualRatePct ?? 5;
  const rentDefault = marketRent?.weekly ?? Math.round((price * 0.04) / 52);

  const [inp, setInp] = useState<FinanceInputs>(() => defaultInputs({ persona, price, floorSqm, holdYears, renoCost: renoTotal, weeklyRent: rentDefault, growthPct }));
  const [rateLoading, setRateLoading] = useState(false);
  const [rateInfo, setRateInfo] = useState<{ source: string; retrievedAt: string; lender: string; options: { label: string; ratePct: number }[] } | null>(null);
  const [rateErr, setRateErr] = useState<string | null>(null);

  // Persona-driven defaults (deposit %, loan type) follow the header toggle.
  useEffect(() => {
    setInp((p) => ({ ...p, depositPct: persona === "investor" ? FINANCE_DEFAULTS.depositPctInvestor : FINANCE_DEFAULTS.depositPctBuyer, loanType: persona === "investor" ? "io" : "pi" }));
  }, [persona]);

  if (!price) {
    return <div className="card p-6 text-sm" style={{ color: "var(--text-secondary)" }}>The listing price wasn&apos;t available ({listing.priceText ?? "price by negotiation"}), so the calculator can&apos;t run. Open a report with a stated price.</div>;
  }

  const inputs: FinanceInputs = { ...inp, persona, holdYears, renoCost: renoTotal };
  const s = summarise(inputs);
  const set = (patch: Partial<FinanceInputs>) => setInp((p) => ({ ...p, ...patch }));
  const setCost = (k: PurchaseCostKey, v: number) => setInp((p) => ({ ...p, purchaseCosts: { ...p.purchaseCosts, [k]: v } }));
  const toggleCost = (k: PurchaseCostKey) => setInp((p) => ({ ...p, purchaseCostsEnabled: { ...p.purchaseCostsEnabled, [k]: !p.purchaseCostsEnabled[k] } }));
  const isInvestor = persona === "investor";
  const cf = s.netWeeklyCashflow;

  async function fetchRate() {
    setRateLoading(true); setRateErr(null);
    try {
      const r = await fetch("/api/rates", { method: "POST" });
      const d = await r.json();
      if (d.ok && d.rates) { setRateInfo(d.rates); set({ interestRatePct: d.rates.bestRatePct }); }
      else setRateErr(d.message ?? "Couldn't fetch a live rate.");
    } catch { setRateErr("Network error — try again."); }
    finally { setRateLoading(false); }
  }

  const yearsToShow = [1, 2, 5, 10, holdYears].filter((y, idx, arr) => y <= holdYears && arr.indexOf(y) === idx);

  return (
    <div className="space-y-4">
      {/* RoIQ Value Verdict — the most important thing a buyer needs to know. */}
      <ValueVerdict asking={price} renoTotal={renoTotal} score={score} floorSqm={floorSqm} suburbValue={suburbValue} />

      {/* Section 9 — THE FINAL ANSWER */}
      <div className="card p-5" style={{ border: "1px solid var(--brand)", background: "linear-gradient(180deg, rgba(0,212,200,0.06), transparent)" }}>
        <div className="text-[11px] uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>If you buy today and sell in {holdYears} years</div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>You walk away with</div>
            <div className="text-4xl font-bold mono" style={{ color: s.walkAway >= 0 ? "#00e676" : "#ff5f5f" }}>{fmt(s.walkAway)}</div>
          </div>
          <div className="flex gap-6">
            <div><div className="text-xs" style={{ color: "var(--text-muted)" }}>Return on cash</div><div className="text-xl font-bold mono" style={{ color: "var(--text-primary)" }}>{s.returnOnCashPct.toFixed(1)}%</div></div>
            <div><div className="text-xs" style={{ color: "var(--text-muted)" }}>Per year</div><div className="text-xl font-bold mono" style={{ color: "var(--text-primary)" }}>{s.annualReturnPct.toFixed(1)}%</div></div>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div>
            <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Money you put in</div>
            <FinRow label="Deposit" value={fmt(s.deposit)} />
            <FinRow label="Purchase costs" value={fmt(s.purchaseCostsTotal)} />
            <FinRow label="Renovations" value={fmt(inputs.renoCost)} />
            <FinRow label="Total cash in" value={fmt(s.totalCashIn)} strong />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Sale in {holdYears} yrs</div>
            <FinRow label="Projected price" value={fmt(s.projectedValue)} />
            <FinRow label="Less remaining loan" value={"−" + fmt(s.remainingLoan)} />
            <FinRow label="Less agent + legal" value={"−" + fmt(s.agentFees + s.saleLegal)} />
            <FinRow label="Net sale proceeds" value={fmt(s.netSaleProceeds)} strong />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Holding cost ({holdYears} yrs)</div>
            <FinRow label="Mortgage + ongoing" value={fmt(s.totalOngoingOverHold)} />
            {isInvestor && <FinRow label="Less rent received" value={"−" + fmt(s.rentalIncomeOverHold)} />}
            <FinRow label="Net cost of ownership" value={fmt(s.netCostOfOwnership)} strong />
          </div>
        </div>
        <div className="text-xs mt-4 pt-3" style={{ borderTop: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          Put {fmt(s.totalCashIn)} in a term deposit at {inp.termDepositRatePct}% for {holdYears} years and you&apos;d have <span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(s.termDepositValue)}</span>. This property returns <span className="mono" style={{ color: s.walkAway >= 0 ? "#00e676" : "#ff5f5f" }}>{fmt(s.walkAway)}</span>.
        </div>
      </div>

      {/* Section 1 — Purchase details */}
      <FinSection title="Purchase details">
        <FinNum label="Purchase price" value={inp.price} onChange={(v) => set({ price: v })} />
        <FinRow label="Hold period (set by the slider above)" value={`${holdYears} years`} />
        <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Deposit</span>
          <span className="inline-flex items-center gap-1">
            <input type="number" value={Math.round(inp.depositPct * 100)} onChange={(e) => set({ depositPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 })} className="rounded px-2 py-1 text-sm w-16 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>% = {fmt(s.deposit)}</span>
          </span>
        </div>
        <FinRow label="Loan amount" value={fmt(s.loan)} />
        <FinRow label="Renovations (from Renovations tab)" value={fmt(inputs.renoCost)} />
        <FinRow label="Total money needed to buy" value={fmt(s.totalCashIn)} strong />
      </FinSection>

      {/* Section 2 — Mortgage */}
      <FinSection title="Mortgage">
        <div className="flex items-center justify-between gap-2 py-1.5 text-sm flex-wrap">
          <span style={{ color: "var(--text-secondary)" }}>Interest rate</span>
          <span className="inline-flex items-center gap-2">
            <input type="number" step={0.01} value={inp.interestRatePct} onChange={(e) => set({ interestRatePct: Math.max(0, Number(e.target.value) || 0) })} className="rounded px-2 py-1 text-sm w-20 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>%</span>
            <button onClick={fetchRate} disabled={rateLoading} className="text-xs inline-flex items-center gap-1 cursor-pointer" style={{ color: "var(--brand)" }}>
              {rateLoading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} fetch today&apos;s rate
            </button>
          </span>
        </div>
        {rateInfo ? (
          <div className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Live: {rateInfo.options.map((o) => `${o.label} ${o.ratePct}%`).join(" · ")} — {rateInfo.lender}. {rateInfo.source} ({rateInfo.retrievedAt}).</div>
        ) : (
          <div className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Indicative current NZ rate — tap fetch for today&apos;s live rate, or type your own.</div>
        )}
        {rateErr && <div className="text-[11px] mb-1" style={{ color: "#ff5f5f" }}>{rateErr}</div>}
        <div className="flex items-center gap-2 py-1.5 text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Loan type</span>
          <div className="flex gap-1">
            {(["pi", "io"] as LoanType[]).map((lt) => (
              <button key={lt} onClick={() => set({ loanType: lt })} className="text-xs px-2 py-0.5 rounded cursor-pointer" style={{ background: inp.loanType === lt ? "var(--brand)" : "var(--surface-2)", color: inp.loanType === lt ? "#04110f" : "var(--text-muted)", border: "1px solid var(--border)" }}>{lt === "pi" ? "Principal & interest" : "Interest only"}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Loan term</span>
          <span className="inline-flex items-center gap-1"><input type="number" value={inp.loanTermYears} onChange={(e) => set({ loanTermYears: Math.max(1, Math.min(30, Number(e.target.value) || 30)) })} className="rounded px-2 py-1 text-sm w-16 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>years</span></span>
        </div>
        <div className="mt-2 pt-2 space-y-1" style={{ borderTop: "1px solid var(--border)" }}>
          <FinRow label="Weekly repayment" value={fmt(s.weekly) + "/wk"} />
          <FinRow label="Monthly repayment" value={fmt(s.monthly) + "/mo"} />
          <FinRow label="Annual repayment" value={fmt(s.annualRepay)} />
          <FinRow label={`Total interest over ${holdYears} yrs`} value={fmt(s.totalInterest)} />
        </div>
        <div className="text-[11px] mono mt-2 rounded p-2" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>Loan {fmt(s.loan)} @ {inp.interestRatePct}% over {inp.loanTermYears}yr {inp.loanType === "io" ? "interest-only" : "P&I"} = {fmt(s.monthly)}/month</div>
      </FinSection>

      {/* Section 3 — One-off purchase costs */}
      <FinSection title="One-off purchase costs">
        {(["legal", "lim", "inspection", "loanFee", "valuation"] as PurchaseCostKey[]).map((k) => (
          <div key={k} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <label className="inline-flex items-center gap-2 cursor-pointer" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={inp.purchaseCostsEnabled[k]} onChange={() => toggleCost(k)} className="w-3.5 h-3.5 cursor-pointer" />
              {PURCHASE_COST_LABELS[k]}
            </label>
            <span className="inline-flex items-center gap-1"><span className="text-xs" style={{ color: "var(--text-muted)" }}>$</span><input type="number" value={inp.purchaseCosts[k]} disabled={!inp.purchaseCostsEnabled[k]} onChange={(e) => setCost(k, Math.max(0, Number(e.target.value) || 0))} className="rounded px-2 py-1 text-sm w-24 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)", opacity: inp.purchaseCostsEnabled[k] ? 1 : 0.4 }} /></span>
          </div>
        ))}
        <div className="mt-1 pt-2" style={{ borderTop: "1px solid var(--border)" }}><FinRow label="Total purchase costs" value={fmt(s.purchaseCostsTotal)} strong /></div>
      </FinSection>

      {/* Section 4 — Annual ongoing costs */}
      <FinSection title="Annual ongoing costs">
        <FinNum label="Council rates" value={inp.councilRates} onChange={(v) => set({ councilRates: v })} hint="regional estimate — verify" />
        <FinNum label="Home insurance" value={inp.insurance} onChange={(v) => set({ insurance: v })} hint="rebuild-cost estimate" />
        <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Maintenance <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>· {Math.round(inp.maintenancePctOfPrice * 1000) / 10}% of price</span></span>
          <span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(s.maintenance)}</span>
        </div>
        <FinNum label="Body corporate" value={inp.bodyCorp} onChange={(v) => set({ bodyCorp: v })} hint="if applicable" />
        <div className="mt-1 pt-2 space-y-1" style={{ borderTop: "1px solid var(--border)" }}>
          <FinRow label="Total annual costs" value={fmt(s.annualOngoing)} strong />
          <FinRow label="Total weekly costs" value={fmt(s.weeklyOngoing) + "/wk"} />
        </div>
      </FinSection>

      {/* Section 5 — Investor */}
      {isInvestor && (
        <FinSection title="Investor — rent & cashflow">
          <FinNum label="Weekly rent" value={inp.weeklyRent} onChange={(v) => set({ weeklyRent: v })} hint={marketRent ? marketRent.source : "estimate — verify"} />
          <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <span style={{ color: "var(--text-secondary)" }}>Vacancy allowance</span>
            <span className="inline-flex items-center gap-1"><input type="number" value={inp.vacancyWeeks} onChange={(e) => set({ vacancyWeeks: Math.max(0, Number(e.target.value) || 0) })} className="rounded px-2 py-1 text-sm w-14 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>wks/yr</span></span>
          </div>
          <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <label className="inline-flex items-center gap-2 cursor-pointer" style={{ color: "var(--text-secondary)" }}><input type="checkbox" checked={inp.mgmtEnabled} onChange={() => set({ mgmtEnabled: !inp.mgmtEnabled })} className="w-3.5 h-3.5 cursor-pointer" />Property management</label>
            <span className="inline-flex items-center gap-1"><input type="number" step={0.5} value={Math.round(inp.mgmtFeePct * 1000) / 10} disabled={!inp.mgmtEnabled} onChange={(e) => set({ mgmtFeePct: Math.max(0, Number(e.target.value) || 0) / 100 })} className="rounded px-2 py-1 text-sm w-14 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)", opacity: inp.mgmtEnabled ? 1 : 0.4 }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>%</span></span>
          </div>
          <div className="mt-2 rounded-lg p-3" style={{ border: `1px solid ${cf >= 0 ? "#00e676" : "#ff5f5f"}`, background: cf >= 0 ? "rgba(0,230,118,0.08)" : "rgba(255,95,95,0.08)" }}>
            <div className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Net weekly cash flow</div>
            <div className="text-2xl font-bold mono" style={{ color: cf >= 0 ? "#00e676" : "#ff5f5f" }}>{cf >= 0 ? "+" : ""}{fmt(cf)}/wk</div>
            <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Net rent {fmt(s.netWeeklyRent)} − mortgage {fmt(s.weekly)} − ongoing {fmt(s.weeklyOngoing)} {cf >= 0 ? "= cash positive" : "= top-up required"}</div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div><div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Gross yield</div><div className="font-bold mono" style={{ color: "var(--text-primary)" }}>{s.grossYieldPct.toFixed(1)}%</div></div>
            <div><div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Net yield</div><div className="font-bold mono" style={{ color: "var(--text-primary)" }}>{s.netYieldPct.toFixed(1)}%</div></div>
            <div><div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Total investment</div><div className="font-bold mono" style={{ color: "var(--text-primary)" }}>{fmtShort(s.totalInvestment)}</div></div>
          </div>
        </FinSection>
      )}

      {/* Section 6 — Capital growth projection */}
      <FinSection title="Capital growth projection">
        <div className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
          Based on <span className="mono" style={{ color: "var(--text-primary)" }}>{inp.growthPct}%</span> average annual growth{capitalGrowth ? ` in ${listing.suburb ?? listing.region ?? "this area"}` : ""}{capitalGrowth?.source ? ` (${capitalGrowth.source})` : ""}.
          <span className="inline-flex items-center gap-1 ml-2">override <input type="number" step={0.1} value={inp.growthPct} onChange={(e) => set({ growthPct: Number(e.target.value) || 0 })} className="rounded px-1.5 py-0.5 text-xs w-14 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />%</span>
        </div>
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <LineChart data={s.projection} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
              <YAxis tickFormatter={(v) => fmtShort(v as number)} tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={48} />
              <Tooltip formatter={(v) => fmt(v as number)} labelFormatter={(l) => `Year ${l}`} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="value" name="Property value" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="equity" name="Your equity" stroke="#00e676" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
          {yearsToShow.map((y) => { const row = s.projection[y - 1]; return row ? (
            <div key={y} className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>Year {y}</span><span className="mono" style={{ color: "var(--text-primary)" }}>{fmtShort(row.value)} · eq {fmtShort(row.equity)}</span></div>
          ) : null; })}
        </div>
      </FinSection>

      {/* Section 7 — Sale costs */}
      <FinSection title="Sale costs (end of hold)">
        <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Agent commission</span>
          <span className="inline-flex items-center gap-1"><input type="number" step={0.1} value={Math.round(inp.agentCommissionPct * 1000) / 10} onChange={(e) => set({ agentCommissionPct: Math.max(0, Number(e.target.value) || 0) / 100 })} className="rounded px-2 py-1 text-sm w-16 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>% = {fmt(s.agentFees)}</span></span>
        </div>
        <FinNum label="Legal fees at sale" value={inp.legalAtSale} onChange={(v) => set({ legalAtSale: v })} />
        <div className="mt-1 pt-2" style={{ borderTop: "1px solid var(--border)" }}><FinRow label="Total sale costs" value={fmt(s.agentFees + s.saleLegal)} strong /></div>
      </FinSection>

      {/* Section 8 — Tax */}
      <FinSection title="Tax (NZ)">
        <div className="rounded-lg p-3 text-sm" style={{ background: s.brightLineApplies ? "rgba(255,95,95,0.08)" : "rgba(0,230,118,0.08)", border: `1px solid ${s.brightLineApplies ? "#ff5f5f" : "#00e676"}`, color: "var(--text-secondary)" }}>
          {s.brightLineApplies
            ? <>⚠️ <strong style={{ color: "#ff5f5f" }}>Bright-line test applies</strong> (holding under {FINANCE_DEFAULTS.brightLineYears} years). Any capital gain may be taxed as income. Consult your accountant.</>
            : <>✅ <strong style={{ color: "#00e676" }}>Outside the bright-line period</strong> ({holdYears} years ≥ {FINANCE_DEFAULTS.brightLineYears}). No bright-line tax applies (consult your accountant).</>}
        </div>
        {isInvestor && (
          <div className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>✅ Mortgage interest is fully deductible against rental income (from April 2024). Est. annual tax saving at {inp.taxRatePct}%: <span className="mono" style={{ color: "#00e676" }}>{fmt(s.interestDeductSaving)}</span>.</div>
        )}
        <div className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>Tax figures are estimates only — speak to a qualified NZ accountant.</div>
      </FinSection>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Every field is editable; the walk-away figure updates live. Council rates + insurance are estimates (verify with the council and an insurer). Renovations come from your Renovations-tab selections; hold period is the slider at the top.</p>
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
