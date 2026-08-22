"use client";

import { blurOnWheel } from "@/lib/ui/number-input";
import { useState, useMemo, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { PropertyTab } from "@/components/PropertyTab/PropertyTab";
import { HoldPeriodProvider, useHoldPeriod, urgencyScoreToYears } from "@/lib/hold-period/context";
import { HoldPeriodSlider } from "@/components/HoldPeriodSlider";
import { ReportGapBanner } from "@/components/ReportGapBanner";
import type { ReportGap } from "@/lib/property-tab/gaps";
import { urgencyColor, type RenoControls } from "@/lib/property-tab/types";
import type { SubItem, ExtraDwelling } from "@/lib/property-tab/types";
import type { StoredReport, DocAnalysis } from "@/lib/report-store";
import { loadReportPersona, saveReportPersona, saveReportDocs } from "@/lib/report-store";
import { scoreFor, improvementsCategories } from "@/lib/scoring/report";
import { valueLand, roiqValuation } from "@/lib/scoring/valuation";
import { valueImprovementItems, type ImprovementValueResult } from "@/lib/scoring/improvement-values";
import { assessHealthyHomes, hhStatusLabel, HH_RENO_KEYS, type HHResult } from "@/lib/scoring/healthy-homes";
import { assessDevelopment, type DevelopmentPotential } from "@/lib/scoring/development";
import { assessSectionSize, assessTopography, assessShape, assessTrees, assessAspect, assessFrontage } from "@/lib/scoring/land-quality";
import { valueExtraDwellings, dwellingComplianceWork, type ExtraDwellingValueResult, type DwellingValue } from "@/lib/scoring/extra-dwelling-value";
import { PropertyInspections } from "@/components/PropertyInspections/PropertyInspections";
import { SendReportDialog } from "@/components/SendReportDialog";
import { MANDATORY_CATEGORIES, categoryLabel } from "@/lib/photo-categories";
import {
  projectValue, cumulativeGrowthPct, grossYieldPct, netYieldPct, estimateAnnualCosts, vacancyRisk,
  qualityMultiplier, roiqFairValue,
} from "@/lib/scoring/investment";
import type { CapitalGrowth, MarketRent, SuburbValue } from "@/lib/scoring/investment";
import { costThreeTier, tierTotal, TIER_ORDER, scaleTier, isScalableKind } from "@/lib/reno-costing/three-tier";
import type { ThreeTierCost, TierCost, Tier, LabourMode } from "@/lib/reno-costing/three-tier";
import { buildBudgetPlan, PRIORITY_META } from "@/lib/reno-costing/budget-plan";
import { MaterialStudio } from "@/components/MaterialStudio";
import { NegotiationTab } from "@/components/Negotiation/NegotiationTab";
import { surfaceForKind, materialsFor } from "@/lib/materials-catalogue";
import { summarise, defaultInputs, FINANCE_DEFAULTS, PURCHASE_COST_LABELS } from "@/lib/finance/calculator";
import type { FinanceInputs, LoanType, PurchaseCostKey } from "@/lib/finance/calculator";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { ScoreResult } from "@/lib/scoring/engine";
import { tierBandFraction, SPEC_TIER_SHORT, type Persona, type Inspection } from "@/lib/scoring/model";
import {
  INSPECTION_ORDER,
  INSPECTION_META,
  ITEM_BY_ID,
  categoryKeys,
  isVerifiedDocItem,
} from "@/lib/scoring/catalog";
import {
  Home, Building2, Wrench, Calculator, ClipboardList, Shield, MapPin, Handshake,
  ExternalLink, AlertTriangle, ImageIcon, Info, Sparkles, ShieldAlert,
  TrendingUp, Zap, Percent, ChevronDown, RefreshCw, Loader2, ArrowRight, Send, History, Lock,
} from "lucide-react";

import Link from "next/link";

import { useSession } from "@/lib/auth/session";
import { BlurredValue, UpgradeNote, LockedTab } from "@/components/report/Locked";

type Tab = "overview" | "improvements" | "address" | "citytown" | "renovations" | "financial" | "negotiation" | "methodology";

const TAB_DEFS: { id: Tab; label: string; icon: React.ElementType; investorOnly?: boolean }[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "improvements", label: "Improvements", icon: Building2 },
  { id: "address", label: "Land", icon: ClipboardList },
  { id: "renovations", label: "Renovations", icon: Wrench },
  { id: "financial", label: "Financial", icon: Calculator },
  { id: "negotiation", label: "For the agent", icon: Handshake },
  { id: "methodology", label: "How we score", icon: Info },
];

/**
 * Tabs a free report doesn't open.
 *
 * The free report runs the full analysis and shows every photo finding —
 * that's what proves the product works on your own listing. What it holds back
 * is the conclusion: what the property is worth, what it costs to fix, and what
 * to say to the agent.
 */
const LOCKED_TABS: Record<string, { title: string; blurb: string; includes: string[] }> = {
  financial: {
    title: "Financial",
    blurb: "The valuation and the numbers behind it, worked from the condition findings you can already see.",
    includes: [
      "BDR Value Verdict — is the asking price fair once repairs are counted",
      "Land and improvement value, with the working shown",
      "Yield, cash flow and the 10-year equity timeline",
      "Your own deposit, rate and hold period applied throughout",
    ],
  },
  renovations: {
    title: "Renovations",
    blurb: "Every flagged item costed at New Zealand rates, and what fixing it does to the property's value.",
    includes: [
      "Line-by-line costs for each defect found",
      "Toggle items in and out to see the effect",
      "Budget and premium options per item",
      "What the work adds back in value",
    ],
  },
  negotiation: {
    title: "For the agent",
    blurb: "A document you can send the vendor's agent, built only from the critical and urgent findings in this report.",
    includes: [
      "Every claim traced to a photo in your report",
      "Costs stated with their confidence tier",
      "Nothing about your budget or walk-away price",
      "Emailed or shared as a private link",
    ],
  },
};

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

/** Is a reno line in the plan? Explicit toggle wins; otherwise its auto default. */
const renoIncluded = (
  l: { key: string; autoInclude: boolean },
  toggles: Record<string, RenoToggle>
): boolean => toggles[l.key]?.included ?? l.autoInclude;

/** Total of the in-plan reno lines that fall within the hold period. */
function selectedRenoCost(
  lines: { key: string; costing?: ThreeTierCost; low: number; high: number; urgencyYears: number; autoInclude: boolean }[],
  toggles: Record<string, RenoToggle>,
  withinHold: (years: number) => boolean
): number {
  return lines
    .filter((l) => withinHold(l.urgencyYears))
    .filter((l) => renoIncluded(l, toggles))
    .reduce((sum, l) => sum + lineCost(l, toggles[l.key]), 0);
}

/** Pull a dollar figure out of a "no firm price" label like "Enquiries Over $629,000". */
function parseOverPrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.replace(/,/g, "").match(/\$?\s*(\d{5,9})/);
  const n = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(n) && n >= 50000 ? n : null;
}

/** Editable purchase price — defaults to the listing/parsed price, commits on blur or Enter. */
function PurchasePriceBar({ value, priceText, onChange }: {
  value: number | null; priceText: string | null; onChange: (n: number | null) => void;
}) {
  const [text, setText] = useState(value ? String(value) : "");
  useEffect(() => { setText(value ? String(value) : ""); }, [value]);
  const commit = () => {
    const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
    onChange(Number.isFinite(n) && n > 0 ? n : null);
  };
  const noFirm = !value;
  return (
    <div className="card p-4 mb-4" style={{ border: noFirm ? "1px solid var(--warn-wash)" : "1px solid var(--border)", background: noFirm ? "var(--warn-wash)" : "var(--surface)" }}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Purchase price</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {noFirm
              ? `No firm price on the listing${priceText ? ` — it says “${priceText}”` : ""}. Enter a price to run the numbers.`
              : "Adjust to model a different offer — the whole financial report updates."}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm mono" style={{ color: "var(--text-secondary)" }}>$</span>
          <input
            inputMode="numeric" value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur(); } }}
            placeholder="629,000"
            aria-label="Purchase price in NZD"
            className="rounded px-3 py-1.5 text-sm mono w-40 text-right"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
        </div>
      </div>
    </div>
  );
}

export function RealReportView({
  report,
  shared = false,
  embedded = false,
}: {
  report: StoredReport;
  shared?: boolean;
  /**
   * Renders the report as a section inside another page (the landing-page
   * demo) rather than as a standalone route: no Navbar of its own, no
   * full-viewport height, and no owner-only actions such as Send report,
   * which would be dead ends for a signed-out visitor.
   */
  embedded?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [persona, setPersona] = useState<Persona>("buyer");

  // A free report shows the whole analysis and withholds the conclusion.
  //
  // Gated on the CURRENT plan, not the plan at the time of the report: upgrading
  // opens everything already run, which is the honest deal and the reason the
  // locked panels say the analysis is done and waiting.
  //
  // Never locked for: a shared link (the sender paid), the embedded landing
  // demo, or the bundled samples — those exist to show the full product to
  // people who haven't paid for anything yet, so locking them would gate the
  // shop window. Sample ids aren't uuids.
  const { plan, loading: planLoading } = useSession();
  const isSample = !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(report.id);
  // While the session is loading, assume unlocked — a moment of visible content
  // is a smaller wrong than showing a paying customer an upgrade wall.
  const locked = !shared && !embedded && !isSample && !planLoading && plan === "free";
  const [showSend, setShowSend] = useState(false);
  const [askingPrice, setAskingPrice] = useState<number | null>(
    report.listing.askingPrice ?? parseOverPrice(report.listing.priceText)
  );
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
        // Section size is scored objectively vs a typical lot, not the AI's guess.
        if (s.id === "land_size") return { ...s, score: assessSectionSize(report.listing.landAreaSqm).score as typeof s.score };
        // Topography is derived from the gradient band + usable share, for the same
        // reason: "6/10 contour" is an opinion, a slope band and a usable area aren't.
        if (s.id === "land_topography") {
          const t = assessTopography(s.slopeBand, s.usableLandPct, report.listing.landAreaSqm);
          if (t) return { ...s, score: t.score as typeof s.score };
        }
        // Shape likewise — derived from the named outline, not a vague "usability" read.
        if (s.id === "land_shape") {
          const sh = assessShape(s.shapeType, s.workableLandPct);
          if (sh) return { ...s, score: sh.score as typeof s.score };
        }
        // Trees: maturity (what you inherit) × upkeep (what it will ask of you).
        if (s.id === "land_trees") {
          const tr = assessTrees(s.treeMaturity, s.treeUpkeep);
          if (tr) return { ...s, score: tr.score as typeof s.score };
        }
        // Aspect: compass direction × what blocks the sun it promises.
        if (s.id === "land_aspect") {
          const a = assessAspect(s.aspectDirection, s.sunObstruction);
          if (a) return { ...s, score: a.score as typeof s.score };
        }
        // Frontage: how you get there × how many households share the access.
        if (s.id === "land_frontage") {
          const f = assessFrontage(s.accessType, s.homesOnAccess);
          if (f) return { ...s, score: f.score as typeof s.score };
        }
        return s;
      }),
    [report.subItems, verifiedDocs, noPhotos, report.listing.landAreaSqm]
  );

  // THE SCORE: re-runs scoreProperty() for the chosen persona + verified docs.
  // Pure + instant — drives the dial, bars, grade, and gating. Recomputes the
  // moment a document is uploaded (auto-rescore).
  // Development potential — can you add a tiny home / dwelling / subdivide (Land tab).
  const development = useMemo(
    () =>
      assessDevelopment({
        landAreaSqm: report.listing.landAreaSqm,
        floorAreaSqm: report.listing.floorAreaSqm,
        suburbMedianPerSqm: report.suburbValue?.medianPerSqm ?? null,
      }),
    [report.listing.landAreaSqm, report.listing.floorAreaSqm, report.suburbValue]
  );

  const scored: ScoreResult = useMemo(
    () =>
      scoreFor(
        { subItems: effectiveSubItems, extraDwellings: report.extraDwellings, context: report.context, penalties: report.penalties, developmentTier: development.tier },
        persona
      ),
    [persona, effectiveSubItems, report.extraDwellings, report.context, report.penalties, development.tier]
  );

  // Extra dwellings are NOT scored (subjective, and ~99% of properties don't have
  // one — scoring it would make properties incomparable). They contribute VALUE only.
  const dwellingValue = useMemo(
    () => valueExtraDwellings(report.extraDwellings),
    [report.extraDwellings]
  );

  // Itemised improvement (building) value — depreciated replacement cost per
  // component + a base structure/services shell (v5.1). Persona-neutral, computed
  // once; shared by the Overview card, the per-item cards and the Value Verdict.
  const improvementValuation = useMemo(
    () =>
      valueImprovementItems({
        subItems: effectiveSubItems,
        floorAreaSqm: report.listing.floorAreaSqm,
        bathrooms: report.listing.bathrooms,
      }),
    [effectiveSubItems, report.listing.floorAreaSqm, report.listing.bathrooms]
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
  const renoLines = useMemo(() => buildRenoLines(report.subItems, report.listing, persona, report.extraDwellings), [report.subItems, report.listing, persona, report.extraDwellings]);
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

  // Bridge for the Improvements cards to add/remove themselves from the reno plan.
  const renoControls: RenoControls = useMemo(() => {
    const byId = new Map(renoLines.filter((l) => !l.key.endsWith("_rem")).map((l) => [l.key, l]));
    return {
      has: (id) => byId.has(id),
      included: (id) => {
        const l = byId.get(id);
        return l ? renoIncluded(l, renoToggles) : false;
      },
      toggle: (id, on) => setRenoToggle(id, { included: on }),
    };
  }, [renoLines, renoToggles]);

  const tabs = TAB_DEFS.filter((t) => !t.investorOnly || persona === "investor");

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
    askingPrice ? fmt(askingPrice) : listing.priceText,
    [listing.bedrooms && `${listing.bedrooms} bed`, listing.bathrooms && `${listing.bathrooms} bath`, listing.carParks && `${listing.carParks} car`].filter(Boolean).join(" · "),
    [listing.propertyType !== "unknown" ? listing.propertyType : null, listing.floorAreaSqm && `${listing.floorAreaSqm}m² floor`, listing.landAreaSqm && `${listing.landAreaSqm}m² land`].filter(Boolean).join(" · "),
    [listing.buildYear && `c.${listing.buildYear}`, listing.titleType !== "unknown" ? listing.titleType : null].filter(Boolean).join(" · "),
  ].filter(Boolean);

  return (
    <HoldPeriodProvider defaultYears={10}>
      <div style={{ background: "var(--bg)", minHeight: embedded ? undefined : "100vh" }}>
        {/* A shared report is read by someone who may not have an account, so it
            shows the signed-out bar; otherwise the real session. */}
        {!embedded && (shared ? <Navbar user={null} /> : <Navbar />)}

        {!embedded && showSend && <SendReportDialog report={report} onClose={() => setShowSend(false)} />}

        {/* Header */}
        <div className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                  {shared ? (
                    <span className="flex items-center gap-1" style={{ color: "var(--brand)" }}>
                      <Send size={11} /> shared report
                    </span>
                  ) : embedded ? (
                    <span style={{ color: "var(--text-muted)" }}>Sample report</span>
                  ) : (
                    <a href="/dashboard" className="hover:underline" style={{ color: "var(--text-muted)" }}>← Dashboard</a>
                  )}
                  <span>·</span>
                  <a href={listing.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: "var(--brand)" }}>
                    {listing.portal} <ExternalLink size={11} />
                  </a>
                  {!shared && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1" style={{ color: "var(--brand)" }}>
                        <Sparkles size={11} /> live analysis
                      </span>
                    </>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                  {listing.address ?? "Address not found"}
                </h1>
                <div className="flex items-center flex-wrap gap-2 mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {[listing.suburb, listing.region ?? listing.city].filter(Boolean).join(", ")}
                  {facts.map((f, i) => (<span key={i}><span className="mx-1">·</span>{f}</span>))}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1"><ImageIcon size={12} /> {listing.photoUrls.length > 0 ? `${listing.photoUrls.length} found · ${photosAnalysed} analysed` : `${photosAnalysed} photos analysed`}</span>
                  <span className="mono">{model}</span>
                  {(!listing.scrapedOk || photosAnalysed === 0) && (
                    <span style={{ color: "var(--warn)" }}>⚠ scrape partial — leans Tier 3</span>
                  )}
                </div>
                {listing.dataSource && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs rounded-md px-2 py-1" style={{ background: "var(--accent-wash)", color: "var(--brand)", border: "1px solid var(--border)" }}>
                    <Info size={12} /> {listing.dataSource}
                  </div>
                )}
                {report.photoCoverage && (
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-xs">
                    <span style={{ color: report.photoCoverage.missingMandatory.length === 0 ? "var(--success)" : "var(--warn)" }}>
                      {report.photoCoverage.missingMandatory.length === 0 ? "✅" : "⚠"} {MANDATORY_CATEGORIES.length - report.photoCoverage.missingMandatory.length} of {MANDATORY_CATEGORIES.length} required areas covered
                    </span>
                    {report.photoCoverage.missingOptional.length > 0 && (
                      <span style={{ color: "var(--text-muted)" }}>💡 {report.photoCoverage.missingOptional.length} optional areas not photographed</span>
                    )}
                  </div>
                )}
              </div>

              {/* Send / share — owner view only */}
              {!shared && !embedded && (
                <button
                  onClick={() => setShowSend(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap"
                  style={{ background: "var(--brand)", color: "var(--on-accent)" }}
                >
                  <Send size={13} /> Send report
                </button>
              )}
            </div>

            {/* Reused analysis — say so. A saved read of the same listing is worth
                having instantly, but presenting it as a live one would be a lie. */}
            {report.reusedFrom && (
              <div
                className="flex items-start gap-2 rounded-xl px-3.5 py-2.5 mb-4 text-xs"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                <History size={14} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }} />
                <span>
                  This property was analysed on{" "}
                  <strong style={{ color: "var(--text-primary)" }}>
                    {new Date(report.reusedFrom.analysedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}
                  </strong>
                  {" "}and the asking price hasn&apos;t changed since, so we&apos;ve reused that read
                  rather than running it again. The photos and condition are as they were on that date.
                </span>
              </div>
            )}

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
                  {locked && LOCKED_TABS[t.id] && (
                    <Lock size={11} style={{ color: "var(--text-muted)" }} aria-label="needs a paid plan" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Say it plainly and once, at the top. Someone who scrolls into a
              blurred number without warning feels tricked; someone told up front
              what they're getting for free doesn't. */}
          {locked && (
            <div
              className="card p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4"
              style={{ border: "1px solid var(--brand)", background: "var(--accent-wash)" }}
            >
              <Lock size={20} style={{ color: "var(--brand)", flexShrink: 0 }} />
              <div className="flex-1">
                <div className="font-semibold text-base mb-1" style={{ color: "var(--text-primary)" }}>
                  This is your free report — the analysis is complete
                </div>
                <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Every photo has been read and every finding below is real. To see
                  the <strong style={{ color: "var(--text-primary)" }}>score out of 1,000</strong> and
                  the <strong style={{ color: "var(--text-primary)" }}>valuation</strong> — plus the Financial,
                  Renovations and agent tabs — you&apos;ll need a paid plan. Nothing is re-run when you upgrade;
                  this report opens as it is.
                </p>
              </div>
              <Link href="/pricing?plan=starter" className="btn-primary text-sm px-5 py-2.5 whitespace-nowrap self-start sm:self-auto">
                See plans <ArrowRight size={15} />
              </Link>
            </div>
          )}

          {noPhotos && !continuedWithoutPhotos && (
            <div className="card p-5 mb-6" style={{ border: "1px solid var(--brand)", background: "var(--accent-wash)" }}>
              <div className="flex items-center gap-2 font-semibold text-base mb-1" style={{ color: "var(--text-primary)" }}>📷 No listing photos found</div>
              <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                We couldn&apos;t retrieve photos from this listing. TradeMe and some other portals block photo access. Without photos we can&apos;t give condition scores — only build-year risk flags. To get a full BDR Report you have two options:
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <a href={`/report/upload?address=${encodeURIComponent(listing.address ?? "")}${listing.askingPrice ? `&price=${listing.askingPrice}` : ""}`}
                  className="btn-primary text-sm px-4 py-2">Upload photos manually <ArrowRight size={15} /></a>
                <button onClick={() => setContinuedWithoutPhotos(true)} className="btn-secondary text-sm px-4 py-2 cursor-pointer">Continue without photos</button>
              </div>
            </div>
          )}
          {report.photoCoverage && report.photoCoverage.missingOptional.length > 0 && (
            <div className="card p-4 mb-6" style={{ border: "1px solid var(--warn-wash)", background: "var(--warn-wash)" }}>
              <div className="text-sm font-semibold mb-1" style={{ color: "var(--warn)" }}>💡 Your report could be more accurate</div>
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                These areas weren&apos;t photographed: {report.photoCoverage.missingOptional.map(categoryLabel).join("  ·  ")}
              </div>
              <a href="/report/upload" className="text-xs mt-1.5 inline-block hover:underline" style={{ color: "var(--brand)" }}>Upload additional photos →</a>
            </div>
          )}
          {tab === "overview" && <OverviewReal locked={locked} report={report} subItems={effectiveSubItems} scored={scored} persona={persona} renoLines={renoLines} renoToggles={renoToggles} askingPrice={askingPrice} improvementValuation={improvementValuation} dwellingValue={dwellingValue} />}
          {tab === "improvements" && (
            <div className="space-y-4">
              <PropertyTab data={{ categories: improvementsCategories(effectiveSubItems), extraDwellings: report.extraDwellings, overallScore: scored.total }} region={listing.region ?? listing.city ?? undefined} floorSqm={listing.floorAreaSqm} noPhotos={noPhotos} buildYear={listing.buildYear} persona={persona} renoControls={renoControls} onOpenRenovations={() => setTab("renovations")} dwellingValues={dwellingValue.dwellings} />
              {persona === "investor" && <HealthyHomesSection subItems={effectiveSubItems} buildYear={listing.buildYear} renoControls={renoControls} onOpenRenovations={() => setTab("renovations")} />}
            </div>
          )}
          {tab === "address" && (
            <div className="space-y-4">
              <PropertyInspections mode="address" scored={scored} subItems={effectiveSubItems} onSeeRenovations={() => setTab("renovations")} verifiedDocs={verifiedDocs} onVerified={onVerified} development={development} persona={persona} landAreaSqm={listing.landAreaSqm} />
              <LocationFactCard subItems={subItems} ids={["loc_noise", "loc_views"]} title="Noise & outlook" />
            </div>
          )}
          {locked && LOCKED_TABS[tab] && <LockedTab {...LOCKED_TABS[tab]} />}
          {tab === "renovations" && !locked && <RenovationsReal renoLines={renoLines} renoToggles={renoToggles} setRenoToggle={setRenoToggle} persona={persona} listing={listing} />}
          {tab === "financial" && !locked && (
            <>
              <PurchasePriceBar value={askingPrice} priceText={listing.priceText} onChange={setAskingPrice} />
              <FinanceTab key={askingPrice ?? "none"} listing={{ ...listing, askingPrice }} persona={persona} marketRent={report.marketRent} capitalGrowth={report.capitalGrowth} renoLines={renoLines} renoToggles={renoToggles} score={scored.total} suburbValue={report.suburbValue} improvementValuation={improvementValuation} dwellingAdded={dwellingValue.addedValue} />
              <div className="mt-4"><LocationFactCard subItems={effectiveSubItems} ids={["loc_growth"]} title="Suburb growth & demand" /></div>
            </>
          )}
          {tab === "negotiation" && !locked && <NegotiationTab report={report} />}
          {tab === "methodology" && <MethodologyTab />}
        </div>

        <Disclaimer url={listing.url} />
      </div>
    </HoldPeriodProvider>
  );
}

// ── Predicted future sale price (used on the Overview tab's value card) ───────
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
      <div className="text-lg font-bold mono leading-tight" style={{ color: predicted >= askingPrice ? "var(--good)" : "var(--text-primary)" }}>
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
        <TrendingUp size={16} style={{ color: "var(--good)" }} />
        <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Capital growth</h3>
        <span className="text-xs px-1.5 py-0.5 rounded mono" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{rate}% p.a. trend</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 my-4">
        {projections.map((p) => (
          <div key={p.label} className="rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{p.label} · by {p.year}</div>
            <div className="text-xl font-bold mono" style={{ color: "var(--text-primary)" }}>Est. {fmtShort(p.value)}</div>
            <div className="text-xs font-semibold" style={{ color: "var(--good)" }}>+{p.pct.toFixed(0)}%</div>
          </div>
        ))}
      </div>
      <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>{capitalGrowth.why}</p>
      {capitalGrowth.recentNote && <p className="text-xs mt-2" style={{ color: "var(--warn)" }}>⚠ {capitalGrowth.recentNote}</p>}
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
        <input type="number" onWheel={blurOnWheel} value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Weekly rent $" className="rounded-lg px-3 py-2 text-sm w-40" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      </div>
    );
  }

  const gross = grossYieldPct(weekly, totalInvestment);
  const annualCosts = estimateAnnualCosts(askingPrice, weekly);
  const net = netYieldPct(weekly, totalInvestment, annualCosts);
  const vac = vacancyRisk(growthScore);
  const strong = gross >= 6;
  const lowCondition = qualityBase < 660;
  const rating = gross >= 6.5 ? { label: "Strong", c: "var(--good)" } : gross >= 4.5 ? { label: "Moderate", c: "var(--warn)" } : { label: "Modest", c: "var(--bad)" };

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
        <div className="rounded-lg p-3 mb-4 flex items-start gap-2 text-sm" style={{ background: "var(--warn-wash)", border: "1px solid var(--warn-wash)" }}>
          <Zap size={15} className="mt-0.5 flex-shrink-0" style={{ color: "var(--warn)" }} />
          <span style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--warn)" }}>High-yield property</strong> — {gross.toFixed(1)}% gross return may offset the property&apos;s lower condition. Weigh cashflow against the repair list.
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
        <input type="number" onWheel={blurOnWheel} value={override} onChange={(e) => setOverride(e.target.value)} placeholder={String(marketRent?.weekly ?? "")} className="rounded-lg px-2 py-1 text-sm w-24 mono" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
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
      {INSPECTION_ORDER.filter((insp) => scored.byInspection[insp].max > 0).map((insp) => {
        const v = scored.byInspection[insp];
        const meta = INSPECTION_META[insp];
        const col = v.pct >= 80 ? "var(--good)" : v.pct >= 55 ? "var(--warn)" : "var(--bad)";
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
        const col = c.v.pct >= 80 ? "var(--good)" : c.v.pct >= 55 ? "var(--warn)" : "var(--bad)";
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

// ── Condition & Quality Score breakdown (base − penalties + bonuses) ──────────
function ScoreBreakdown({ scored, locked = false }: { scored: ScoreResult; locked?: boolean }) {
  const penaltySum = scored.penalties.reduce((s, a) => s - a.points, 0); // points are negative
  const bonusSum = scored.bonuses.reduce((s, a) => s + a.points, 0);
  const penaltyCapped = penaltySum > scored.penaltyTotal;
  const bonusCapped = bonusSum > scored.bonusTotal;
  const hasAdj = scored.penalties.length > 0 || scored.bonuses.length > 0;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Condition &amp; Quality Score</div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            The property itself, minus objective location negatives, plus on-site value-adds. Location desirability is shown as facts, never scored. Always out of 1000, so properties stay comparable — an extra dwelling adds value, not points.
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-3xl font-bold mono" style={{ color: "var(--text-primary)" }}>
            {locked ? (
              <BlurredValue label="Your score needs a paid plan">{scored.total}</BlurredValue>
            ) : (
              scored.total
            )}
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>/1000</span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span style={{ color: "var(--text-secondary)" }}>Building &amp; land quality</span>
          <span className="mono" style={{ color: "var(--text-primary)" }}>
            {locked ? <BlurredValue amount={6} label="Your score needs a paid plan">{scored.base}</BlurredValue> : scored.base}
          </span>
        </div>

        {scored.penalties.map((p) => (
          <div key={p.id} className="flex items-start justify-between gap-3">
            <span style={{ color: "var(--text-secondary)" }}>
              {p.label}
              {p.note && <span className="text-[11px] block" style={{ color: "var(--text-muted)" }}>{p.note}</span>}
            </span>
            <span className="mono flex-shrink-0" style={{ color: "var(--bad)" }}>{p.points}</span>
          </div>
        ))}
        {penaltyCapped && (
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Location penalties capped at −{scored.penaltyTotal} (of −{penaltySum}).</div>
        )}

        {scored.bonuses.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-3">
            <span style={{ color: "var(--text-secondary)" }}>{b.label}</span>
            <span className="mono flex-shrink-0" style={{ color: "var(--good)" }}>+{b.points}</span>
          </div>
        ))}
        {bonusCapped && (
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>On-site value-adds capped at +{scored.bonusTotal} (of +{bonusSum}).</div>
        )}

        {!hasAdj && (
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>No location penalties or on-site value-adds applied — clear of highways, flight paths, rail and industry.</div>
        )}

        <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Total</span>
          <span className="mono font-bold" style={{ color: "var(--text-primary)" }}>
            {locked ? <BlurredValue amount={6} label="Your score needs a paid plan">{scored.total}</BlurredValue> : scored.total}
          </span>
        </div>
      </div>

      {locked && (
        <div className="mt-4">
          <UpgradeNote what="Your score out of 1,000" />
        </div>
      )}
    </div>
  );
}

// ── Improvement (building) value — itemised depreciated replacement cost (v5.1) ─
function ImprovementValueCard({ iv }: { iv: ImprovementValueResult }) {
  const chip = { fontFamily: "var(--font-mono, ui-monospace)", fontSize: "11px", color: "var(--text-secondary)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "7px", padding: "4px 9px" } as React.CSSProperties;
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Improvement (building) value</div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            Built up <strong style={{ color: "var(--text-secondary)" }}>item by item</strong> — each component&apos;s replacement cost, adjusted for its spec &amp; condition, plus the base structure &amp; services.
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-2xl font-bold mono" style={{ color: "var(--text-primary)" }}>{fmt(iv.buildingValue)}</div>
          {iv.ratePerSqm && <div className="text-[11px] mono" style={{ color: "var(--text-muted)" }}>{fmt(iv.ratePerSqm)}/m² × {iv.floorAreaSqm}m²</div>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span style={chip}>Structure &amp; services: {fmt(iv.shellValue)}</span>
        <span style={chip}>Scored components: {fmt(iv.componentsValue)}</span>
        {iv.totalValueGap > 0 && <span style={{ ...chip, color: "var(--good)", borderColor: "var(--good-wash)" }}>Renovation upside: +{fmt(iv.totalValueGap)}</span>}
      </div>
    </div>
  );
}

// ── How we score — transparency / methodology page ───────────────────────────
function MethodologyTab() {
  const rows = (data: [string, string][]) => (
    <div className="mt-3">
      {data.map(([k, v], i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-2" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{k}</span>
          <span className="text-sm mono flex-shrink-0 text-right" style={{ color: "var(--text-primary)" }}>{v}</span>
        </div>
      ))}
    </div>
  );
  const bold = { color: "var(--text-primary)" };
  const box = { background: "var(--surface-2)", border: "1px solid var(--border)" };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="text-[11px] uppercase tracking-widest mb-2" style={{ color: "var(--brand)" }}>How we score</div>
        <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.75 }}>
          BDR Report isn&apos;t a generic out-of-ten. The <strong style={bold}>Condition &amp; Quality Score</strong> measures the property itself, and every number that feeds it is shown to you. Here&apos;s exactly how it works.
        </p>
      </div>

      <div className="card p-5">
        <h3 className="text-base font-semibold" style={bold}>The score in one line</h3>
        <div className="mt-3 rounded-lg p-3 text-sm mono" style={{ ...box, color: "var(--text-secondary)" }}>
          BASE (0–1000) − location penalties (max 150) + on-site value-adds (max 60)
        </div>
        <div className="mt-3 space-y-1.5 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          <div><strong style={bold}>Base</strong> — Improvements + Land + Legal, normalised to 1000. The property itself.</div>
          <div><strong style={bold}>Penalties</strong> — objective location negatives (motorway, flight path, rail…), scaled by how close.</div>
          <div><strong style={bold}>Value-adds</strong> — on-site assets that lift resale (extra dwelling, pool).</div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-base font-semibold" style={bold}>What the 1–10 means (it&apos;s not all &ldquo;condition&rdquo;)</h3>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>The same scale means different things depending on what&apos;s assessed:</p>
        {rows([
          ["Improvements (the building)", "Spec tier sets a points band · condition positions within it"],
          ["Land (the section)", "Two checkable facts · the score is derived from them"],
          ["Legal (title & compliance)", "Quality / risk · 10 = excellent, 1 = severe"],
        ])}
        <div className="mt-3 rounded-lg p-3 text-xs" style={{ ...box, color: "var(--text-secondary)", lineHeight: 1.65 }}>
          Example: on the Land tab you see <strong style={bold}>612m²</strong> and <strong style={bold}>&ldquo;Typical&rdquo;</strong> rather than a bare number, because the fact is what you actually need — the score is worked out <em>from</em> it. On Legal, a low score means a title or compliance <em>risk</em>, not something worn out.
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-base font-semibold" style={bold}>How building items are scored — spec tier first</h3>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
          Every building item is first classified into a <strong style={bold}>spec tier</strong> — the quality and era of the materials, read from the finish and any brand names. The tier sets a <strong style={bold}>capped points band</strong> (a floor and a ceiling); the item&apos;s <strong style={bold}>condition</strong> then decides where in that band it lands. A &ldquo;Dated&rdquo; item can never earn a &ldquo;Modern&rdquo; score no matter how well kept.
        </p>
        {rows([
          ["Deteriorated", "absent / broken / end-of-life · 0–30% of points"],
          ["Dated", "old-fashioned, pre-2014 spec · 30–60%"],
          ["Modern", "contemporary, 2014 onward · 60–80%"],
          ["Luxury", "high-end materials · any age · 80–100%"],
        ])}
        <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>Example: a benchtop worth 13 points, classed &ldquo;Dated&rdquo;, earns 4–8 points — condition sets where in that band. The tier also drives the improvement value.</p>
      </div>

      <div className="card p-5">
        <h3 className="text-base font-semibold" style={bold}>How land items are scored — from facts, not opinions</h3>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
          We don&apos;t hand your land a mark out of ten and ask you to trust it. &ldquo;7/10 section size&rdquo; tells you nothing — <strong style={bold}>612m²</strong> does. So for each part of the section we read <strong style={bold}>two plain facts</strong>, things you can check yourself on the title diagram, an aerial view or the photos, and the score follows from them.
        </p>
        <div className="mt-3 rounded-lg p-3 text-sm mono" style={{ ...box, color: "var(--text-secondary)" }}>
          fact 1 sets the range → fact 2 decides where in it you land
        </div>
        <p className="text-xs mt-3 mb-1" style={{ color: "var(--text-muted)" }}>The two facts we read for each item:</p>
        {rows([
          ["Section size", "Its area, against a typical 550m² NZ section"],
          ["Topography", "Slope band + how much is flat enough to use"],
          ["Section orientation", "Which way it faces + what blocks the sun"],
          ["Section shape", "The outline + how much is a workable block"],
          ["Frontage & access", "How you reach it + how many share that access"],
          ["Trees & planting", "How established it is + how it's been kept"],
        ])}
        <p className="text-xs mt-4 mb-1" style={{ color: "var(--text-muted)" }}>What full marks takes:</p>
        {rows([
          ["Section size", "1,375m²+ (2.5× a typical lot)"],
          ["Topography", "Flat, and fully usable"],
          ["Section orientation", "North-facing, nothing shading it"],
          ["Section shape", "Rectangular, no wasted corners"],
          ["Frontage & access", "Wide street frontage, shared with no one"],
          ["Trees & planting", "Mature, and well maintained"],
        ])}
        <div className="mt-3 rounded-lg p-3 text-xs" style={{ ...box, color: "var(--text-secondary)", lineHeight: 1.65 }}>
          The first fact <strong style={bold}>caps</strong> what an item can ever earn, because some things about land simply can&apos;t be changed. A gentle slope tops out at 9/10 however usable it is; a south-facing section at 5/10; a wedge-shaped one at 6/10. Open any Land card and <strong style={bold}>&ldquo;How it rates&rdquo;</strong> shows you the full working behind its score.
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-base font-semibold" style={bold}>How we value it</h3>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
          We value land and building <em>separately</em>, then add them — because land appreciates and buildings depreciate, so a single blended figure hides the truth.
        </p>
        <div className="mt-3 rounded-lg p-3 text-sm mono" style={{ ...box, color: "var(--text-secondary)" }}>
          Land value + Improvement value = BDR value → vs asking → over / under
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Improvement value is built up <strong style={bold}>item by item</strong>: each component&apos;s replacement cost × its spec tier × its condition, plus a base structure &amp; services allowance for what can&apos;t be seen (framing, wiring, plumbing). Land value comes from comparable sales. Every estimate carries a confidence range.
        </p>
      </div>

      <div className="card p-5">
        <h3 className="text-base font-semibold" style={bold}>Why location isn&apos;t scored</h3>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
          Location desirability is <strong style={bold}>subjective</strong> — waterfront thrills one buyer, a quiet cul-de-sac another. Baking it into one number would give a false score. So location facts (sun, views, noise, growth) are shown for you to weigh, and only <strong style={bold}>objective negatives</strong> that hurt resale for almost everyone affect the score — as transparent deductions.
        </p>
      </div>

      <div className="card p-5">
        <h3 className="text-base font-semibold" style={bold}>Honest limits</h3>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
          BDR Report reads photos and public listing data — it can&apos;t see behind walls (wiring, plumbing, framing) or under the floor. Scores are an informed starting point and valuations are estimates. Always confirm with a registered building inspection and valuation before you buy.
        </p>
      </div>
    </div>
  );
}

// ── Location facts — the 4 kept location signals, surfaced on their home tabs ──
function LocationFactCard({ subItems, ids, title }: { subItems: SubItem[]; ids: string[]; title: string }) {
  const items = ids.map((id) => subItems.find((s) => s.id === id)).filter((s): s is SubItem => Boolean(s));
  if (items.length === 0) return null;
  return (
    <div className="card p-5">
      <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</div>
      <div className="text-[11px] mt-0.5 mb-3" style={{ color: "var(--text-muted)" }}>Location context — a fact for you to weigh, not part of the score.</div>
      <div className="space-y-2.5">
        {items.map((it) => (
          <div key={it.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{it.name}</div>
              {it.finding && <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{it.finding}</div>}
            </div>
            {it.score !== null && (
              <span className="text-xs mono flex-shrink-0" style={{ color: "var(--text-secondary)" }}>{it.score}/10</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────
function OverviewReal({ locked, report, subItems, scored, persona, renoLines, renoToggles, askingPrice, improvementValuation, dwellingValue }: {
  locked: boolean;
  report: StoredReport; subItems: SubItem[]; scored: ScoreResult; persona: Persona;
  renoLines: RenoLine[]; renoToggles: Record<string, RenoToggle>; askingPrice: number | null;
  improvementValuation: ImprovementValueResult;
  dwellingValue: ExtraDwellingValueResult;
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
      {/* Condition & Quality Score — base − location penalties + on-site value-adds */}
      <ScoreBreakdown scored={scored} locked={locked} />

      {/* Improvement (building) value — spec × condition (valuation slice 1).
          Withheld on a free report: it IS the valuation. */}
      {improvementValuation && !locked && <ImprovementValueCard iv={improvementValuation} />}

      {/* Predicted value + condition breakdown */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 flex flex-col justify-center">
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Predicted sale value</div>
          {locked ? (
            <div className="mt-2">
              <div className="text-2xl font-bold mono mb-3" style={{ color: "var(--text-primary)" }}>
                <BlurredValue label="The predicted sale value needs a paid plan">$000,000</BlurredValue>
              </div>
              <UpgradeNote what="The valuation" compact />
            </div>
          ) : (
            <>
              <FutureSalePrice askingPrice={askingPrice} capitalGrowth={report.capitalGrowth} renoLines={renoLines} renoToggles={renoToggles} align="left" />
              <div className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
                See the <strong style={{ color: "var(--brand)" }}>Financial</strong> tab for the BDR Value Verdict — whether the asking price is fair once renovations are factored in.
              </div>
            </>
          )}
        </div>
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-secondary)" }}>Condition by inspection area</h3>
          <InspectionBars scored={scored} />
        </div>
      </div>

      {/* Investor Rating (investor only) — separate from the 1,000-pt quality score */}
      {persona === "investor" && (
        <InvestorRatingPanel
          askingPrice={askingPrice}
          marketRent={report.marketRent}
          renoLines={renoLines}
          renoToggles={renoToggles}
          growthScore={growthScore}
          qualityBase={scored.base}
        />
      )}

      {/* Capital growth — all users */}
      <CapitalGrowthPanel capitalGrowth={report.capitalGrowth} askingPrice={askingPrice} />

      {/* Tally */}
      <div className="grid sm:grid-cols-5 gap-3">
        {[
          { label: "Critical", v: tally.critical, c: "var(--bad)" },
          { label: "Urgent", v: tally.urgent, c: "var(--warn)" },
          { label: "Monitor", v: tally.monitor, c: "var(--warn)" },
          { label: "Good", v: tally.good, c: "var(--good)" },
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
        <div className="card p-5" style={{ border: "1px solid var(--bad-wash)" }}>
          <div className="flex items-center gap-2 font-semibold text-sm mb-3" style={{ color: "var(--bad)" }}>
            <AlertTriangle size={15} /> Priority repairs — act before making an offer
          </div>
          <div className="space-y-2">
            {repairs.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</span>
                  <span style={{ color: "var(--text-secondary)" }}> — {s.urgencyLabel}</span>
                </div>
                {/* Cost figures live on the Renovation tab only. */}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk flags — Location / Land / Legal */}
      {risks.length > 0 && (
        <div className="card p-5" style={{ border: "1px solid rgba(251,146,60,0.2)" }}>
          <div className="flex items-center gap-2 font-semibold text-sm mb-3" style={{ color: "var(--warn)" }}>
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
                  {/* Location/Land/Legal risks aren't "replaced" on a timeline — show the quality word only. */}
                  <span style={{ color: "var(--text-secondary)" }}>· {s.urgencyLabel.replace(/\s*[—–-]\s*replace within[^.]*/i, "").trim()}</span>
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
  autoInclude: boolean; // pre-ticked into the plan (score ≤30% / flagged remedy)
  valueGap?: number; // renovation upside — value reclaimed if brought to modern & as-new
  observedDefect?: string; // what's visible in THIS property's photos — keeps the plan specific
  scopeHint?: string; // real scope for compliance/paperwork lines, which have no costing recipe
  legal?: boolean; // carries a Healthy Homes legal obligation (investor)
  nonExisting?: boolean; // the feature is deteriorated / effectively absent
}

// Unified renovation list: Improvement replacement costs + Location/Land/Legal
// remediation line items, both obeying the hold-period rule.
function buildRenoLines(subItems: SubItem[], listing: StoredReport["listing"], persona: Persona, extraDwellings: ExtraDwelling[] = []): RenoLine[] {
  const lines: RenoLine[] = [];
  const ctx = {
    floorSqm: listing.floorAreaSqm ?? null,
    bedrooms: listing.bedrooms ?? null,
  };
  // Per-item building values → replacement-cost fallback + renovation upside (value gap).
  const valuation = valueImprovementItems({ subItems, floorAreaSqm: listing.floorAreaSqm, bathrooms: listing.bathrooms });
  const valueById = new Map(valuation.items.map((v) => [v.id, v]));

  for (const s of subItems) {
    // Every assessed, cost-bearing improvement item is a renovation candidate — the
    // buyer can tick it to replace it. Auto-ticked into the plan when it scores ≤30%.
    const v = valueById.get(s.id);
    if (isImprovement(s) && (s.estimatedReplacementCost || v)) {
      const col = urgencyColor(s.score);
      const category = ITEM_BY_ID[s.id]?.category;
      // Replacement cost: AI estimate if given, else derive a band from the value RCN.
      const low = s.estimatedReplacementCost?.low ?? Math.round((v?.rcnNew ?? 0) * 0.8);
      const high = s.estimatedReplacementCost?.high ?? Math.round((v?.rcnNew ?? 0) * 1.25);
      // Score fraction (persona-independent): tier band position, or raw condition.
      const frac = s.specTier ? tierBandFraction(s.specTier, s.score ?? 1) : (s.score ?? 6) / 10;
      lines.push({
        key: s.id,
        name: s.name,
        detail: s.urgencyLabel,
        low,
        high,
        urgencyYears: urgencyScoreToYears(s.score),
        detailColor: col === "red" ? "var(--bad)" : col === "amber" ? "var(--warn)" : "var(--good)",
        uplift: rentUplift(s.id),
        notes: s.estimatedReplacementCost?.notes || undefined,
        category,
        photoRefs: s.photoReferences,
        costing: costThreeTier({ id: s.id, name: s.name, category, ...ctx, fallback: { low, high } }),
        autoInclude: s.score !== null && frac <= 0.30,
        valueGap: v?.valueGap,
        observedDefect: s.observedDefect,
        legal: HH_RENO_KEYS.has(s.id),
        nonExisting: s.specTier === "deteriorated",
      });
    }
    // Legal / due-diligence remedies (e.g. a LIM report, title checks) are not
    // renovations — keep them out of the reno tab's Patch/Replace cost tiers.
    if (s.remediation && ITEM_BY_ID[s.id]?.inspection !== "legal") {
      const insp = ITEM_BY_ID[s.id]?.inspection;
      lines.push({
        key: s.id + "_rem",
        name: s.remediation.renovationLineItem,
        detail: s.remediation.description,
        badge: insp ? INSPECTION_META[insp].label : undefined,
        low: s.remediation.low,
        high: s.remediation.high,
        urgencyYears: s.remediation.urgencyYears,
        // No photo defect here: the parent item's finding is the WHY, the
        // remediation description is the WORK.
        observedDefect: s.finding,
        scopeHint: s.remediation.description,
        detailColor: "var(--brand)",
        uplift: 0,
        notes: undefined,
        costing: costThreeTier({ id: s.id + "_rem", name: s.remediation.renovationLineItem, ...ctx, fallback: { low: s.remediation.low, high: s.remediation.high } }),
        autoInclude: true, // a specifically flagged remedy — pre-ticked
      });
    }
  }

  // Extra dwelling compliance — consent + Healthy Homes to make it rentable.
  // Opt-in (never auto-ticked): it only matters if you intend to let it.
  for (const d of extraDwellings) {
    const work = dwellingComplianceWork(d);
    if (!work.needed) continue;
    lines.push({
      key: `${d.id}_compliance`,
      name: `${d.type} — consent & compliance`,
      detail: `Make it legally rentable: ${work.scope.join(", ")}`,
      badge: "Extra dwelling",
      low: work.low,
      high: work.high,
      urgencyYears: 0,
      detailColor: "var(--warn)",
      uplift: 0,
      notes: undefined,
      costing: costThreeTier({ id: `${d.id}_compliance`, name: "Extra dwelling compliance", ...ctx, fallback: { low: work.low, high: work.high } }),
      autoInclude: false,
      // Paperwork, not a visible defect: the WHY is the missing paperwork, the
      // WORK is the scope — the generic costing text would say "full replacement".
      observedDefect: `Consent and compliance status for this structure isn't confirmed, so it can't be legally rented as it stands.`,
      scopeHint: work.scope.join(", "),
      legal: true,
      nonExisting: true,
    });
  }

  // Healthy Homes draught-stopping — investor only, no equivalent quality item.
  if (persona === "investor") {
    const draught = assessHealthyHomes(subItems, listing.buildYear).find((h) => h.key === "hh_draught");
    if (draught) {
      lines.push({
        key: "hh_draught",
        name: "Draught stopping (Healthy Homes)",
        detail: draught.compliant ? "Meets the draught-stopping standard" : "Below the draught-stopping standard — gaps/holes to seal",
        low: draught.remediation.low,
        high: draught.remediation.high,
        urgencyYears: 0,
        detailColor: draught.compliant ? "var(--good)" : "var(--bad)",
        uplift: 0,
        notes: undefined,
        costing: costThreeTier({ id: "hh_draught", name: "Draught stopping", ...ctx, fallback: { low: draught.remediation.low, high: draught.remediation.high } }),
        autoInclude: !draught.compliant,
        legal: true,
        nonExisting: draught.tier === "deteriorated",
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
              style={{ border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`, background: active ? "var(--accent-wash)" : "var(--surface)" }}>
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{t.icon} {t.label}</span>
                <span className="text-sm font-bold mono" style={{ color: active ? "var(--brand)" : "var(--text-secondary)" }}>{fmt(total)}</span>
              </div>
              <p className="text-[11px] mt-1 flex-1" style={{ color: "var(--text-secondary)" }}>{t.scope}</p>
              <div className="flex items-center gap-1 mt-2">
                {(["diy", "tradie"] as LabourMode[]).map((m) => (
                  <button key={m} onClick={(e) => { e.stopPropagation(); onTier(tk); onLabour(m); }}
                    className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
                    style={{ background: labourMode === m ? "var(--brand)" : "var(--surface-2)", color: labourMode === m ? "var(--on-accent)" : "var(--text-muted)", border: "1px solid var(--border)" }}>
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

// ── "If you spent X% on this house, here's what we'd do" ─────────────────────
// A prioritised spend plan, NOT a return prediction — see lib/reno-costing/budget-plan.ts
// for why we deliberately don't publish a "this adds $Y" figure.
const BUDGET_PCTS = [0.5, 1, 2, 3, 5];

function BudgetPlanCard({ lines, price, persona }: { lines: RenoLine[]; price: number; persona: Persona }) {
  const [pct, setPct] = useState(1);
  const budget = Math.round((price * pct) / 100);
  const plan = useMemo(() => buildBudgetPlan(lines, budget, persona), [lines, budget, persona]);

  if (price <= 0 || lines.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            If you spent {pct}% of the asking price on this house
          </h3>
          <div className="text-2xl font-bold mono mt-1" style={{ color: "var(--brand)" }}>{fmt(budget)}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            This is where we&apos;d put it, in the order we&apos;d do it.
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {BUDGET_PCTS.map((p) => (
            <button
              key={p}
              onClick={() => setPct(p)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer"
              style={
                p === pct
                  ? { background: "var(--brand)", color: "var(--on-accent)" }
                  : { background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
              }
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      {plan.firstJobExceedsBudget ? (
        <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--warn-wash)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Nothing fits this budget — the first job we&apos;d do ({plan.deferred[0]?.name}) costs about{" "}
          <strong style={{ color: "var(--text-primary)" }}>{fmt(plan.deferred[0]?.cost ?? 0)}</strong>. Try a larger percentage.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {plan.included.map((l, i) => {
            const meta = PRIORITY_META[l.priority];
            return (
              <div key={l.key} className="rounded-lg p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderLeft: `3px solid ${meta.color}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs mono" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{l.name}</span>
                      {/* Several items share a name across rooms ("Flooring") — the category disambiguates. */}
                      {l.category && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--text-muted)" }}>{l.category}</span>
                      )}
                      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${meta.color}1a`, color: meta.color, border: `1px solid ${meta.color}40` }}>{meta.label}</span>
                    </div>
                    {/* What's actually visible in THIS property leads — a generic
                        "replace failed sheets" tells the buyer nothing about their house. */}
                    {l.observedDefect && (
                      <div className="text-xs mt-1.5" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        <span style={{ color: "var(--text-muted)" }}>
                          {l.photoRefs && l.photoRefs.length > 0
                            ? `Seen in photo${l.photoRefs.length > 1 ? "s" : ""} ${l.photoRefs.join(", ")}: `
                            : "Why it's on the list: "}
                        </span>
                        {l.observedDefect}
                      </div>
                    )}
                    <div className="text-xs mt-1" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      <span style={{ color: "var(--text-muted)" }}>We&apos;d do — {l.tierLabel}: </span>{l.scope}
                    </div>
                    {!l.observedDefect && (
                      <div className="text-xs mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.55 }}>{l.reason}</div>
                    )}
                  </div>
                  <span className="text-sm font-bold mono flex-shrink-0" style={{ color: "var(--text-primary)" }}>{fmt(l.cost)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {plan.included.length > 0 && (
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span style={{ color: "var(--text-secondary)" }}>
            {plan.included.length} job{plan.included.length > 1 ? "s" : ""} · <span className="mono">{fmt(plan.spent)}</span> of <span className="mono">{fmt(budget)}</span>
          </span>
          {plan.remaining > 0 && <span className="mono text-xs" style={{ color: "var(--text-muted)" }}>{fmt(plan.remaining)} unspent</span>}
        </div>
      )}

      {plan.deferred.length > 0 && plan.included.length > 0 && (
        <div className="mt-2 text-xs" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--text-secondary)" }}>Next, if you had more:</strong> {plan.deferred[0].name} ({fmt(plan.deferred[0].cost)})
          {plan.deferred[1] && <> · {plan.deferred[1].name} ({fmt(plan.deferred[1].cost)})</>}
        </div>
      )}

      <p className="text-[11px] mt-4 pt-3" style={{ color: "var(--text-muted)", lineHeight: 1.6, borderTop: "1px solid var(--border)" }}>
        Ordered by what a buyer or valuer reacts to first — legal obligations, then things that are missing or worn out, then work already due, then presentation. Costs are at tradesman rates for the cheapest option that genuinely fixes the item.{" "}
        <strong style={{ color: "var(--text-secondary)" }}>We deliberately don&apos;t quote a resale gain.</strong> What renovation returns varies far too much by suburb, street and buyer to promise a number — and over-capitalising is the most common way people lose money on a renovation.
      </p>
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
  // The plan = items ticked on the Improvements tab (auto-ticked when they score ≤30%).
  const selected = items.filter((l) => renoIncluded(l, renoToggles));
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
      {/* Section 1 — what YOU have chosen. This leads now: a reader arriving
          on this tab has already ticked items on Improvements, so their own
          plan is the thing they came back to adjust. */}
      <div>
        <div className="text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "var(--brand)" }}>Your renovation plan</div>
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>The work you&apos;ve chosen</h3>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          These are the items you&apos;ve ticked on the <strong style={{ color: "var(--text-primary)" }}>Improvements</strong> tab. Set the tier and who does the work, and the totals below follow. This is what feeds your yield and predicted sale price. Our own recommendation is further down, kept separate.
        </p>
      </div>

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
              <div className="text-2xl font-bold mono" style={{ color: "var(--good)" }}>+{fmt(upliftTotal)}<span className="text-sm">/wk</span></div>
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

      {selected.length === 0 && (
        <div className="card p-6 text-sm" style={{ color: "var(--text-secondary)" }}>
          Nothing in your renovation plan yet. On the <strong style={{ color: "var(--text-primary)" }}>Improvements</strong> tab, tick <em>&ldquo;Add to renovation plan&rdquo;</em> on any item you plan to replace — items scoring 30% or less are ticked automatically.
        </div>
      )}
      {selected.map((l) => {
        const t = renoToggles[l.key];
        const included = renoIncluded(l, renoToggles);
        return (
          <div key={l.key} className="card p-4" style={{ opacity: included ? 1 : 0.8, transition: "opacity 0.15s" }}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={included} onChange={(e) => setRenoToggle(l.key, { included: e.target.checked })} className="mt-1 w-4 h-4 cursor-pointer flex-shrink-0" aria-label={`Include ${l.name}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{l.name}</span>
                  {l.badge && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--accent-wash)", color: "var(--brand)" }}>{l.badge} remedy</span>}
                  {persona === "investor" && l.legal && l.nonExisting && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "var(--bad-wash)", color: "var(--bad)", border: "1px solid var(--bad-wash)" }}>⚖️ Must do, by law</span>
                  )}
                  {l.valueGap != null && l.valueGap > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded mono" style={{ background: "var(--good-wash)", color: "var(--good)" }} title="Value reclaimed if this item is brought to modern &amp; as-new">+{fmt(l.valueGap)} value</span>
                  )}
                  {persona === "investor" && included && l.uplift > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded mono" style={{ background: "var(--good-wash)", color: "var(--good)" }}>+${l.uplift}/wk rent</span>
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
            {included && l.costing && surfaceForKind(l.costing.kind) && materialsFor(surfaceForKind(l.costing.kind)!).length > 0 && (
              <MaterialStudio
                surface={surfaceForKind(l.costing.kind)!}
                photoUrls={listing.photoUrls}
                photoRefs={l.photoRefs}
                defaultAreaSqm={l.costing.quantity}
              />
            )}
          </div>
        );
      })}
      {/* Section 2 — what WE would do. A prioritised plan, no resale-gain
          claim. Sits below the reader's own plan rather than above it. */}
      {price > 0 && items.length > 0 && (
        <div className="pt-3 text-[11px] uppercase tracking-widest" style={{ color: "var(--brand)" }}>Our recommendation</div>
      )}
      <BudgetPlanCard lines={items} price={price} persona={persona} />

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
        <input type="number" onWheel={blurOnWheel} value={value} disabled={disabled} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
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

// ── BDR Value Verdict (Change 1) — the headline number, top of the Finance tab.
// Suburb median $/m² (scraped) × condition multiplier (the hidden quality score)
// × floor area = BDR fair value; compared against asking + selected renovations.
function ValueVerdict({ asking, improvementValuation, landAreaSqm, suburbValue, dwellingAdded = 0 }: {
  asking: number; improvementValuation: ImprovementValueResult; landAreaSqm: number | null; suburbValue?: SuburbValue; dwellingAdded?: number;
}) {
  const [open, setOpen] = useState(false);
  const land = valueLand({ landAreaSqm, suburbValue });

  if (!asking || improvementValuation.buildingValue <= 0 || !land || !suburbValue) {
    const why = !asking
      ? "Add a purchase price to see the verdict."
      : improvementValuation.buildingValue <= 0
        ? "No floor area is on file, so we can't value the improvements."
        : !land
          ? "No land area or comparable-sales data, so we can't value the land yet."
          : "Not enough data to estimate a value.";
    return (
      <div className="card p-5" style={{ border: "1px solid var(--border)" }}>
        <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: "var(--brand)" }}>BDR Value Verdict</div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{why}</p>
      </div>
    );
  }

  const rv = roiqValuation(improvementValuation.buildingValue + dwellingAdded, land);
  const verdict = asking > rv.high ? "over" : asking < rv.low ? "under" : "fair";
  const diff = rv.total - asking; // + = under (good), − = over
  const VC = verdict === "over" ? "var(--bad)" : verdict === "under" ? "var(--good)" : "var(--warn)";

  return (
    <div className="card p-5" style={{ border: `1px solid ${VC}55` }}>
      <div className="text-[11px] uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>BDR Value Verdict</div>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between"><span style={{ color: "var(--text-secondary)" }}>Land value <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· est.</span></span><span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(land.landValue)}</span></div>
        <div className="flex items-center justify-between"><span style={{ color: "var(--text-secondary)" }}>Improvement value <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· itemised</span></span><span className="mono" style={{ color: "var(--text-primary)" }}>+{fmt(rv.buildingValue - dwellingAdded)}</span></div>
        {dwellingAdded > 0 && (
          <div className="flex items-center justify-between"><span style={{ color: "var(--text-secondary)" }}>Extra dwelling <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· depreciated, less compliance</span></span><span className="mono" style={{ color: "var(--text-primary)" }}>+{fmt(dwellingAdded)}</span></div>
        )}
        <div className="flex items-center justify-between font-bold pt-1.5" style={{ borderTop: "1px solid var(--border)" }}><span style={{ color: "var(--text-primary)" }}>BDR value</span><span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(rv.total)}</span></div>
        <div className="flex items-center justify-between"><span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Likely range</span><span className="mono text-[11px]" style={{ color: "var(--text-muted)" }}>{fmt(rv.low)} – {fmt(rv.high)}</span></div>
        <div className="flex items-center justify-between pt-2"><span style={{ color: "var(--text-secondary)" }}>Asking price</span><span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(asking)}</span></div>
      </div>

      <div className="mt-4 rounded-lg p-3" style={{ background: `${VC}14`, border: `1px solid ${VC}40` }}>
        {verdict === "over" && <div className="font-bold text-sm" style={{ color: VC }}>⚠️ OVERVALUED by ~{fmt(Math.abs(diff))}</div>}
        {verdict === "under" && <div className="font-bold text-sm" style={{ color: VC }}>✅ UNDERVALUED by ~{fmt(diff)}</div>}
        {verdict === "fair" && <div className="font-bold text-sm" style={{ color: VC }}>⚖️ FAIRLY PRICED — within the estimate range</div>}
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          {verdict === "over" && "The asking price is above BDR Report's land + improvements estimate for this property."}
          {verdict === "under" && "The asking price is below BDR Report's land + improvements estimate — a potential opportunity."}
          {verdict === "fair" && "The asking price sits inside BDR Report's estimated value range for this property."}
        </p>
      </div>

      <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
        Land value is an <strong style={{ color: "var(--text-secondary)" }}>estimate</strong> from suburb comparable sales until a live sold-sales feed is connected. Always obtain a registered valuation before purchasing.
      </p>

      <button onClick={() => setOpen(!open)} className="mt-2 inline-flex items-center gap-1 text-xs cursor-pointer" style={{ color: "var(--brand)" }}>
        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        {open ? "Hide working" : "How we calculated this"}
      </button>

      {open && (
        <div className="mt-2 rounded-lg p-3 text-xs space-y-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div>
            <div className="font-semibold" style={{ color: "var(--text-primary)" }}>Land value — {suburbValue.suburb}</div>
            <div className="mono" style={{ color: "var(--text-secondary)" }}>~{fmt(land.ratePerSqm)}/m² × {land.landAreaSqm}m² (size-adjusted) = {fmt(land.landValue)}</div>
            <div style={{ color: "var(--text-muted)" }}>Extracted from {suburbValue.sampleSize} recent sales ({suburbValue.source}) — the typical sale price minus a typical building, over a standard section. Estimate until a live sold-sales feed lands.</div>
          </div>
          <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="font-semibold" style={{ color: "var(--text-primary)" }}>Improvement value — itemised (depreciated replacement cost)</div>
            <div className="mono" style={{ color: "var(--text-secondary)" }}>structure &amp; services {fmt(improvementValuation.shellValue)} + {improvementValuation.items.length} scored components {fmt(improvementValuation.componentsValue)} = {fmt(improvementValuation.buildingValue)}</div>
            {improvementValuation.totalValueGap > 0 && <div className="mono" style={{ color: "var(--text-muted)" }}>renovation upside if modernised: +{fmt(improvementValuation.totalValueGap)}</div>}
          </div>
          <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="font-semibold" style={{ color: "var(--text-primary)" }}>BDR value &amp; verdict</div>
            <div className="mono" style={{ color: "var(--text-secondary)" }}>land {fmt(land.landValue)} + improvements {fmt(rv.buildingValue)} = {fmt(rv.total)} (range {fmt(rv.low)}–{fmt(rv.high)})</div>
            <div className="mono" style={{ color: "var(--text-secondary)" }}>vs asking {fmt(asking)} → {diff >= 0 ? "under" : "over"} by {fmt(Math.abs(diff))}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function FinanceTab({ listing, persona, marketRent, capitalGrowth, renoLines, renoToggles, score, suburbValue, improvementValuation, dwellingAdded = 0 }: {
  listing: StoredReport["listing"];
  persona: Persona;
  marketRent?: MarketRent;
  capitalGrowth?: CapitalGrowth;
  renoLines: RenoLine[];
  renoToggles: Record<string, RenoToggle>;
  score: number;
  suburbValue?: SuburbValue;
  improvementValuation: ImprovementValueResult;
  dwellingAdded?: number;
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
    return <div className="card p-6 text-sm" style={{ color: "var(--text-secondary)" }}>Enter a purchase price above to run the calculator{listing.priceText ? ` — the listing says “${listing.priceText}”` : ""}.</div>;
  }

  const inputs: FinanceInputs = { ...inp, persona, holdYears, renoCost: renoTotal, price };
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
      {/* BDR Value Verdict — the most important thing a buyer needs to know. */}
      <ValueVerdict asking={price} improvementValuation={improvementValuation} landAreaSqm={listing.landAreaSqm} suburbValue={suburbValue} dwellingAdded={dwellingAdded} />

      {/* Section 9 — THE FINAL ANSWER */}
      <div className="card p-5" style={{ border: "1px solid var(--brand)", background: "linear-gradient(180deg, var(--accent-wash), transparent)" }}>
        <div className="text-[11px] uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>If you buy today and sell in {holdYears} years</div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>You walk away with</div>
            <div className="text-4xl font-bold mono" style={{ color: s.walkAway >= 0 ? "var(--good)" : "var(--bad)" }}>{fmt(s.walkAway)}</div>
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
          Put {fmt(s.totalCashIn)} in a term deposit at {inp.termDepositRatePct}% for {holdYears} years and you&apos;d have <span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(s.termDepositValue)}</span>. This property returns <span className="mono" style={{ color: s.walkAway >= 0 ? "var(--good)" : "var(--bad)" }}>{fmt(s.walkAway)}</span>.
        </div>
      </div>

      {/* Section 1 — Purchase details */}
      <FinSection title="Purchase details">
        <FinNum label="Purchase price" value={inp.price} onChange={(v) => set({ price: v })} />
        <FinRow label="Hold period (set by the slider above)" value={`${holdYears} years`} />
        <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Deposit</span>
          <span className="inline-flex items-center gap-1">
            <input type="number" onWheel={blurOnWheel} value={Math.round(inp.depositPct * 100)} onChange={(e) => set({ depositPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 })} className="rounded px-2 py-1 text-sm w-16 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
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
            <input type="number" onWheel={blurOnWheel} step={0.01} value={inp.interestRatePct} onChange={(e) => set({ interestRatePct: Math.max(0, Number(e.target.value) || 0) })} className="rounded px-2 py-1 text-sm w-20 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
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
        {rateErr && <div className="text-[11px] mb-1" style={{ color: "var(--bad)" }}>{rateErr}</div>}
        <div className="flex items-center gap-2 py-1.5 text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Loan type</span>
          <div className="flex gap-1">
            {(["pi", "io"] as LoanType[]).map((lt) => (
              <button key={lt} onClick={() => set({ loanType: lt })} className="text-xs px-2 py-0.5 rounded cursor-pointer" style={{ background: inp.loanType === lt ? "var(--brand)" : "var(--surface-2)", color: inp.loanType === lt ? "var(--on-accent)" : "var(--text-muted)", border: "1px solid var(--border)" }}>{lt === "pi" ? "Principal & interest" : "Interest only"}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Loan term</span>
          <span className="inline-flex items-center gap-1"><input type="number" onWheel={blurOnWheel} value={inp.loanTermYears} onChange={(e) => set({ loanTermYears: Math.max(1, Math.min(30, Number(e.target.value) || 30)) })} className="rounded px-2 py-1 text-sm w-16 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>years</span></span>
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
            <span className="inline-flex items-center gap-1"><span className="text-xs" style={{ color: "var(--text-muted)" }}>$</span><input type="number" onWheel={blurOnWheel} value={inp.purchaseCosts[k]} disabled={!inp.purchaseCostsEnabled[k]} onChange={(e) => setCost(k, Math.max(0, Number(e.target.value) || 0))} className="rounded px-2 py-1 text-sm w-24 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)", opacity: inp.purchaseCostsEnabled[k] ? 1 : 0.4 }} /></span>
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
            <span className="inline-flex items-center gap-1"><input type="number" onWheel={blurOnWheel} value={inp.vacancyWeeks} onChange={(e) => set({ vacancyWeeks: Math.max(0, Number(e.target.value) || 0) })} className="rounded px-2 py-1 text-sm w-14 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>wks/yr</span></span>
          </div>
          <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <label className="inline-flex items-center gap-2 cursor-pointer" style={{ color: "var(--text-secondary)" }}><input type="checkbox" checked={inp.mgmtEnabled} onChange={() => set({ mgmtEnabled: !inp.mgmtEnabled })} className="w-3.5 h-3.5 cursor-pointer" />Property management</label>
            <span className="inline-flex items-center gap-1"><input type="number" onWheel={blurOnWheel} step={0.5} value={Math.round(inp.mgmtFeePct * 1000) / 10} disabled={!inp.mgmtEnabled} onChange={(e) => set({ mgmtFeePct: Math.max(0, Number(e.target.value) || 0) / 100 })} className="rounded px-2 py-1 text-sm w-14 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)", opacity: inp.mgmtEnabled ? 1 : 0.4 }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>%</span></span>
          </div>
          <div className="mt-2 rounded-lg p-3" style={{ border: `1px solid ${cf >= 0 ? "var(--good)" : "var(--bad)"}`, background: cf >= 0 ? "var(--good-wash)" : "var(--bad-wash)" }}>
            <div className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Net weekly cash flow</div>
            <div className="text-2xl font-bold mono" style={{ color: cf >= 0 ? "var(--good)" : "var(--bad)" }}>{cf >= 0 ? "+" : ""}{fmt(cf)}/wk</div>
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
          <span className="inline-flex items-center gap-1 ml-2">override <input type="number" onWheel={blurOnWheel} step={0.1} value={inp.growthPct} onChange={(e) => set({ growthPct: Number(e.target.value) || 0 })} className="rounded px-1.5 py-0.5 text-xs w-14 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />%</span>
        </div>
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <LineChart data={s.projection} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
              <YAxis tickFormatter={(v) => fmtShort(v as number)} tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={48} />
              <Tooltip formatter={(v) => fmt(v as number)} labelFormatter={(l) => `Year ${l}`} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="value" name="Property value" stroke="var(--accent)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="equity" name="Your equity" stroke="var(--good)" strokeWidth={2} dot={false} />
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
          <span className="inline-flex items-center gap-1"><input type="number" onWheel={blurOnWheel} step={0.1} value={Math.round(inp.agentCommissionPct * 1000) / 10} onChange={(e) => set({ agentCommissionPct: Math.max(0, Number(e.target.value) || 0) / 100 })} className="rounded px-2 py-1 text-sm w-16 mono text-right" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>% = {fmt(s.agentFees)}</span></span>
        </div>
        <FinNum label="Legal fees at sale" value={inp.legalAtSale} onChange={(v) => set({ legalAtSale: v })} />
        <div className="mt-1 pt-2" style={{ borderTop: "1px solid var(--border)" }}><FinRow label="Total sale costs" value={fmt(s.agentFees + s.saleLegal)} strong /></div>
      </FinSection>

      {/* Section 8 — Tax */}
      <FinSection title="Tax (NZ)">
        <div className="rounded-lg p-3 text-sm" style={{ background: s.brightLineApplies ? "var(--bad-wash)" : "var(--good-wash)", border: `1px solid ${s.brightLineApplies ? "var(--bad)" : "var(--good)"}`, color: "var(--text-secondary)" }}>
          {s.brightLineApplies
            ? <>⚠️ <strong style={{ color: "var(--bad)" }}>Bright-line test applies</strong> (holding under {FINANCE_DEFAULTS.brightLineYears} years). Any capital gain may be taxed as income. Consult your accountant.</>
            : <>✅ <strong style={{ color: "var(--good)" }}>Outside the bright-line period</strong> ({holdYears} years ≥ {FINANCE_DEFAULTS.brightLineYears}). No bright-line tax applies (consult your accountant).</>}
        </div>
        {isInvestor && (
          <div className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>✅ Mortgage interest is fully deductible against rental income (from April 2024). Est. annual tax saving at {inp.taxRatePct}%: <span className="mono" style={{ color: "var(--good)" }}>{fmt(s.interestDeductSaving)}</span>.</div>
        )}
        <div className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>Tax figures are estimates only — speak to a qualified NZ accountant.</div>
      </FinSection>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Every field is editable; the walk-away figure updates live. Council rates + insurance are estimates (verify with the council and an insurer). Renovations come from your Renovations-tab selections; hold period is the slider at the top.</p>
    </div>
  );
}

// (The old Hazard tab is retired — Land/Legal now live in the Property tab,
//  rendered with full depth by components/PropertyInspections.)

// ── Healthy Homes (investor only) — the 5 legal standards, scored + reno-tickable
const HH_TIER_COLOR: Record<string, string> = { deteriorated: "var(--bad)", dated: "var(--text-muted)", modern: "var(--brand)", luxury: "var(--warn)" };
const hhPointsColor = (f: number): string => (f >= 0.7 ? "var(--good)" : f >= 0.4 ? "var(--warn)" : "var(--bad)");

function HealthyHomesSection({ subItems, buildYear, renoControls, onOpenRenovations }: {
  subItems: SubItem[]; buildYear: number | null; renoControls: RenoControls; onOpenRenovations: () => void;
}) {
  const results = assessHealthyHomes(subItems, buildYear);
  const toFix = results.filter((r) => !r.compliant).length;

  return (
    <div className="rounded-2xl p-5" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield size={16} style={{ color: "var(--brand)" }} />
          <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>Healthy Homes — rental compliance</h3>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: toFix ? "var(--bad-wash)" : "var(--good-wash)", color: toFix ? "var(--bad)" : "var(--good)" }}>
          {toFix ? `${toFix} of 5 to remediate` : "All 5 standards met"}
        </span>
      </div>
      <p className="text-xs mt-1 mb-4" style={{ color: "var(--text-muted)", lineHeight: 1.55 }}>
        The 5 legal standards for renting a property, scored the same way as the rest of the improvements. Anything non-existing is a <strong style={{ color: "var(--text-secondary)" }}>must-do by law</strong> before you can tenant — tick it to add it to your renovation plan.
      </p>

      <div className="space-y-3">
        {results.map((r) => {
          const canReno = renoControls.has(r.renoKey);
          const inPlan = canReno && renoControls.included(r.renoKey);
          const c = hhPointsColor(r.fraction);
          return (
            <div key={r.key} className="rounded-xl overflow-hidden" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderLeft: `3px solid ${c}` }}>
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{r.label}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: r.compliant ? "var(--good-wash)" : "var(--bad-wash)", color: r.compliant ? "var(--good)" : "var(--bad)" }}>
                      {r.compliant ? "Compliant" : "⚖️ Must do, by law"}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>{r.requirement}</p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  <span className="inline-flex flex-col items-center rounded-lg" style={{ background: `${c}1f`, border: `1px solid ${c}55`, padding: "2px 10px", minWidth: 64 }}>
                    <span className="uppercase font-medium" style={{ fontSize: 9, letterSpacing: "0.07em", color: "var(--text-muted)" }}>Points</span>
                    <span className="font-bold tabular-nums" style={{ color: c, fontFamily: "Fira Code, monospace", fontSize: 13, lineHeight: 1.3 }}>{r.earned}/{r.maxPoints}</span>
                  </span>
                  <span className="inline-flex flex-col items-center rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "2px 10px", minWidth: 84 }}>
                    <span className="uppercase font-medium" style={{ fontSize: 9, letterSpacing: "0.07em", color: "var(--text-muted)" }}>Status</span>
                    <span className="font-bold whitespace-nowrap" style={{ color: HH_TIER_COLOR[r.tier], fontFamily: "Fira Code, monospace", fontSize: 11, lineHeight: 1.3 }}>{hhStatusLabel(r)}</span>
                  </span>
                </div>
              </div>
              {canReno && (
                <div className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ borderTop: "1px solid var(--border)", background: inPlan ? "var(--accent-wash)" : "transparent" }}>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={inPlan} onChange={(e) => renoControls.toggle(r.renoKey, e.target.checked)} className="w-4 h-4 cursor-pointer flex-shrink-0" aria-label={`Add ${r.label} to the renovation plan`} />
                    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: inPlan ? "var(--brand)" : "var(--text-secondary)" }}>
                      <Wrench size={11} />
                      {inPlan ? "In your renovation plan" : "Add to renovation plan"}
                    </span>
                  </label>
                  {inPlan && (
                    <button onClick={onOpenRenovations} className="inline-flex items-center gap-0.5 text-xs font-medium cursor-pointer hover:underline" style={{ color: "var(--brand)" }}>
                      View <ArrowRight size={11} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
        Indicative from the listing + build era{buildYear ? ` (c.${buildYear})` : ""}. Engage a certified Healthy Homes assessor before tenanting.
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
