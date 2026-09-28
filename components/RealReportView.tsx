"use client";

import { blurOnWheel } from "@/lib/ui/number-input";
import { useState, useMemo, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { PropertyTab } from "@/components/PropertyTab/PropertyTab";
import { HoldPeriodProvider, useHoldPeriod, urgencyScoreToYears } from "@/lib/hold-period/context";
import { HoldPeriodSlider } from "@/components/HoldPeriodSlider";
import { ReportGapBanner } from "@/components/ReportGapBanner";
import type { ReportGap } from "@/lib/property-tab/gaps";
import { urgencyColor, urgencyLabel, type RenoControls } from "@/lib/property-tab/types";
import type { SubItem, ExtraDwelling, ShowerType, FloorType } from "@/lib/property-tab/types";
import type { StoredReport, DocAnalysis } from "@/lib/report-store";
import { loadReportPersona, saveReportPersona, saveReportDocs } from "@/lib/report-store";
import { valueRoof, roofMaterialFromText } from "@/lib/scoring/roof-value";
import { valueItem, isItemWithheld } from "@/lib/scoring/item-value";
import { IMPROVEMENT_BASE_COSTS } from "@/lib/scoring/improvement-values";
import { applyRoomPhotos } from "@/lib/viewing/rooms";
import type { AnyValuation } from "@/components/PropertyTab/valuation-types";
import { labourMultiplierFor } from "@/lib/labour-rates";
import { actionFor, actionCost } from "@/lib/scoring/depreciation";
import { scoreFor, improvementsCategories } from "@/lib/scoring/report";
import type { ScrapedListing } from "@/lib/scraper/types";
import { valueLand, roiqValuation } from "@/lib/scoring/valuation";
import { adjustLand, siteFactsFrom } from "@/lib/scoring/land-value";
import { LandValueWorkings } from "@/components/PropertyInspections/LandValueWorkings";
import { TitleLegalTab } from "@/components/Legal/TitleLegalTab";
import { unconsentedSignal } from "@/lib/scoring/applies";
import { withMeasuredSite } from "@/lib/scoring/measured-site";
import { methodFor, comparablesMatch } from "@/lib/scoring/valuation-method";
import { valueProperty, type PropertyValue } from "@/lib/scoring/property-value";
import type { SiteLayout } from "@/lib/scoring/site-layout";
import { explainCrossLeaseDiscount } from "@/lib/scoring/cross-lease";
import type { ValuationRange } from "@/lib/scoring/valuation-range";
import { maintenanceBasis } from "@/lib/finance/maintenance";
import { landValuePublishable } from "@/lib/scoring/land-quality";
import { compareFloorArea } from "@/lib/property/floor-area-check";
import { valueImprovementItems, roomKindOf, DEFAULT_BEDROOMS, SHOWER_MEMBRANE, FLOOR_MEMBRANE, showerTypeOf, floorTypeOf, type ImprovementValueResult } from "@/lib/scoring/improvement-values";
import { assessHealthyHomes, HH_RENO_KEYS, type HHResult } from "@/lib/scoring/healthy-homes";
import { assessDevelopment, type DevelopmentPotential } from "@/lib/scoring/development";
import type { PlacedStructure } from "@/components/PropertyInspections/AddStructure";
import { assessSectionSize, assessTopography, assessShape, assessAspect, assessFrontage } from "@/lib/scoring/land-quality";
import { assessTitleType, assessEncumbrances, assessEasements } from "@/lib/scoring/title";
import { valueExtraDwellings, dwellingComplianceWork, type ExtraDwellingValueResult, type DwellingValue } from "@/lib/scoring/extra-dwelling-value";
import { PropertyInspections } from "@/components/PropertyInspections/PropertyInspections";
import { SendReportDialog } from "@/components/SendReportDialog";
import { MANDATORY_CATEGORIES, categoryLabel } from "@/lib/photo-categories";
import {
  projectValue, cumulativeGrowthPct, grossYieldPct, netYieldPct, estimateAnnualCosts, vacancyRisk,
} from "@/lib/scoring/investment";
import type { CapitalGrowth, MarketRent, SuburbValue } from "@/lib/scoring/investment";
import { costThreeTier, tierTotal, TIER_ORDER, scaleTier, isScalableKind } from "@/lib/reno-costing/three-tier";
import type { ThreeTierCost, TierCost, Tier, LabourMode } from "@/lib/reno-costing/three-tier";
import { MaterialStudio } from "@/components/MaterialStudio";
import { ViewingChecklist } from "@/components/Viewing/ViewingChecklist";
import { buildViewingChecklist, checklistStatus, EMPTY_VIEWING, type ViewingState } from "@/lib/viewing/checklist";
import { loadViewing, saveViewing, syncViewing, setAnswer, setNote, setViewedOn, setItemPhoto, clearItemPhoto, setRoomPhotos } from "@/lib/viewing/store";
import type { ItemPhotoAnalysis } from "@/lib/viewing/photo-types";
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
import { Step, EvidenceList } from "@/components/PropertyTab/ItemValuation";
import { evidenceFor, mergeEvidence } from "@/lib/scoring/condition-evidence";
import { citedPhotos, mergePhotoRefs } from "@/lib/photo-refs";
import {
  Home, Building2, ChevronRight, Wrench, Calculator, ClipboardList, ClipboardCheck, Shield, MapPin, Handshake,
  ExternalLink, AlertTriangle, ImageIcon, Info, Sparkles, ShieldAlert,
  TrendingUp, Zap, Percent, ChevronDown, ChevronUp, RefreshCw, Loader2, ArrowRight, Send, History, Lock, FileText,
} from "lucide-react";

import Link from "next/link";

import { useSession } from "@/lib/auth/session";
import { BlurredValue, UpgradeNote, LockedTab } from "@/components/report/Locked";
import { includes as hasFeature, type Feature } from "@/lib/billing/plans";
import { type InspectionEvidence } from "@/lib/viewing/status";
import { PRODUCT_NAME, PRODUCT_SHORT_NAME } from "@/lib/brand";
import { alpha } from "@/lib/ui/color";

type Tab = "overview" | "improvements" | "address" | "legal" | "citytown" | "renovations" | "financial" | "viewing";

const TAB_DEFS: { id: Tab; label: string; icon: React.ElementType; investorOnly?: boolean }[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "improvements", label: "Improvements", icon: Building2 },
  { id: "address", label: "Land", icon: ClipboardList },
  { id: "legal", label: "Title & legal", icon: FileText },
  { id: "renovations", label: "Renovations", icon: Wrench },
  { id: "financial", label: "Financial", icon: Calculator },
  { id: "viewing", label: "Viewing checklist", icon: ClipboardCheck },
];

/**
 * Tabs a free report doesn't open.
 *
 * The free report runs the full analysis and shows every photo finding —
 * that's what proves the product works on your own listing. What it holds back
 * is the conclusion: what the property is worth, what it costs to fix, and what
 * to say to the agent.
 */
/**
 * Tabs a bare-land report doesn't have. Improvements describes a building that
 * isn't there, and Renovations prices work on it — showing either as an empty
 * shell reads as a failure rather than a property without a house on it.
 */
const LAND_HIDDEN_TABS = new Set<Tab>(["improvements", "renovations"]);

/**
 * Tabs a plan can be short of, what's inside each, and the feature that opens
 * it. The feature — not the plan name — is the gate: which tier carries it is
 * decided once, in lib/billing/plans.ts, so moving a tab between packages never
 * means editing this file.
 */
const LOCKED_TABS: Record<string, { title: string; blurb: string; includes: string[]; feature: Feature }> = {
  financial: {
    feature: "tools",
    title: "Financial",
    blurb: "The valuation and the numbers behind it, worked from the condition findings you can already see.",
    includes: [
      `${PRODUCT_SHORT_NAME} Value Verdict — is the asking price fair once repairs are counted`,
      "Land and improvement value, with the working shown",
      "Yield, cash flow and the 10-year equity timeline",
      "Your own deposit, rate and hold period applied throughout",
    ],
  },
  renovations: {
    feature: "tools",
    title: "Renovations",
    blurb: "Every flagged item costed at New Zealand rates, and what fixing it does to the property's value.",
    includes: [
      "Line-by-line costs for each defect found",
      "Toggle items in and out to see the effect",
      "Budget and premium options per item",
      "What the work adds back in value",
    ],
  },
};

/**
 * Items that leave with the vendor, or are haggled over on the sale and purchase
 * agreement rather than priced into the offer. They still score and still cost —
 * they just don't belong in "act before making an offer".
 */
const CHATTELS = new Set(["kit_appliances"]);

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;
const inspOf = (id: string): Inspection | undefined => ITEM_BY_ID[id]?.inspection;
const isImprovement = (s: SubItem) => inspOf(s.id) === "improvements";

// Indicative weekly rent uplift (investor only) when a flagged item is renovated.
const RENT_UPLIFT: Record<string, number> = {
  kit_cabinetry: 35, kit_appliances: 18, kit_benchtop: 12, kit_flooring: 8,
  bath_shower: 25, bath_vanity: 10, bath_flooring: 6,
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
/**
 * Is this line in the plan?
 *
 * An explicit tick or untick ALWAYS wins — this only sets the default.
 *
 * The default now includes anything that falls due inside the hold period, and
 * that is the fix for a figure which used to be completely deaf to the slider:
 * the demo's renovation total read $3,859 at a three-year hold and $3,859 at a
 * fifteen-year one, with a 4/10 roof and an $18,000–$28,000 range sitting
 * outside the plan at every setting. Work that reaches end of life while you own
 * the house is money you will spend, whether or not anybody ticked a box —
 * and if you don't spend it you sell a house with a dead roof, which costs you
 * at the other end instead. Either way it belongs in the walk-away.
 *
 * `autoInclude` stays for what is urgent or legally required NOW, since that is
 * true at any hold length.
 */
const renoIncluded = (
  l: { key: string; autoInclude: boolean; stopGap?: boolean; wholeRoom?: boolean; optIn?: boolean },
  toggles: Record<string, RenoToggle>,
  dueWithinHold = false
): boolean =>
  toggles[l.key]?.included ??
  // A whole-room refit REPLACES the room's individual lines, which are already
  // in by default — letting it in on the hold too put the same kitchen in the
  // plan twice. It's the reader's call, so it only ever comes in by a tick.
  // Same for `optIn` lines — making an extra dwelling or pool legally rentable
  // only matters if you mean to let it, so it's never assumed.
  (l.autoInclude || (dueWithinHold && !l.stopGap && !l.wholeRoom && !l.optIn));

/**
 * Work due within about a year is money you find at settlement; anything later
 * you pay for out of income while you own the place. The split matters because
 * "Total money needed to buy" is a real question with a real answer, and once
 * the plan started following the hold slider it was answering it with the price
 * of a roof due in year seven.
 */
export const UPFRONT_RENO_YEARS = 1;

type PlanFlags = { key: string; urgencyYears: number; autoInclude: boolean; stopGap?: boolean; wholeRoom?: boolean; optIn?: boolean };
type PlanLine = PlanFlags & { costing?: ThreeTierCost; low: number; high: number };

/**
 * TWO halves of the plan, and every total reads them the same way.
 *
 * At purchase: the ticked lines — ticked by the reader, or pre-ticked because
 * the work is needed the day you buy or before you can rent it out (see
 * `autoInclude`). Counted whatever the hold: you've said you'll do it.
 *
 * During the hold: not ticked, but it reaches end of life while you own the
 * place and nobody unticked it. A 30%-condition roof may well last a few more
 * years, so it isn't ticked — but on a ten-year hold it is still money you
 * will spend, so it is still counted.
 */
const inAtPurchase = (l: PlanFlags, toggles: Record<string, RenoToggle>) => renoIncluded(l, toggles, false);
const inDuringHold = (l: PlanFlags, toggles: Record<string, RenoToggle>, withinHold: (years: number) => boolean) =>
  !inAtPurchase(l, toggles) && withinHold(l.urgencyYears) && renoIncluded(l, toggles, true);

function renoSplit(lines: PlanLine[], toggles: Record<string, RenoToggle>, withinHold: (years: number) => boolean) {
  let atPurchase = 0;
  let duringHold = 0;
  for (const l of lines) {
    if (inAtPurchase(l, toggles)) atPurchase += lineCost(l, toggles[l.key]);
    else if (inDuringHold(l, toggles, withinHold)) duringHold += lineCost(l, toggles[l.key]);
  }
  return { atPurchase, duringHold };
}

/** Everything in the plan: what's ticked, plus what falls due inside the hold. */
function selectedRenoCost(lines: PlanLine[], toggles: Record<string, RenoToggle>, withinHold: (years: number) => boolean): number {
  const { atPurchase, duringHold } = renoSplit(lines, toggles, withinHold);
  return atPurchase + duringHold;
}

/**
 * What the ticked renovations add to what the property is WORTH — the app's own
 * valuation model, not a market resale promise.
 *
 * `valueGap` is `valuePotential − valueNow` out of `improvement-values.ts`,
 * where potential is **modern spec at as-new condition**. That is what a genuine
 * replacement gets you, so only Replace Budget and Replace High End count here.
 *
 * A PATCH contributes nothing, deliberately. Re-grouting a shower or repainting
 * cabinet doors moves neither the spec tier nor the condition to as-new, and
 * there is no principled figure in the model for a partial restoration — picking
 * one would be the invented-number habit in a new place. Zero errs toward the
 * conservative side, which is the right direction when over-capitalising is the
 * usual way people lose money on a renovation.
 */
function selectedRenoUplift(
  lines: { key: string; valueGap?: number; urgencyYears: number; autoInclude: boolean; stopGap?: boolean; wholeRoom?: boolean; optIn?: boolean }[],
  toggles: Record<string, RenoToggle>,
  withinHold: (years: number) => boolean
): number {
  return lines
    .filter((l) => inAtPurchase(l, toggles) || inDuringHold(l, toggles, withinHold))
    .filter((l) => (toggles[l.key]?.tier ?? "budget") !== "patch")
    .reduce((sum, l) => sum + (l.valueGap ?? 0), 0);
}

/** Pull a dollar figure out of a "no firm price" label like "Enquiries Over $629,000". */
function parseOverPrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.replace(/,/g, "").match(/\$?\s*(\d{5,9})/);
  const n = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(n) && n >= 50000 ? n : null;
}

/** Editable purchase price — defaults to the listing/parsed price, commits on blur or Enter. */
function PurchasePriceBar({ value, priceText, onChange, modelledPrice }: {
  value: number | null; priceText: string | null; onChange: (n: number | null) => void;
  /** Our own valuation, used while the listing states no firm price. */
  modelledPrice?: number | null;
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
              ? `No firm price on the listing${priceText ? ` — it says “${priceText}”` : ""}.${modelledPrice ? ` The numbers below run on ${PRODUCT_SHORT_NAME}'s own valuation of ${fmt(modelledPrice)} until you enter one.` : " Enter a price to run the numbers."}`
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
  report: storedReport,
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
  // Items the model no longer has are dropped on the way in. Waterproofing was
  // removed (a consented bathroom was inspected for it) and older saved reports
  // still carry it; nothing downstream should have to know that.
  const report = useMemo(
    () => ({ ...storedReport, subItems: (storedReport.subItems ?? []).filter((s) => ITEM_BY_ID[s.id]) }),
    [storedReport]
  );
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
  const { entitlements, loading: planLoading } = useSession();
  const isSample = !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(report.id);
  // While the session is loading, assume unlocked — a moment of visible content
  // is a smaller wrong than showing a paying customer an upgrade wall.
  //
  // Gates apply at all only to a real report someone is reading on their own
  // account; `has` then answers per feature, because the tiers no longer agree
  // about which tabs open. The Financial and Renovations tabs come with the
  // cheapest purchase; only the map is sold separately.
  const gated = !shared && !embedded && !isSample && !planLoading;
  const has = (f: Feature) => !gated || hasFeature(entitlements, f);
  const locked = !has("score");
  const tabLocked = (t: string) => {
    const meta = LOCKED_TABS[t];
    return !!meta && !has(meta.feature);
  };
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

  // ── The viewing ────────────────────────────────────────────────────────────
  // What the buyer settled at the property: the checklist answers, the date they
  // went, and any item they photographed and had assessed. Declared here because
  // those photographs feed the effective sub-items below — an item somebody has
  // now photographed is no longer an item nobody has seen.
  const [viewing, setViewing] = useState<ViewingState>(EMPTY_VIEWING);
  useEffect(() => {
    // The device's copy first, so a checklist answered at the property is on
    // screen immediately and with no network. The server's copy is folded in
    // after, which is what carries a viewing from the laptop to the phone.
    const local = loadViewing(report.id);
    setViewing(local);
    let live = true;
    void syncViewing(report.id, local).then((merged) => { if (live) setViewing(merged); });
    return () => { live = false; };
  }, [report.id]);
  const itemPhotos = viewing.photos ?? {};

  function updateViewing(next: ViewingState) {
    setViewing(next);
    saveViewing(report.id, next);
  }

  // Effective scores: a verified document overrides the score for its item;
  // an unverified document item (LIM/consent/EQC) is excluded from the total
  // entirely until a document is uploaded.
  // No photos at all → we cannot visually confirm ANY Improvements condition, so
  // we must not show a score for those items (a scraped 0-photo listing was giving
  // "Roof 5/10" with nothing to look at). Location/Land/Legal are fact-based and
  // keep their scores.
  const noPhotos = report.photosAnalysed === 0;
  // A report written before the parcel was fetched can still have its section
  // drawn: the geometry is public record for an address, not something the
  // analysis produced. Asking for it on open beats telling somebody to spend
  // another allowance and four minutes re-running findings that were fine.
  const [fetchedLayout, setFetchedLayout] = useState<SiteLayout | null>(null);
  useEffect(() => {
    if (report.listing.siteLayout || fetchedLayout) return;
    const address = [report.listing.address, report.listing.suburb, report.listing.city]
      .filter(Boolean)
      .join(", ")
      .trim();
    if (!address) return;
    let live = true;
    fetch(`/api/site-geometry?address=${encodeURIComponent(address)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.layout) setFetchedLayout(d.layout as SiteLayout); })
      // Best-effort throughout. No parcel means the plan falls back to its
      // plain drawing, which is what an older report showed anyway.
      .catch(() => {});
    return () => { live = false; };
  }, [report.listing.siteLayout, report.listing.address, report.listing.suburb, report.listing.city, fetchedLayout]);

  const siteLayout = report.listing.siteLayout ?? fetchedLayout ?? null;

  const effectiveSubItems = useMemo(
    () =>
      report.subItems.map((s) => {
        // The buyer photographed it at the property and it went back through the
        // vision analysis. That outranks every rule below — including the Tier 3
        // strip and the no-photos strip, both of which exist precisely because
        // nobody had looked at this item. Somebody has now.
        const shot = itemPhotos[s.id];
        if (shot?.showsItem) {
          return {
            ...s,
            score: shot.score as typeof s.score,
            // The label travels with the score or the report reads "Average"
            // beside 2/10 — the original label described the desktop guess.
            urgencyLabel: urgencyLabel(shot.score),
            confidenceTier: shot.confidenceTier,
            condition: shot.condition,
            material: shot.material,
            estimatedAge: shot.estimatedAge,
            specTier: shot.specTier ?? s.specTier,
            observedDefect: shot.observedDefect ?? s.observedDefect,
            // The buyer's own photographs are the better evidence when they have it.
            conditionEvidence: shot.conditionEvidence?.length ? shot.conditionEvidence : s.conditionEvidence,
            // The buyer's photos are of the item now; the work is what THEY show.
            urgentAction: shot.urgentAction,
            aiSummary: shot.summary || s.aiSummary,
            evidenceSource: `Your own photo${shot.photoCount === 1 ? "" : "s"}, taken at the property`,
            estimatedReplacementCost: shot.estimatedReplacementCost ?? s.estimatedReplacementCost,
            noPhotoNotAssessed: false,
            // The listing's photo numbers described a different set of pictures.
            photoReferences: [],
            // A photo of the item as a whole, on an item read room by room,
            // can't say which room it's of — so the per-room reads go and the
            // photo values it whole, rather than being silently ignored. New
            // photos of room items ask which room, and don't land here.
            byRoom: undefined,
          };
        }
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
        // The TITLE is scored from its tenure, not from the model reading a
        // listing. Same arrangement as the foundation and the land items: the
        // fact comes from the register, the report does the arithmetic. The
        // model was returning 9/10 "Freehold" on one property and "Not assessed
        // — not visible in the listing" on another with the same known freehold
        // tenure. A tenure is a category; it is not the model's to forget.
        if (s.id === "leg_title") {
          // A cross lease is the one tenure whose burden genuinely varies
          // between properties, so it gets the site with it: how many flats
          // share the title (the LINZ share denominator) and how separate the
          // analysis could see they are. Same model that sizes the valuation
          // discount, so the score and the money can't disagree about a house.
          const share = report.listing.landShareFraction;
          const t = assessTitleType(report.listing.titleType, {
            coOwners: report.listing.landCoOwners ?? (share && share > 0 ? Math.round(1 / share) : null),
            sharing: report.context?.crossLeaseSharing,
          });
          if (t) {
            return {
              ...s,
              score: t.score as typeof s.score,
              urgencyLabel: urgencyLabel(t.score as never),
              confidenceTier: t.confidenceTier,
              finding: t.finding,
              evidenceSource: "LINZ record of title",
              aiSummary: t.rationale,
            };
          }
        }
        // The two title-instrument items are scored from the REGISTER, not from
        // a model reading photographs. They used to come back 2/2 "Low concern"
        // badged "Confirmed from the public record" against a record nobody had
        // read. Skipped entirely when the register wasn't read: the model's
        // answer is at least honest about being an inference, where an invented
        // "nothing registered" would be a false all-clear.
        if (s.id === "leg_encumbrances" || s.id === "leg_easements") {
          // memorialsFound === 0 means LINZ published NO register for this
          // title — about 17% of live titles. From out here that is
          // indistinguishable from a clean title, so the item is left unscored
          // rather than handed an all-clear it hasn't earned.
          const enc = report.listing.encumbrances;
          const live = enc && enc.memorialsFound > 0 ? enc.live : null;
          if (live) {
            const t = s.id === "leg_encumbrances" ? assessEncumbrances(live) : assessEasements(live);
            if (t) {
              return {
                ...s,
                score: t.score as typeof s.score,
                urgencyLabel: urgencyLabel(t.score as never),
                confidenceTier: t.confidenceTier,
                finding: t.finding,
                evidenceSource: "LINZ record of title",
                aiSummary: t.rationale,
              };
            }
          }
        }
        // Aspect is MEASURED off the parcel and the road centreline, not read
        // off a photograph. On 156 Buchanans Road the analysis wrote "Buchanans
        // Road running roughly north-south" and scored a south-west aspect at
        // 5/10 — the road runs east-west and the section faces NORTH, which is
        // the best aspect in the country. It turned the property's biggest
        // natural advantage into a mark against it, from an aerial image that
        // carries no compass.
        // Orientation, shape and frontage are MEASURED off the LINZ parcel,
        // the legal road land and the road line when those were fetched — see
        // lib/scoring/measured-site.ts, which the map pin uses too. On 156
        // Buchanans Road the analysis read a south-west aspect off an aerial
        // with no compass; the section faces north.
        if (s.id === "land_aspect" || s.id === "land_shape" || s.id === "land_frontage" || s.id === "land_topography") {
          s = withMeasuredSite(s, siteLayout);
        }
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
      })
      // Rooms the buyer photographed at the property: each read goes onto
      // THAT room, and the valuation re-reads the item room by room.
      .map((s) => applyRoomPhotos(s, itemPhotos)),
    [report.subItems, verifiedDocs, itemPhotos, noPhotos, report.listing.landAreaSqm]
  );

  // THE SCORE: re-runs scoreProperty() for the chosen persona + verified docs.
  // Pure + instant — drives the dial, bars, grade, and gating. Recomputes the
  // moment a document is uploaded (auto-rescore).
  // What the register says could bear on building here. Empty when there is
  // nothing registered; empty ALSO when LINZ publishes no memorials for this
  // title, which is why `memorialsFound` gates it — see lib/linz/encumbrances.ts.
  const titleRestrictions = useMemo(() => {
    const enc = report.listing.encumbrances;
    if (!enc || enc.memorialsFound === 0) return null;
    return enc.live
      .filter((e) => e.kind === "covenant" || e.kind === "easement")
      .map((e) => ({ instrumentNo: e.instrumentNo, label: e.label, kind: e.kind as "covenant" | "easement" }));
  }, [report.listing.encumbrances]);

  // Development potential — can you add a tiny home / dwelling / subdivide (Land tab).
  const development = useMemo(
    () =>
      assessDevelopment({
        landAreaSqm: report.listing.landAreaSqm,
        floorAreaSqm: report.listing.floorAreaSqm,
        suburbMedianPerSqm: report.suburbValue?.medianPerSqm ?? null,
        // Fetched from the council's own district-plan service when the report
        // was run, so the finding states the zone instead of asking the reader
        // to go and look it up.
        zone: report.listing.zoning ?? null,
        // Covenants and easements off the record of title. Only when LINZ
        // actually published a register for it — an unread register is not a
        // clear one, and this finding must not read as though it were.
        titleRestrictions: titleRestrictions,
        // The section's real shape — where the buildings stand, and whether
        // anything actually fits beside them.
        layout: siteLayout,
      }),
    [report.listing.landAreaSqm, report.listing.floorAreaSqm, report.listing.zoning, report.suburbValue, titleRestrictions, siteLayout]
  );

  const scored: ScoreResult = useMemo(
    () =>
      scoreFor(
        { subItems: effectiveSubItems, extraDwellings: report.extraDwellings, context: report.context, penalties: report.penalties, developmentTier: development.restrictedByTitle ? "none" : development.tier },
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
  // What the roof is measured from — the same inputs its card uses, handed to
  // the headline too so the roof card and the building value are one figure.
  const roofShot = itemPhotos["ext_roof"];
  const roofInputs = useMemo(
    () => ({
      footprintM2: siteLayout?.mainBuildingAreaSqm ?? null,
      pitchDegrees: roofShot?.roofPitchDegrees ?? null,
      roofForm: roofShot?.roofForm ?? null,
      material: roofShot?.material ?? null,
    }),
    [siteLayout, roofShot]
  );

  const improvementValuation = useMemo(
    () =>
      valueImprovementItems({
        subItems: effectiveSubItems,
        floorAreaSqm: report.listing.floorAreaSqm,
        bathrooms: report.listing.bathrooms,
        bedrooms: report.listing.bedrooms,
        buildYear: report.listing.buildYear,
        labourMultiplier: labourMultiplierFor(report.listing),
        roof: roofInputs,
      }),
    [
      roofInputs,
      effectiveSubItems,
      report.listing.floorAreaSqm,
      report.listing.bathrooms,
      report.listing.bedrooms,
      report.listing.buildYear,
    ]
  );

  // THE valuation — the same lib/scoring/property-value.ts call the map pin
  // makes. Computed once here and handed down, because the Finance tab used to
  // rebuild it out of valueLand + roiqValuation and that is precisely how the
  // report and the map came to disagree about 230 Sewell Street. Effective
  // sub-items, not raw: a valuation must not claim a condition the report has
  // withdrawn.
  /**
   * The itemised valuation, item by item. The roof is the first one done this
   * way — see lib/scoring/roof-value.ts — and the rest follow its pattern.
   *
   * Everything it needs is already on the report except the footprint, which
   * comes from the LINZ building outline via the site geometry. The MAIN
   * building's footprint, not every structure's: `builtAreaSqm` would hand the
   * house a detached garage's roof as well.
   */
  const itemValuations = useMemo(() => {
    const out = new Map<string, AnyValuation>();
    const roof = (report.subItems ?? []).find((s) => s.id === "ext_roof");
    if (!roof) return out;

    const shot = itemPhotos["ext_roof"];
    const concerns = [roof.observedDefect, shot?.observedDefect].filter(Boolean) as string[];

    out.set(
      "ext_roof",
      valueRoof({
        material: roofMaterialFromText(shot?.material ?? roof.material),
        footprintM2: siteLayout?.mainBuildingAreaSqm ?? null,
        // Only ever from a photograph that actually showed the slope. A null
        // falls back to the form's typical pitch and the card says it did.
        pitchDegrees: shot?.roofPitchDegrees ?? null,
        roofForm: shot?.roofForm ?? null,
        // Scaffold is priced on the face it wraps, and a listing rarely states
        // the storey count. One is the conservative read: guessing two on a
        // single-storey house adds thousands of scaffold to the replacement
        // cost, which flows straight into the value.
        storeys: 1,
        buildYear: report.listing.buildYear,
        conditionScore: shot?.showsItem ? shot.score : roof.score,
        concerns,
        // The same action the headline takes off — read from the effective item.
        action: actionFor(effectiveSubItems.find((s) => s.id === "ext_roof") ?? roof),
        labourMultiplier: labourMultiplierFor(report.listing),
      })
    );
    // Everything else, on the same seven steps. The RCN comes from the
    // itemised valuation that already sized and spec-adjusted it for this
    // property — re-pricing it here would be a second cost model disagreeing
    // with the first, which is the mistake this codebase keeps having to undo.
    for (const v of improvementValuation.items) {
      if (v.id === "ext_roof") continue;
      const item = (report.subItems ?? []).find((s) => s.id === v.id);
      const shot = itemPhotos[v.id];
      // Several bathrooms or bedrooms, each valued on its own read — the same parts the
      // headline summed, so the card and the headline are one figure.
      if (v.byRoom?.length) {
        const eff = effectiveSubItems.find((s) => s.id === v.id);
        const worst = v.byRoom.reduce((a, p) => (p.condition < a.condition ? p : a));
        const parts = v.byRoom.flatMap((p) => {
          const r = valueItem({
            id: v.id,
            rcnNew: p.rcnNew,
            sizeWorkings:
              v.id === "bath_shower" || v.id === "bath_flooring"
                ? [...wetAreaWorkings(v.id, IMPROVEMENT_BASE_COSTS[v.id].baseRCN, p, "for this bathroom"), `At its own spec: $${Math.round(p.rcnNew).toLocaleString("en-NZ")}.`]
                : [`$${Math.round(p.rcnNew).toLocaleString("en-NZ")} for this room's ${v.label.toLowerCase()}, at its own spec — one room's share of the item.`],
            sizeSummary: `$${Math.round(p.rcnNew).toLocaleString("en-NZ")} to replace in the ${p.room.toLowerCase()}`,
            // Its own fitting, never the item's — that describes another bathroom.
            material: p.material,
            concerns: p.observedDefect ? [p.observedDefect] : [],
            conditionScore: p.condition,
            action: p === worst && eff?.urgentAction ? actionFor(eff) : actionFor({ observedDefect: p.observedDefect, score: p.condition }),
            buildYear: report.listing.buildYear,
            label: v.label,
            labourMultiplier: labourMultiplierFor(report.listing),
          });
          return isItemWithheld(r) ? [] : [{ room: p.room, condition: p.condition, photoReferences: p.photoReferences, fromBuyer: p.fromBuyer, valuation: r }];
        });
        const worstPart = parts.reduce((a, p) => (p.condition < a.condition ? p : a), parts[0]);
        if (worstPart) {
          const actionCostSum = parts.reduce((a, p) => a + (p.valuation.action?.costNZD ?? 0), 0);
          const firstAction = (worstPart.valuation.action ?? parts.find((p) => p.valuation.action)?.valuation.action) ?? null;
          out.set(v.id, {
            kind: "per-room",
            noun: roomKindOf(v.id) ?? "bathroom",
            parts,
            unseen: v.unseenRooms ?? [],
            valueNZD: parts.reduce((a, p) => a + p.valuation.valueNZD, 0),
            cost: { totalNZD: parts.reduce((a, p) => a + p.valuation.cost.totalNZD, 0) },
            life: worstPart.valuation.life,
            action: firstAction ? { ...firstAction, costNZD: actionCostSum } : null,
          });
          continue;
        }
      }
      const concerns = [item?.observedDefect, shot?.observedDefect].filter(Boolean) as string[];
      out.set(
        v.id,
        valueItem({
          id: v.id,
          rcnNew: v.rcnNew,
          sizeWorkings: sizeWorkingsFor(v.id, report.listing.floorAreaSqm, report.listing.bathrooms, report.listing.bedrooms, v.rcnNew, effectiveSubItems.find((s) => s.id === v.id)),
          sizeSummary: `$${Math.round(v.rcnNew).toLocaleString("en-NZ")} to replace on this property`,
          material: shot?.material ?? item?.material,
          concerns,
          // The condition the headline valued it at — effective sub-items
          // already carry the buyer's own photograph — so card and headline
          // are the same sum, not two that happen to be close.
          conditionScore: v.condition,
          action: actionFor(effectiveSubItems.find((s) => s.id === v.id) ?? {}),
          buildYear: report.listing.buildYear,
          label: v.label,
          labourMultiplier: labourMultiplierFor(report.listing),
        })
      );
    }
    return out;
  }, [report.subItems, report.listing.buildYear, report.listing.city, report.listing.region, report.listing.floorAreaSqm, report.listing.bathrooms, siteLayout, itemPhotos, improvementValuation, effectiveSubItems]);

  const propertyValue = useMemo(
    () =>
      valueProperty({
        subItems: effectiveSubItems,
        floorAreaSqm: report.listing.floorAreaSqm,
        labourMultiplier: labourMultiplierFor(report.listing),
        roof: roofInputs,
        nearbyTypical: siteLayout?.measured?.nearby ?? null,
        bathrooms: report.listing.bathrooms,
        bedrooms: report.listing.bedrooms,
        landAreaSqm: report.listing.landAreaSqm,
        buildYear: report.listing.buildYear,
        extraDwellings: report.extraDwellings,
        suburbValue: report.suburbValue,
        titleType: report.listing.titleType,
        propertyType: report.listing.propertyType,
        landShareFraction: report.listing.landShareFraction,
        landCoOwners: report.listing.landCoOwners,
        crossLeaseSharing: report.context?.crossLeaseSharing,
      }),
    [effectiveSubItems, report.listing, report.extraDwellings, report.suburbValue, report.context, roofInputs]
  );

  const checklist = useMemo(
    () => buildViewingChecklist(report, effectiveSubItems, verifiedDocs),
    [report, effectiveSubItems, verifiedDocs]
  );
  const viewingStatus = useMemo(() => checklistStatus(checklist, viewing), [checklist, viewing]);

  /**
   * The viewing gate, except on the shop window.
   *
   * A demo report and the embedded landing demo describe fictional properties
   * nobody can go and view, so the checklist there is a demonstration rather
   * than an errand. Same rule as the paywall — never lock a sample id or the
   * landing demo (see CLAUDE.md).
   *
   * A SHARED report shows the checklist read-only on purpose: the viewing is
   * owner-scoped, so the recipient's browser holds none of it and every line
   * would read as unanswered.
   */
  // The inspection report, when one has been uploaded. It no longer gates
  // anything — it is read beside the photo analysis, and where the inspector
  // disagrees they were there and the camera wasn't.
  const inspection: InspectionEvidence | null = useMemo(() => {
    const doc = verifiedDocs?.["insp_report"];
    if (!doc) return null;
    return {
      present: true,
      confirmed: doc.docTypeConfirmed,
      inspector: doc.inspector ?? null,
      inspectedOn: doc.inspectedOn ?? null,
    };
  }, [verifiedDocs]);

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

  // Structures the reader chose to add on the Land tab. They are a plan for the
  // future rather than a defect found in the present, so they live beside the
  // remediation lines rather than inside them — and they are included by
  // default, because somebody who has just placed a garage on their section has
  // said what they want more clearly than a checkbox would.
  const [addedStructures, setAddedStructures] = useState<PlacedStructure[]>([]);
  const renoLines = useMemo(() => {
    const found = buildRenoLines(report.subItems, report.listing, persona, report.extraDwellings, report.context?.healthyHomes);
    const chosen: RenoLine[] = addedStructures.map((st) => ({
      key: `add_${st.id}`,
      name: st.label,
      detail: `New build on the section · about ${fmt(st.resale)} of it comes back at resale`,
      badge: "You added",
      low: Math.round(st.cost * 0.82),
      high: Math.round(st.cost * 1.18),
      urgencyYears: 0,
      detailColor: "var(--brand)",
      // `uplift` is WEEKLY RENT — it renders as "+$X/wk rent" in investor mode —
      // and the resale figure is capital. Putting one in the other's field had a
      // $160,000 granny flat advertising "+$144000/wk rent". A new structure
      // would genuinely let for something, but we have no rent evidence for a
      // building that doesn't exist yet, and inventing one is the habit this
      // codebase keeps having to break.
      uplift: 0,
      // `valueGap` IS the capital field — "value reclaimed if brought to modern
      // & as-new". For something being built rather than restored, that is what
      // it is worth once it stands.
      valueGap: st.resale,
      notes: "Indicative build range, not a quote. Placed within the setbacks on the Land tab — the district plan's own rules still apply.",
      // Ticked on arrival: placing a garage on your own section is a clearer
      // statement of intent than any checkbox, and an added structure that
      // silently contributed nothing would just look broken.
      autoInclude: true,
    }));
    return [...chosen, ...found];
  }, [report.subItems, report.listing, persona, report.extraDwellings, report.context, addedStructures]);
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
      // Ticked = in the plan AT PURCHASE: needed straight away, or ticked by
      // the reader. Work that only falls due later in the hold isn't ticked;
      // `dueInHold` says so, and the plan still counts it.
      included: (id) => {
        const l = byId.get(id);
        return l ? inAtPurchase(l, renoToggles) : false;
      },
      autoTicked: (id) => {
        const l = byId.get(id);
        return !!l && renoToggles[id]?.included === undefined && l.autoInclude;
      },
      // Built above HoldPeriodProvider, so the caller passes the hold in.
      dueInHold: (id, withinHold) => {
        const l = byId.get(id);
        return l && inDuringHold(l, renoToggles, withinHold) ? l.urgencyYears : null;
      },
      toggle: (id, on) => setRenoToggle(id, { included: on }),
    };
  }, [renoLines, renoToggles]);

  // Bare land. There is no building, so the Improvements inspection was never
  // run and the tab has nothing to show — and the headline number is a LAND
  // valuation, not a building one.
  const landOnly = report.landOnly === true;

  const tabs = TAB_DEFS
    .filter((t) => !t.investorOnly || persona === "investor")
    .filter((t) => !(landOnly && LAND_HIDDEN_TABS.has(t.id)));

  const { listing, subItems, gaps, photosAnalysed, model } = report;

  const bannerGaps: ReportGap[] = gaps.map((g, i) => ({
    id: `gap_${i}`,
    gapType: /photo/i.test(g.gapType) ? "missing_photo" : "missing_data",
    area: g.area,
    label: g.area,
    description: g.description,
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
                  {/* The raw model id — "claude-sonnet-5" — used to print here, in
                      front of every reader. It names our supplier rather than
                      telling the buyer anything about their property, and it is
                      the one place the vendor's name reached customer-facing copy
                      at all. The engine version is the part that means something:
                      two reports on the same house can differ because the engine
                      moved, and that is worth being able to see. */}
                  <span className="mono" title={model}>{engineLabel(model)}</span>
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
                  {tabLocked(t.id) && (
                    <Lock size={11} style={{ color: "var(--text-muted)" }} aria-label="needs a paid plan" />
                  )}
                  {t.id === "viewing" && viewingStatus.outstanding > 0 && (
                    <span className="rounded-full px-1.5 text-[10px] font-bold"
                      style={{ background: "var(--accent-wash)", color: "var(--brand)" }}
                      aria-label={`${viewingStatus.outstanding} still to check`}>
                      {viewingStatus.outstanding}
                    </span>
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
              <Link href="/pricing" className="btn-primary text-sm px-5 py-2.5 whitespace-nowrap self-start sm:self-auto">
                See plans <ArrowRight size={15} />
              </Link>
            </div>
          )}

          {noPhotos && !continuedWithoutPhotos && (
            <div className="card p-5 mb-6" style={{ border: "1px solid var(--brand)", background: "var(--accent-wash)" }}>
              <div className="flex items-center gap-2 font-semibold text-base mb-1" style={{ color: "var(--text-primary)" }}>📷 No listing photos found</div>
              <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                We couldn&apos;t retrieve photos from this listing. TradeMe and some other portals block photo access. Without photos we can&apos;t give condition scores — only build-year risk flags. To get a full {PRODUCT_NAME} you have two options:
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
          {tab === "overview" && <OverviewReal locked={locked} report={report} subItems={effectiveSubItems} scored={scored} persona={persona} renoLines={renoLines} renoToggles={renoToggles} askingPrice={askingPrice} improvementValuation={improvementValuation} propertyValue={propertyValue} dwellingValue={dwellingValue} />}
          {tab === "improvements" && (
            <div className="space-y-4">
              <PropertyTab shell={improvementValuation.shell} itemValues={new Map(improvementValuation.items.map((v) => [v.id, v]))} itemValuations={itemValuations} estimates={new Map(improvementValuation.estimatedItems.map((e) => [e.id, e]))} data={{ categories: improvementsCategories(effectiveSubItems), extraDwellings: report.extraDwellings, overallScore: 0 }} region={[listing.city, listing.region].filter(Boolean).join(", ") || undefined} floorSqm={listing.floorAreaSqm} noPhotos={noPhotos} buildYear={listing.buildYear} persona={persona} renoControls={renoControls} onOpenRenovations={() => setTab("renovations")} dwellingValues={dwellingValue.dwellings} />
              {persona === "investor" && <HealthyHomesSection subItems={effectiveSubItems} buildYear={listing.buildYear} renoControls={renoControls} onOpenRenovations={() => setTab("renovations")} hhAssessed={report.context?.healthyHomes} renoLines={renoLines} renoToggles={renoToggles} />}
            </div>
          )}
          {tab === "address" && (
            <div className="space-y-4">
              {propertyValue?.siteAdjustment && (
                <LandValueWorkings
                  land={propertyValue.siteAdjustment}
                  landAreaSqm={propertyValue.landAreaValuedSqm ?? listing.landAreaSqm}
                  shareNote={propertyValue.landAreaValuedSqm ? "This is the flat's share of a cross-lease site." : undefined}
                  sources={Object.fromEntries(
                    effectiveSubItems
                      .filter((s) => s.id.startsWith("land_"))
                      .map((s) => [s.id, s.evidenceSource || s.source || undefined])
                  )}
                />
              )}
              {/* Land only now — the title and legal findings have their own tab.
                  With the land valued, the land items are the Land value card's
                  lines, so nothing is listed and only add-a-structure remains. */}
              <PropertyInspections mode="address" sections={propertyValue?.siteAdjustment ? [] : ["land"]} landValued={!!propertyValue?.siteAdjustment} scored={scored} subItems={effectiveSubItems} onSeeRenovations={() => setTab("renovations")} verifiedDocs={verifiedDocs} onVerified={onVerified} development={development} persona={persona} landAreaSqm={listing.landAreaSqm}
                onAddStructure={(st) => setAddedStructures((prev) => (prev.some((p) => p.id === st.id) ? prev : [...prev, st]))}
                addedStructureIds={addedStructures.map((st) => st.id)} />
              <LocationFactCard subItems={subItems} ids={["loc_noise", "loc_views"]} title="Noise & outlook" />
            </div>
          )}
          {tabLocked(tab) && (
            <LockedTab {...LOCKED_TABS[tab]} />
          )}
          {tab === "legal" && (
            <TitleLegalTab
              subItems={effectiveSubItems}
              buildYear={listing.buildYear}
              region={listing.region}
              city={listing.city}
              statedBodyCorporate={report.context?.hasBodyCorporate}
              unconsentedSignal={unconsentedSignal({
                extraStructures: report.extraDwellings?.length ?? 0,
                floorAreaLarger:
                  compareFloorArea({
                    listingSqm: listing.floorAreaSqm,
                    rollSqm: listing.linz?.valuation?.floorAreaSqm ?? null,
                    rollEffectiveDate: listing.linz?.valuation?.effectiveDate ?? null,
                  }).status === "listing_larger",
              })}
              knownUnconsented={(report.extraDwellings ?? []).some((d) => d.consentStatus === "unconsented")}
              titleType={listing.titleType}
              encumbrances={report.listing.encumbrances ?? null}
              burdens={siteLayout?.plan.burdens.map((b) => ({ kind: b.kind, appellation: b.appellation })) ?? []}
              verifiedDocs={verifiedDocs}
              onVerified={onVerified}
              onSeeRenovations={() => setTab("renovations")}
              propertyValue={propertyValue}
              landAreaSqm={listing.landAreaSqm}
              locked={locked}
            />
          )}
          {tab === "renovations" && !tabLocked("renovations") && <RenovationsReal renoLines={renoLines} renoToggles={renoToggles} setRenoToggle={setRenoToggle} persona={persona} listing={listing} />}
          {tab === "financial" && !tabLocked("financial") && (
            <>
              <PurchasePriceBar value={askingPrice} priceText={listing.priceText} onChange={setAskingPrice} modelledPrice={propertyValue?.total ?? null} />
              <FinanceTab key={askingPrice ?? "none"} listing={{ ...listing, askingPrice }} persona={persona} marketRent={report.marketRent} capitalGrowth={report.capitalGrowth} renoLines={renoLines} renoToggles={renoToggles} score={scored.total} suburbValue={report.suburbValue} improvementValuation={improvementValuation} dwellingAdded={dwellingValue.addedValue} landOnly={landOnly} propertyValue={propertyValue} />
              <div className="mt-4"><LocationFactCard subItems={effectiveSubItems} ids={["loc_growth"]} title="Suburb growth & demand" /></div>
            </>
          )}
          {tab === "viewing" && (
            <ViewingChecklist
              items={checklist}
              state={viewing}
              onAnswer={(k, a) => updateViewing(setAnswer(viewing, k, a))}
              onNote={(k, n) => updateViewing(setNote(viewing, k, n))}
              onViewedOn={(iso) => updateViewing(setViewedOn(viewing, iso))}
              photoContext={{ buildYear: listing.buildYear, floorAreaSqm: listing.floorAreaSqm, propertyType: listing.propertyType }}
              gated={!(isSample || embedded)}
              inspection={inspection}
              inspectionDoc={verifiedDocs?.["insp_report"] ?? null}
              onItemPhoto={(id, a: ItemPhotoAnalysis) => updateViewing(setItemPhoto(viewing, id, a))}
              onClearItemPhoto={(id) => updateViewing(clearItemPhoto(viewing, id))}
              onRoomPhotos={(key, analyses) => updateViewing(setRoomPhotos(viewing, key, analyses))}
              onVerifiedDoc={onVerified}
              onOpenLand={() => setTab("legal")}
            />
          )}
        </div>

        <Disclaimer url={listing.url} />
      </div>
    </HoldPeriodProvider>
  );
}

/**
 * What the reader is told ran their analysis.
 *
 * A stored report keeps the real model id — it is how a result is traced back
 * and re-run, and rewriting stored data to hide a supplier would be dishonest
 * about our own records. This only changes what is DISPLAYED, and the full id is
 * still on the element's title attribute for anyone who needs it.
 */
function engineLabel(model: string): string {
  const demo = /demo/i.test(model);
  return `${PRODUCT_NAME} vision engine${demo ? " (demo)" : ""}`;
}

// ── Predicted future sale price (used on the Overview tab's value card) ───────
function FutureSalePrice({
  askingPrice, capitalGrowth, renoLines, renoToggles, align = "right", landOnly = false,
}: {
  askingPrice: number | null;
  capitalGrowth?: CapitalGrowth;
  renoLines: RenoLine[];
  renoToggles: Record<string, RenoToggle>;
  align?: "right" | "left";
  /** Bare section — the growth rate behind this describes houses, not land. */
  landOnly?: boolean;
}) {
  const { holdYears, withinHold } = useHoldPeriod();

  // No forward number on a section. The only growth rate we hold is a suburb
  // HOUSE trend, and land does not track it: in a rising market land usually
  // outpaces the house on it, and in a flat one a small-town section can sit
  // unmoved for years. Projecting one from the other would be a confident
  // figure with nothing behind it — the same reason a land VALUE is withheld
  // when the rate is stretched (lib/scoring/land-quality.ts).
  if (landOnly) {
    return (
      <div className={`mt-1.5 text-xs ${align === "right" ? "text-right" : ""}`} style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
        Not projected for bare land — the only growth trend available is for houses in this
        suburb, and a section doesn&rsquo;t follow it.
      </div>
    );
  }

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
function CapitalGrowthPanel({ capitalGrowth, askingPrice, landOnly = false }: { capitalGrowth?: CapitalGrowth; askingPrice: number | null; landOnly?: boolean }) {
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

      {/* On a section the trend is kept as CONTEXT and the projection is dropped.
          The figure is a real sourced fact about houses in this suburb — it was
          being applied to a 5,002m² paddock at $270,000 to produce a confident
          ten-year value, off an average house value of $511,200. The honest
          version states the trend, says whose it is, and stops there. */}
      {landOnly ? (
        <div className="my-4 rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
          <div className="text-sm" style={{ color: "var(--text-primary)", lineHeight: 1.65 }}>
            This {rate}% is the trend for <strong>houses</strong> in this suburb, and it is shown
            for context only — no forward value is projected for this section.
          </div>
          <div className="mt-1.5 text-xs" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
            Land and houses don&rsquo;t move together. Most of a house&rsquo;s growth is in its land,
            so a rising market can lift sections faster than the average dwelling — and a flat one
            can leave a small-town section unsold for years while house prices tick along. We hold no
            land-only series for this suburb, so there is no honest number to put here.
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 my-4">
          {projections.map((p) => (
            <div key={p.label} className="rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{p.label} · by {p.year}</div>
              <div className="text-xl font-bold mono" style={{ color: "var(--text-primary)" }}>Est. {fmtShort(p.value)}</div>
              <div className="text-xs font-semibold" style={{ color: "var(--good)" }}>+{p.pct.toFixed(0)}%</div>
            </div>
          ))}
        </div>
      )}
      <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>{capitalGrowth.why}</p>
      {capitalGrowth.recentNote && <p className="text-xs mt-2" style={{ color: "var(--warn)" }}>⚠ {capitalGrowth.recentNote}</p>}
      <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>Source: {capitalGrowth.source}</p>
    </div>
  );
}

// ── Investor Rating panel (investor only) — yield + growth, separate from the
//    1,000-pt quality score (panels approach). ─────────────────────────────────
function InvestorRatingPanel({
  askingPrice, marketRent, renoLines, renoToggles, growthScore, qualityBase, landOnly = false,
}: {
  askingPrice: number | null;
  marketRent?: MarketRent;
  renoLines: RenoLine[];
  renoToggles: Record<string, RenoToggle>;
  growthScore: number | null;
  qualityBase: number;
  /** Bare section — nothing to let, so no rent, no yield, no vacancy risk. */
  landOnly?: boolean;
}) {
  const { withinHold } = useHoldPeriod();
  const [override, setOverride] = useState<string>("");

  // Nothing here applies to an empty section. Gross yield, net yield and
  // vacancy risk all describe letting a dwelling, and the rent they rest on is
  // the suburb's HOUSE median — so on a paddock they are a confident answer to
  // a question nobody can ask yet.
  if (landOnly) {
    return (
      <div className="card p-5 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.65 }}>
        <strong style={{ color: "var(--text-primary)" }}>No rental return — there is no dwelling.</strong>{" "}
        Yield and vacancy describe letting a house, and this is bare land. What an investor is
        buying here is the section and what may be built on it, so the numbers that matter are the
        land value, the holding costs and the cost to build — not a rent.
      </div>
    );
  }

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
    <div className="card p-5" style={{ border: `1px solid ${alpha(rating.c, 20)}` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Percent size={16} style={{ color: rating.c }} />
          <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Investor rating</h3>
        </div>
        <span className="text-sm font-bold px-2.5 py-1 rounded-full" style={{ background: `${alpha(rating.c, 10)}`, color: rating.c }}>{rating.label} yield</span>
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

// ── What the property is worth ───────────────────────────────────────────────
//
// This replaced the score out of 1,000 on 24 September 2026. The score was a
// rubric — 1,000 points shared out across 48 items by weights somebody chose —
// and it asked every reader to learn what 600 meant before it told them
// anything. A dollar figure needs no key.
//
// It is NOT a simpler version of the score. It is a different claim, built the
// way a valuer builds one: land plus a building depreciated by what is left of
// its life. Everything under it is arithmetic a reader can disagree with line
// by line, which a weighted rubric never was.
function ValueSummary({
  value,
  improvements,
  scored,
  locked = false,
}: {
  value: PropertyValue | null;
  improvements: ImprovementValueResult | null;
  scored: ScoreResult;
  locked?: boolean;
}) {
  // The old penalties and bonuses were score adjustments. With no score to
  // adjust they are reported as what they always were underneath: objective
  // facts about the site. A highway at the end of the garden is real and worth
  // knowing; what it costs is a question only comparable sales can answer, and
  // inventing a dollar figure for it would be the invented-staircase habit in
  // a new place.
  const facts = [...scored.penalties, ...scored.bonuses];

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            What this property is worth
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            The land, plus the building valued component by component — each one&rsquo;s cost to
            replace today, less the share of its life already used. Every figure below is built
            from what the photographs actually showed; anything nobody could see is left out
            rather than guessed at.
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {value ? (
            <>
              <div className="text-3xl font-bold mono" style={{ color: "var(--text-primary)" }}>
                {locked ? (
                  <BlurredValue label="The valuation needs a paid plan">{fmt(value.total)}</BlurredValue>
                ) : (
                  fmt(value.total)
                )}
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {/* Blurred with the value: the middle of the range IS the value. */}
                {locked ? (
                  <BlurredValue amount={4} label="The valuation needs a paid plan">{`${fmt(value.low)} – ${fmt(value.high)}`}</BlurredValue>
                ) : (
                  <>{fmt(value.low)} – {fmt(value.high)}</>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>Not valued</div>
          )}
        </div>
      </div>

      {value && (
        <div className="mt-4 space-y-1.5 text-sm">
          <ValueLine label="Land" amount={value.landValue} locked={locked} />
          <ValueLine label="Building, depreciated" amount={value.mainBuildingValue} locked={locked} />
          {value.extraDwellingValue > 0 && (
            <ValueLine label="Extra dwelling" amount={value.extraDwellingValue} locked={locked} />
          )}
          {improvements && improvements.shellValue > 0 && (
            <div className="text-[11px] pl-1" style={{ color: "var(--text-muted)" }}>
              Of the building, {fmt(improvements.shellValue)} is the structure and services —
              framing, linings, wiring and plumbing — which nobody can photograph and which is
              depreciated on the building&rsquo;s age.
            </div>
          )}
          <div
            className="flex items-center justify-between pt-2 mt-1"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Total</span>
            <span className="mono font-bold" style={{ color: "var(--text-primary)" }}>
              {locked ? (
                <BlurredValue amount={6} label="The valuation needs a paid plan">{fmt(value.total)}</BlurredValue>
              ) : (
                fmt(value.total)
              )}
            </span>
          </div>
          {value.range && <RangeExplainer range={value.range} locked={locked} />}
        </div>
      )}

      {/* Coverage. A valuation built on two thirds of a house is still a
          valuation, but the reader is owed the fraction. */}
      {scored.unassessed.length > 0 && (
        <div className="mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
          {scored.unassessed.length}{" "}
          {scored.unassessed.length === 1 ? "thing" : "things"} couldn&rsquo;t be seen in the
          photographs, so {scored.unassessed.length === 1 ? "it was" : "they were"} left out rather
          than guessed at.
        </div>
      )}

      {facts.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
            Worth knowing about the site
          </div>
          <ul className="space-y-0.5">
            {facts.map((f, i) => (
              <li key={i} className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                {f.label}
              </li>
            ))}
          </ul>
          <div className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
            Stated as facts, not priced. What a flight path costs is a question only comparable
            sales can answer.
          </div>
        </div>
      )}

      {locked && (
        <div className="mt-4">
          <UpgradeNote what="The valuation and how it was built" />
        </div>
      )}
    </div>
  );
}

function ValueLine({ label, amount, locked }: { label: string; amount: number; locked: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="mono" style={{ color: "var(--text-primary)" }}>
        {locked ? <BlurredValue amount={5} label="Needs a paid plan">{fmt(amount)}</BlurredValue> : fmt(amount)}
      </span>
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
            Built up <strong style={{ color: "var(--text-secondary)" }}>item by item</strong> — each component&apos;s cost to replace at its spec, less the share of its life already used, plus the base structure &amp; services. The same figures as the cards on the Improvements tab.
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
/**
 * Step 5 for an item that isn't measured.
 *
 * The roof is measured off a surveyed footprint; these are scaled off a figure
 * the report already holds. The difference matters to a reader deciding how
 * much weight to put on the number, so it is stated rather than dressed up as
 * a measurement.
 */
/**
 * A shower's cost, by what it's built as. The membrane behind tiles is never
 * assessed — it can't be seen — but replacing a tiled shower means redoing
 * it, so it is in the price and the working says so.
 */
function wetAreaWorkings(id: string, base: number, read: { showerType?: ShowerType; floorType?: FloorType; material?: string | null }, times: string): string[] {
  if (id === "bath_flooring") return floorWorkings(base, floorTypeOf(read), times);
  return showerWorkings(base, showerTypeOf(read), times);
}

/** A bathroom floor's cost, by what it's laid in — same reasoning as the shower. */
function floorWorkings(base: number, floor: FloorType | null | undefined, times: string): string[] {
  const $ = (n: number) => `$${n.toLocaleString("en-NZ")}`;
  if (floor === "tiled") {
    return [
      `Tiled floor: ${$(base)} + ${$(FLOOR_MEMBRANE)} for the waterproof membrane under the tiles = ${$(base + FLOOR_MEMBRANE)} ${times}.`,
      "The membrane can't be seen, so it isn't assessed. A tiled bathroom floor is assumed to have one, and relaying the floor means redoing it.",
    ];
  }
  if (floor === "vinyl") {
    return [`Vinyl floor: ${$(base)} ${times}. Sheet vinyl is its own waterproof layer, so there's no membrane to price.`];
  }
  return [`${$(base)} ${times}. Whether it's tiled or vinyl isn't known, so it's priced without a membrane.`];
}

function showerWorkings(base: number, shower: ShowerType | null | undefined, times: string): string[] {
  const $ = (n: number) => `$${n.toLocaleString("en-NZ")}`;
  if (shower === "tiled") {
    return [
      `Tiled shower: ${$(base)} + ${$(SHOWER_MEMBRANE)} for the waterproof membrane behind the tiles = ${$(base + SHOWER_MEMBRANE)} ${times}.`,
      "The membrane can't be seen, so it isn't assessed. A tiled shower is assumed to have one, and replacing the shower means redoing it.",
    ];
  }
  if (shower === "liner") {
    return [`Lined shower: ${$(base)} ${times}. A moulded liner and tray is its own waterproof layer, so there's no membrane to price.`];
  }
  return [`${$(base)} ${times}. Whether it's tiled or a liner isn't known, so it's priced as a lined shower, without a membrane.`];
}

/**
 * Why the range is as wide as it is — one line, and the parts behind a toggle.
 * The width is built from this property's evidence (valuation-range.ts), so
 * the reader is told which part it is least sure of, and why.
 */
function RangeExplainer({ range, locked }: { range: ValuationRange; locked: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-1 text-[11px]" style={{ color: "var(--text-muted)", lineHeight: 1.55 }}>
      <div>
        Range {range.summary}{" "}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex items-center gap-0.5 cursor-pointer" style={{ color: "var(--brand)" }}>
          {open ? "Hide what sets it" : "What sets it"}
          {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-1.5">
          {range.parts.map((p) => (
            <div key={p.key}>
              <div className="flex items-baseline justify-between gap-2">
                <span style={{ color: "var(--text-secondary)" }}>{p.label}</span>
                <span className="mono whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                  ±{Math.round(p.pct * 100)}%{" "}
                  {locked ? null : <span style={{ color: "var(--text-muted)" }}>(±{fmt(p.plusMinusNZD)})</span>}
                </span>
              </div>
              <div>{p.reason.replace(/^./, (c) => c.toUpperCase())}.</div>
            </div>
          ))}
          <div className="pt-1.5" style={{ borderTop: "1px solid var(--border)" }}>
            Land and building come from different sources, so their errors partly offset; the building&rsquo;s parts share one
            set of trade prices, so theirs add up. The rates are assumptions, not yet measured: once enough of our valuations
            have been checked against real sale prices, the range will come from how far off we actually were.
          </div>
        </div>
      )}
    </div>
  );
}

function sizeWorkingsFor(
  id: string,
  floorAreaSqm: number | null,
  bathrooms: number | null | undefined,
  bedrooms: number | null | undefined,
  rcn: number,
  read?: { showerType?: ShowerType; floorType?: FloorType; material?: string | null }
): string[] {
  const spec = IMPROVEMENT_BASE_COSTS[id];
  if (!spec) return [`Replacement cost of about $${Math.round(rcn).toLocaleString("en-NZ")}.`];

  if (spec.scale === "floorM2" && floorAreaSqm) {
    return [
      `Scaled to the house: $${spec.baseRCN}/m² × ${floorAreaSqm} m² of floor area.`,
      "Scaled, not measured — the floor area stands in for the component's own size.",
    ];
  }
  if (spec.scale === "bathroom") {
    const n = Math.max(1, Math.round(bathrooms ?? 1));
    const per = `${n} ${n === 1 ? "bathroom" : "bathrooms"}`;
    if (id === "bath_shower" || id === "bath_flooring") return wetAreaWorkings(id, spec.baseRCN, read ?? {}, `× ${per}`);
    return [`$${spec.baseRCN.toLocaleString("en-NZ")} per bathroom × ${per}.`];
  }
  if (spec.scale === "bedroom") {
    const n = bedrooms && bedrooms > 0 ? Math.round(bedrooms) : DEFAULT_BEDROOMS;
    return [
      `$${spec.baseRCN.toLocaleString("en-NZ")} per bedroom × ${n} ${n === 1 ? "bedroom" : "bedrooms"}${bedrooms && bedrooms > 0 ? "" : " (the listing gives no count, so three are assumed)"}.`,
    ];
  }
  return [
    `$${spec.baseRCN.toLocaleString("en-NZ")} for a standard home — one of these per house, so it doesn't scale with floor area.`,
    ...(spec.note ? [spec.note] : []),
  ];
}

function OverviewReal({ locked, report, subItems, scored, persona, renoLines, renoToggles, askingPrice, improvementValuation, propertyValue, dwellingValue }: {
  locked: boolean;
  report: StoredReport; subItems: SubItem[]; scored: ScoreResult; persona: Persona;
  renoLines: RenoLine[]; renoToggles: Record<string, RenoToggle>; askingPrice: number | null;
  improvementValuation: ImprovementValueResult;
  propertyValue: PropertyValue | null;
  dwellingValue: ExtraDwellingValueResult;
}) {
  const subs = subItems;
  // No building: the score is land + title, and there is no improvement value.
  const landOnly = report.landOnly === true;
  const growthScore = subs.find((s) => s.id === "loc_growth")?.score ?? null;
  const tally = {
    critical: subs.filter((s) => s.score !== null && s.score <= 2).length,
    urgent: subs.filter((s) => s.score !== null && s.score >= 3 && s.score <= 4).length,
    monitor: subs.filter((s) => s.score !== null && s.score >= 5 && s.score <= 7).length,
    good: subs.filter((s) => s.score !== null && s.score >= 8).length,
    unscored: subs.filter((s) => s.score === null).length,
  };
  // "Act before making an offer" means work that comes with the house. Appliances
  // are CHATTELS: they are negotiated on the sale and agreement, they may not
  // even be included, and a tired oven is not a reason to reconsider an offer on
  // a property. Leading the overview with one makes the whole list look soft.
  const repairs = subs
    .filter((s) => isImprovement(s) && ITEM_BY_ID[s.id]?.costBearing && !CHATTELS.has(s.id) && s.score !== null && s.score <= 4)
    .sort((a, b) => (a.score ?? 9) - (b.score ?? 9));
  const risks = subs
    .filter((s) => !isImprovement(s) && s.score !== null && s.score <= 4)
    .sort((a, b) => (a.score ?? 9) - (b.score ?? 9));

  return (
    <div className="space-y-6">
      {/* What the property is worth, and what it is built from. On bare land
          there is no building to depreciate, so the land report keeps its own
          summary rather than showing a building line that would read as zero. */}
      {landOnly ? (
        <LandScoreBreakdown scored={scored} locked={locked} />
      ) : (
        <ValueSummary
          value={propertyValue}
          improvements={improvementValuation}
          scored={scored}
          locked={locked}
        />
      )}

      {/* What the register says — title type and, where published, the rating
          valuation. Above the estimates, because it is the only part of the
          report that isn't inferred. */}
      <PublicRecordCard listing={report.listing} />

      {/* Improvement (building) value — spec × condition (valuation slice 1).
          Withheld on a free report: it IS the valuation. There is no building
          to value on a section, so the land is valued on its own instead. */}
      {landOnly
        ? !locked && <LandValueCard report={report} />
        : improvementValuation && !locked && <ImprovementValueCard iv={improvementValuation} />}

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
              <FutureSalePrice askingPrice={askingPrice} capitalGrowth={report.capitalGrowth} renoLines={renoLines} renoToggles={renoToggles} align="left" landOnly={landOnly} />
              <div className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
                {landOnly
                  ? <>What a section is worth later depends on what can be built on it and what it costs to do — see the <strong style={{ color: "var(--brand)" }}>Land</strong> tab for the site facts that decide that.</>
                  : <>See the <strong style={{ color: "var(--brand)" }}>Financial</strong> tab for the {PRODUCT_SHORT_NAME} Value Verdict — whether the asking price is fair once renovations are factored in.</>}
              </div>
            </>
          )}
        </div>
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-secondary)" }}>{landOnly ? "Assessment by area" : "Condition by inspection area"}</h3>
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
          landOnly={landOnly}
        />
      )}

      {/* Capital growth — all users */}
      <CapitalGrowthPanel capitalGrowth={report.capitalGrowth} askingPrice={askingPrice} landOnly={landOnly} />

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
  /** A repair on an item past its life: listed as an option, never pre-ticked — the replacement is. */
  stopGap?: boolean;
  /** The kind of job, where the line knows it (a single repair or maintenance job). */
  work?: "repair" | "maintain";
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
  wholeRoom?: boolean; // a full strip-out and rebuild — never recommended as a patch
  optIn?: boolean; // only ever in the plan by the reader's tick, whatever the hold
  valueGap?: number; // renovation upside — value reclaimed if brought to modern & as-new
  observedDefect?: string; // what's visible in THIS property's photos — keeps the plan specific
  scopeHint?: string; // real scope for compliance/paperwork lines, which have no costing recipe
  legal?: boolean; // carries a Healthy Homes legal obligation (investor)
  nonExisting?: boolean; // the feature is deteriorated / effectively absent
  inferred?: boolean; // not established either way — shown unticked, never recommended
  /** How a single-price line's figure was reached, step by step — shown behind a toggle. */
  working?: string[];
}

// Unified renovation list: Improvement replacement costs + Location/Land/Legal
// remediation line items, both obeying the hold-period rule.
function buildRenoLines(subItems: SubItem[], listing: StoredReport["listing"], persona: Persona, extraDwellings: ExtraDwelling[] = [], hhAssessed?: { standard: string; status: "met" | "not_visible" | "absent"; note?: string }[]): RenoLine[] {
  const lines: RenoLine[] = [];
  // Which Healthy Homes standards we have established are NOT met. Only ever
  // consulted for the pre-tick — see the autoInclude below.
  const legallyRequired = new Set(
    assessHealthyHomes(subItems, listing.buildYear, hhAssessed)
      .filter((h) => h.compliant === false && h.renoKey)
      .map((h) => h.renoKey)
  );
  const ctx = {
    floorSqm: listing.floorAreaSqm ?? null,
    bedrooms: listing.bedrooms ?? null,
  };
  // Per-item building values → replacement-cost fallback + renovation upside (value gap).
  const valuation = valueImprovementItems({
    subItems,
    floorAreaSqm: listing.floorAreaSqm,
    bathrooms: listing.bathrooms,
    bedrooms: listing.bedrooms,
    buildYear: listing.buildYear,
    // Same labour and roof inputs as the cards, so an action costs the same
    // here as it does in the item's Action step.
    labourMultiplier: labourMultiplierFor(listing),
    roof: { footprintM2: listing.siteLayout?.mainBuildingAreaSqm ?? null },
  });
  const valueById = new Map(valuation.items.map((v) => [v.id, v]));

  for (const s of subItems) {
    // The work the item needs NOW. A full replacement ticks the item's own
    // replacement line below; anything smaller is its own line. Either way it
    // goes into the plan ticked, and the buyer unticks what they won't do.
    const urgent = isImprovement(s) ? actionFor(s) : null;
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
      const dueYears = v ? Math.max(0, Math.round(v.yearsLeft)) : urgencyScoreToYears(s.score);
      lines.push({
        key: s.id,
        name: s.name,
        // The condition word, then the life left on the same reading the plan
        // dates it by. "Fair — plan replacement within 5–7 years" was the
        // score's guess, and said it about a foundation with 67 years left.
        detail: v
          ? `${s.urgencyLabel.split(" — ")[0]} · ${
              v.yearsLeft <= 0 ? "past the end of its life" : `about ${Math.round(v.yearsLeft)} ${Math.round(v.yearsLeft) === 1 ? "year" : "years"} of life left`
            }`
          : s.urgencyLabel,
        low,
        high,
        // When it is due comes from the item's own life — the same years-left
        // its card shows — and only falls back to the condition score for an
        // item the valuation couldn't price.
        urgencyYears: dueYears,
        detailColor: col === "red" ? "var(--bad)" : col === "amber" ? "var(--warn)" : "var(--good)",
        uplift: rentUplift(s.id),
        notes: s.estimatedReplacementCost?.notes || undefined,
        category,
        photoRefs: s.photoReferences,
        costing: costThreeTier({ id: s.id, name: s.name, category, ...ctx, fallback: { low, high }, variant: s.id === "bath_shower" ? showerTypeOf(s) : s.id === "bath_flooring" ? floorTypeOf(s) : null }),
        // Pre-ticked only when it's needed the day you buy or before you can
        // rent it out: its action is a replacement now, it has a year or less
        // of life left, or it's a Healthy Homes standard ESTABLISHED to fail
        // (a legal obligation before tenanting, so the default is ticked).
        //
        // NOT on condition alone. It used to tick anything rated in the bottom
        // 30%, but a worn roof at 30% may last several more years — that's work
        // DURING the hold, counted in the plan by its year, not ticked.
        //
        // `=== false` on purpose in legallyRequired: unknown is not a failure.
        autoInclude: legallyRequired.has(s.id) || urgent?.scope === "replace" || (s.score !== null && dueYears <= UPFRONT_RENO_YEARS),
        valueGap: v?.valueGap,
        observedDefect: s.observedDefect,
        legal: HH_RENO_KEYS.has(s.id),
        nonExisting: s.specTier === "deteriorated",
      });
    }
    if (urgent && urgent.scope !== "replace") {
      const v = valueById.get(s.id);
      // A per-bathroom item carries its own figure: the work is in one
      // bathroom, and share × every bathroom's replacement would overcharge it.
      const cost = v?.actionCostNZD ?? actionCost(v?.replacementTotal ?? 0, urgent);
      if (cost > 0) {
        const category = ITEM_BY_ID[s.id]?.category;
        const low = Math.round(cost * 0.85);
        const high = Math.round(cost * 1.15);
        // How the figure was reached, in the order a reader would check it:
        // the job, what share of the item it is, of what, and the range.
        const pct = (x: number) => `${Math.round(x * 100)}%`;
        const shareWhy =
          urgent.basis === "recorded"
            ? `The analysis sized this job at ${pct(urgent.share)} of replacing the whole ${s.name.toLowerCase()}, from what the photos show.`
            : `Sized from the condition: at ${s.score}/10 the job is ${pct(urgent.share)} of replacing the whole ${s.name.toLowerCase()}.`;
        const roomsWithWork = (v?.byRoom ?? []).filter((p) => p.actionCostNZD > 0);
        const working = [
          `The job: ${urgent.work.replace(/[.]+$/, "")}.`,
          shareWhy,
          ...(roomsWithWork.length > 0
            ? roomsWithWork.map((p) => `In the ${p.room.toLowerCase()}: ${pct(urgent.share)} × ${fmt(p.replacementTotal)} to replace it there = ${fmt(p.actionCostNZD)}. The other rooms need nothing now.`)
            : [`${pct(urgent.share)} × ${fmt(v?.replacementTotal ?? 0)} to replace the whole ${s.name.toLowerCase()} = ${fmt(cost)}.`]),
          `The replacement figure is the item's own cost to replace on this property — materials, labour at this region's rate, disposal and scaffold where the job needs it — the same one on its Improvements card.`,
          `Shown as ${fmt(low)}–${fmt(high)}, 15% either side, because a quote for a small job moves with the tradesperson. The plan counts the middle, ${fmt(cost)}, which is also what comes off the item's value.`,
        ];
        lines.push({
          key: `${s.id}_act`,
          working,
          name: urgent.work,
          detail: `${urgent.scope === "maintenance" ? "Maintenance" : "Repair"} · ${s.name}`,
          work: urgent.scope === "maintenance" ? "maintain" : "repair",
          badge: v?.pastLife ? "Stop-gap" : "Needs doing now",
          low,
          high,
          urgencyYears: 0,
          detailColor: "var(--bad)",
          uplift: 0,
          notes: undefined,
          category,
          photoRefs: s.photoReferences,
          observedDefect: s.observedDefect,
          scopeHint: urgent.work,
          // No three-tier costing: this is ONE known job at one price — the
          // same figure the card's Action step shows and the value loses. Run
          // through the tier engine it came back as a $9,753 re-clad for a
          // $944 board repair.
          // Past its life, the replacement is ticked instead; paying for both
          // would put the same roof in the plan twice.
          autoInclude: !v?.pastLife,
          stopGap: !!v?.pastLife,
        });
      }
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
      name: d.consentStatus === "unconsented" ? `${d.type} — consent & compliance` : `${d.type} — compliance`,
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
      optIn: true,
      // Paperwork, not a visible defect: the WHY is the missing paperwork, the
      // WORK is the scope — the generic costing text would say "full replacement".
      observedDefect: d.consentStatus === "unconsented"
        ? `This structure is recorded as unconsented, so it can't be legally rented as it stands.`
        : `It doesn't meet every standard a rented dwelling must, so it can't be legally rented as it stands.`,
      scopeHint: work.scope.join(", "),
      legal: true,
      nonExisting: true,
    });
  }

  // Healthy Homes draught-stopping — investor only, no equivalent quality item.
  //
  // It is derived from the BUILD ERA and nothing else: no photograph shows a
  // draught, and nobody has stood in the house. So it must not be stated as a
  // finding and must not tick itself into the plan. It was saying "Below the
  // draught-stopping standard — gaps/holes to seal" and pre-selecting $1,600 of
  // work on a house whose own listing advertises new double glazing, Insulmax
  // wall insulation and a heat pump. The honest version says what we know (the
  // era), what we don't (whether it actually leaks), and leaves the tick to the
  // buyer once they've been.
  // ── The whole room, as one job ────────────────────────────────────────────
  //
  // Every kitchen and bathroom line prices ONE component — cabinetry, or the
  // shower, or the benchtop. Nobody renovating a 1975 bathroom replaces the
  // vanity and leaves the waterproofing, and adding six lines up does not give
  // the number a builder would quote: a full refit strips back to the framing,
  // reworks the plumbing and re-waterproofs, and shares one lot of labour and
  // one lot of making good across the whole room.
  //
  // Offered rather than pre-ticked, and it never auto-includes: choosing to gut
  // a room is the reader's call, not a conclusion from a condition score.
  for (const [cat, label, id] of [
    ["Kitchen", "Whole kitchen — full refit", "room_kitchen"],
    ["Bathroom", "Whole bathroom — full refit", "room_bathroom"],
  ] as const) {
    const roomItems = subItems.filter((s) => ITEM_BY_ID[s.id]?.category === cat && s.score !== null);
    if (roomItems.length < 2) continue;
    const worst = Math.min(...roomItems.map((s) => s.score as number));
    const costing = costThreeTier({ id, name: label, category: cat, ...ctx });
    lines.push({
      key: id,
      name: label,
      detail: `Strip out and rebuild — replaces every ${cat.toLowerCase()} line below in one job`,
      badge: "Whole room",
      low: Math.round(costing.budget.tradieTotal * 0.85),
      high: Math.round(costing.premium.tradieTotal),
      urgencyYears: worst <= 3 ? 2 : 5,
      detailColor: "var(--brand)",
      uplift: 0,
      notes: "A full refit rather than the sum of the individual items — one lot of labour, one lot of making good. Tick this OR the separate lines, not both.",
      category: cat,
      costing,
      autoInclude: false,
      wholeRoom: true,
    });
  }

  if (persona === "investor") {
    // A standard established to fail whose item the analysis never returned
    // (say, insulation read from a 1960 build year) would have no line, so the
    // must-do could be neither ticked nor costed. Give it one, pre-ticked.
    for (const h of assessHealthyHomes(subItems, listing.buildYear, hhAssessed)) {
      if (h.compliant !== false || h.key === "hh_draught" || lines.some((l) => l.key === h.renoKey)) continue;
      lines.push({
        key: h.renoKey,
        name: `${h.label} (Healthy Homes)`,
        detail: "Doesn't meet the standard — required before you tenant",
        low: h.remediation.low,
        high: h.remediation.high,
        urgencyYears: 0,
        detailColor: "var(--bad)",
        uplift: 0,
        notes: h.fix,
        costing: costThreeTier({ id: h.renoKey, name: h.label, ...ctx, fallback: { low: h.remediation.low, high: h.remediation.high } }),
        autoInclude: true,
        legal: true,
        nonExisting: true,
      });
    }

    const draught = assessHealthyHomes(subItems, listing.buildYear, hhAssessed).find((h) => h.key === "hh_draught");
    if (draught) {
      const era = listing.buildYear ? `A ${listing.buildYear} house ` : "A house of this era ";
      // Established to fail = a legal must-do, pre-ticked like the other four
      // standards (insulation is read from the build year too and always was).
      // Not established = shown unticked, for the reader to add after checking.
      const mustDo = draught.compliant === false;
      lines.push({
        key: "hh_draught",
        name: "Draught stopping (Healthy Homes)",
        detail: mustDo
          ? `${era}predates draught-stopping requirements — required before you tenant`
          : "Built to an era that meets the standard — confirm at inspection",
        low: draught.remediation.low,
        high: draught.remediation.high,
        urgencyYears: 0,
        detailColor: mustDo ? "var(--bad)" : "var(--text-muted)",
        uplift: 0,
        notes:
          "Read from the build era, not from anything seen. Draughts are found by standing in the house: gaps at skirtings and architraves, doors and windows that don't seal, and an unused open fireplace left open to the sky. Untick this if the house has already been draught-stopped.",
        costing: costThreeTier({ id: "hh_draught", name: "Draught stopping", ...ctx, fallback: { low: draught.remediation.low, high: draught.remediation.high } }),
        autoInclude: mustDo,
        inferred: !mustDo,
        legal: true,
        nonExisting: mustDo,
      });
    }
  }
  return lines;
}

// Itemised material + labour breakdown for one tier (the "See breakdown" view).
function TierBreakdown({ tier, labour }: { tier: TierCost; labour: LabourMode }) {
  const total = labour === "tradie" ? tier.tradieTotal : tier.diyTotal;
/**
 * "14 packs", "8 sheets", "113 m²" — the quantity with the unit it is counted in.
 *
 * The unit was in the data and never rendered, so an insulation line read
 * "Bradford Gold R6.6 190mm ceiling 8.5m² · 14 × $185": the 8.5m² is what one
 * PACK covers, and the reader has no way to tell that from the area of their
 * own ceiling. A bare number times a price is not a working.
 */
function unitLabel(unit: string | undefined, qty: number): string {
  if (!unit) return "";
  const u = unit.replace(/^per\s+/i, "").trim();
  if (!u || u === "each" || u === "unit") return "";
  if (/^m2|^m²|sqm/i.test(u)) return "m²";
  if (/^lm$|linear/i.test(u)) return "lm";
  return ` ${u}${qty === 1 || /s$/.test(u) ? "" : "s"}`;
}

  return (
    <div className="mt-2 rounded-md p-2.5 space-y-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Materials</div>
      <ul className="space-y-0.5">
        {tier.materials.map((m, i) => (
          <li key={i} className="text-[11px] flex items-start justify-between gap-2">
            <span className="min-w-0" style={{ color: "var(--text-secondary)" }}>
              {m.description}<span style={{ color: "var(--text-muted)" }}> · {m.source}</span>
            </span>
            {/* The UNIT has to show. "Bradford Gold R6.6 190mm ceiling 8.5m² —
                14 × $185" reads as though the job is 8.5m², when 8.5m² is what
                one PACK covers and fourteen of them are being bought for a
                113m² ceiling. The quantity meant nothing without its unit. */}
            <span className="mono whitespace-nowrap flex-shrink-0" style={{ color: "var(--text-muted)" }}>
              {m.qty}{unitLabel(m.unit, m.qty)} × {fmt(m.unitPrice)} = {fmt(m.lineCost)}
            </span>
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

function RenovationsReal({ renoLines, renoToggles, setRenoToggle, persona, listing }: {
  renoLines: RenoLine[];
  renoToggles: Record<string, RenoToggle>;
  setRenoToggle: (key: string, patch: Partial<RenoToggle>) => void;
  persona: Persona;
  listing: StoredReport["listing"];
}) {
  const { withinHold, holdYears } = useHoldPeriod();
  // Every card starts folded to one line — what it is, whether it's in, and
  // what it costs at the option chosen. The options open on request.
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  // In scope for this page: anything due inside the hold, plus anything
  // ticked for purchase even if its life runs past the hold — you've said
  // you'll do it, so it's counted and it has to be visible to untick.
  const items = renoLines.filter((l) => withinHold(l.urgencyYears) || inAtPurchase(l, renoToggles));
  const deferred = renoLines.length - items.length;
  const total = selectedRenoCost(renoLines, renoToggles, withinHold);
  // Plus any `inferred` line, shown UNTICKED. Draught stopping, when the build
  // year doesn't establish that it fails, has no Improvements card to tick it
  // from, so it's listed here to be added after checking. Shown and unticked,
  // it costs nothing.
  const selected = items.filter((l) => inAtPurchase(l, renoToggles) || inDuringHold(l, renoToggles, withinHold) || l.inferred);

  // ── The plan's two halves ────────────────────────────────────────────────
  // At purchase: what's ticked — needed the day you buy or before you rent it
  // out, or ticked by the reader. During the hold: not ticked, but it reaches
  // end of life while you own the place, so it's counted in its year. The same
  // split feeds the Financial tab's money-to-buy and later spending.
  const atPurchase = selected.filter((l) => !l.inferred && inAtPurchase(l, renoToggles));
  const recommended = selected.filter((l) => !l.inferred && inDuringHold(l, renoToggles, withinHold));
  const duringHoldTotal = recommended.reduce((t, l) => t + lineCost(l, renoToggles[l.key]), 0);
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

  // ── The recommendation as a timeline ────────────────────────────────────
  // When each job falls and what kind of job it is, so the list reads as a
  // plan: "Now — Repair — refix the soffit — $1,124", then Year 2, and so on.
  const yearOf = (l: RenoLine) => Math.max(0, l.urgencyYears);
  const WORK: Record<string, { label: string; color: string }> = {
    repair: { label: "Repair", color: "var(--warn)" },
    maintain: { label: "Maintain", color: "var(--text-secondary)" },
    replace: { label: "Replace", color: "var(--brand)" },
    refit: { label: "Full refit", color: "var(--brand)" },
    install: { label: "Install", color: "var(--bad)" },
    comply: { label: "Compliance", color: "var(--bad)" },
    fix: { label: "Fix", color: "var(--warn)" },
  };
  const workOf = (l: RenoLine) => {
    if (l.work) return WORK[l.work];
    if (l.wholeRoom) return WORK.refit;
    if (l.key.endsWith("_compliance")) return WORK.comply;
    if (l.key.endsWith("_rem")) return WORK.fix;
    // A Healthy Homes standard that isn't there is put in, not replaced.
    if (l.legal && l.nonExisting) return WORK.install;
    // Otherwise the item's own line, at the option chosen: Patch Up is a repair.
    return (renoToggles[l.key]?.tier ?? "budget") === "patch" ? WORK.repair : WORK.replace;
  };
  // "Budget" / "High end" — the option, now that the job is its own column.
  const optionOf = (l: RenoLine) => {
    if (!l.costing) return "";
    const r = rowFor(l);
    const tier = renoToggles[l.key]?.tier ?? "budget";
    const q = tier === "premium" ? "High end" : tier === "budget" ? "Budget" : "";
    return [q, r.labour === "diy" ? "DIY" : "", r.pct < 1 ? `${Math.round(r.pct * 100)}%` : ""].filter(Boolean).join(" · ");
  };
  const timeline = (rows: RenoLine[]) => {
    const byYear = new Map<number, RenoLine[]>();
    for (const l of rows) byYear.set(yearOf(l), [...(byYear.get(yearOf(l)) ?? []), l]);
    const years = [...byYear.keys()].sort((a, b) => a - b);
    return (
      <div className="mt-3 space-y-4">
        {years.map((y) => {
          const ls = byYear.get(y)!.sort((a, b) => rowFor(b).cost - rowFor(a).cost);
          return (
            <div key={y}>
              <div className="flex items-baseline justify-between gap-2 pb-1 mb-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-xs font-semibold" style={{ color: y === 0 ? "var(--bad)" : "var(--text-primary)" }}>
                  {y === 0 ? "Now" : `Year ${y}`}
                  <span className="font-normal ml-1.5" style={{ color: "var(--text-muted)" }}>
                    {ls.length} job{ls.length > 1 ? "s" : ""}
                  </span>
                </span>
                <span className="text-xs mono font-semibold" style={{ color: "var(--text-primary)" }}>
                  {fmt(ls.reduce((t, l) => t + rowFor(l).cost, 0))}
                </span>
              </div>
              <div className="space-y-1.5">
                {ls.map((l) => {
                  const w = workOf(l);
                  const opt = optionOf(l);
                  return (
                    <div key={l.key} className="grid items-baseline gap-x-3 text-xs" style={{ gridTemplateColumns: "5.5rem minmax(0,1fr) auto" }}>
                      <span className="font-medium" style={{ color: w.color }}>{w.label}</span>
                      <span className="min-w-0" style={{ color: "var(--text-secondary)", lineHeight: 1.45 }}>
                        {l.name}
                        {opt && <span className="ml-1.5" style={{ color: "var(--text-muted)" }}>· {opt}</span>}
                      </span>
                      <span className="mono text-right" style={{ color: "var(--text-primary)" }}>{fmt(rowFor(l).cost)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const groupList = (heading: string, note: string | null, rows: RenoLine[], showDue: boolean) => (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{heading}</span>
        <span className="text-xs mono" style={{ color: "var(--text-muted)" }}>
          {fmt(rows.reduce((sum, l) => sum + rowFor(l).cost, 0))}
        </span>
      </div>
      {note && <p className="text-[11px] mt-0.5 mb-1" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>{note}</p>}
      <div className="space-y-1 mt-1">
        {rows.map((l) => {
          const r = rowFor(l);
          return (
            <div key={l.key} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                {l.name}
                {showDue && !l.autoInclude && <span style={{ color: "var(--text-muted)" }}> · due ~yr {l.urgencyYears}</span>}
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                <span style={{ color: "var(--text-muted)" }}>{r.tierLabel}{r.labour === "diy" ? " · DIY" : ""}{r.pct < 1 ? ` · ${Math.round(r.pct * 100)}%` : ""}</span>
                <span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(r.cost)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Section 1 — what YOU have chosen. This leads now: a reader arriving
          on this tab has already ticked items on Improvements, so their own
          plan is the thing they came back to adjust. */}
      <div>
        <div className="text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "var(--brand)" }}>Your renovation plan</div>
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>What you&apos;ll spend over {holdYears} years</h3>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Two parts. <strong style={{ color: "var(--text-primary)" }}>Needed at purchase</strong> is what&apos;s ticked on the <strong style={{ color: "var(--text-primary)" }}>Improvements</strong> tab: work needed the day you buy or before you can rent it out, plus anything you tick yourself. <strong style={{ color: "var(--text-primary)" }}>Due during your hold</strong> is work that isn&apos;t needed yet but reaches end of life while you own the place — a roof due in year eight is your cost on a ten-year hold and somebody else&apos;s on a five-year one, so <strong style={{ color: "var(--text-primary)" }}>move the hold slider and it re-makes itself</strong>. Both feed your yield and predicted sale price; untick anything you wouldn&apos;t do.
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
        {/* The reader's own choices lead. What WE put in the plan is listed at
            the foot of the page, under the items — it used to sit here, and on
            a ten-year hold it was forty-odd lines above the three the reader
            had actually picked. The total still counts both, and says so. */}
        <div className="mt-3 pt-3 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
          {atPurchase.length > 0 ? (
            groupList("Needed at purchase", null, atPurchase, false)
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Nothing needed at purchase. Tick an item below, or on the Improvements tab, to do it straight away.
            </p>
          )}
          {recommended.length > 0 && (
            <a href="#our-recommendation" className="flex items-baseline justify-between gap-2 text-xs" style={{ color: "var(--brand)" }}>
              <span>
                Due during your {holdYears}-year hold: {recommended.length} {recommended.length === 1 ? "job" : "jobs"}, listed by year at the bottom
              </span>
              <span className="mono">{fmt(duringHoldTotal)}</span>
            </a>
          )}
        </div>
        {price > 0 && (
          <div className="mt-3 pt-3 space-y-1 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between"><span style={{ color: "var(--text-secondary)" }}>Total renovation cost</span><span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(total)}</span></div>
            <div className="flex items-center justify-between"><span style={{ color: "var(--text-secondary)" }}>Purchase price</span><span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(price)}</span></div>
            <div className="flex items-center justify-between font-bold"><span style={{ color: "var(--text-primary)" }}>Total investment</span><span className="mono" style={{ color: "var(--brand)" }}>{fmt(price + total)}</span></div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Total investment feeds the yield calc and the predicted sale price.</div>
          </div>
        )}
      </div>

      {items.length === 0 && (
        <div className="card p-6 text-sm" style={{ color: "var(--text-secondary)" }}>
          Nothing due inside a {holdYears}-year hold. Move the slider out to see work that falls due later, or tick any item marked <em>&ldquo;Optional&rdquo;</em> on the <strong style={{ color: "var(--text-primary)" }}>Improvements</strong> tab.
        </div>
      )}
      {/* EVERY line in scope for this hold, not just the ticked ones.
          Mapping `selected` here meant unticking something removed its own
          checkbox from the page — the control you'd need to change your mind
          disappeared with the decision, and the only way back was the
          Improvements tab. That was survivable while the plan held two items;
          now that most in-hold work is ticked by default, unticking is the
          normal interaction and it has to be reversible where it happens. */}
      {items.map((l) => {
        const t = renoToggles[l.key];
        const included = renoIncluded(l, renoToggles, withinHold(l.urgencyYears));
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
                {included && (() => {
                  const r = rowFor(l);
                  const isOpen = !!openCards[l.key];
                  const canOpen = !!l.costing || (l.working?.length ?? 0) > 0;
                  return (
                    <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
                      <span className="text-sm mono" style={{ color: "var(--brand)" }}>
                        {l.costing ? (
                          <>
                            {fmt(r.cost)}
                            <span className="text-[11px] ml-1.5" style={{ color: "var(--text-muted)" }}>
                              {r.tierLabel}{r.labour === "diy" ? " · DIY" : ""}{r.pct < 1 ? ` · ${Math.round(r.pct * 100)}%` : ""}
                            </span>
                          </>
                        ) : (
                          `${fmt(l.low)}–${fmt(l.high)}`
                        )}
                      </span>
                      {canOpen && (
                        <button
                          type="button"
                          onClick={() => setOpenCards((o) => ({ ...o, [l.key]: !o[l.key] }))}
                          aria-expanded={isOpen}
                          className="inline-flex items-center gap-1 text-xs cursor-pointer"
                          style={{ color: "var(--brand)" }}
                        >
                          {l.costing ? (isOpen ? "Hide options" : "Show options") : isOpen ? "Hide how we got this figure" : "How we got this figure"}
                          {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}
                    </div>
                  );
                })()}
                {included && openCards[l.key] && (
                  l.costing ? (
                    <>
                      <div className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>Est. quantity: {l.costing.quantityNote || `${l.costing.quantity} ${l.costing.quantityUnit}`}</div>
                      <ThreeTier line={l} toggle={t}
                        onTier={(tier) => setRenoToggle(l.key, { tier, labour: l.costing ? l.costing[tier].defaultLabour : "tradie" })}
                        onLabour={(mode) => setRenoToggle(l.key, { labour: mode })}
                        onPct={(pct) => setRenoToggle(l.key, { affectedPct: pct })} />
                    </>
                  ) : (
                    <ol className="mt-2 space-y-1 text-xs list-decimal pl-4" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>
                      {(l.working ?? []).map((w) => <li key={w}>{w}</li>)}
                    </ol>
                  )
                )}
              </div>
            </div>
            {included && openCards[l.key] && l.costing && surfaceForKind(l.costing.kind) && materialsFor(surfaceForKind(l.costing.kind)!).length > 0 && (
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
      {/* Section 2 — what WE would do: the work we put in the plan for this
          hold, by year. Below the reader's own choices and the items, never
          above them. */}
      {recommended.length > 0 && (
        <div id="our-recommendation" className="pt-3 text-[11px] uppercase tracking-widest scroll-mt-24" style={{ color: "var(--brand)" }}>Our recommendation</div>
      )}
      {recommended.length > 0 && (
        <div className="card p-5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Due during your {holdYears}-year hold</span>
            <span className="text-xs mono" style={{ color: "var(--text-muted)" }}>{fmt(duringHoldTotal)}</span>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
            By the year each job falls due. None of it is needed on day one, so it isn&apos;t ticked, but it reaches end of
            life while you own the place, so it&apos;s counted in the total above. Tick one to do it at purchase instead, or
            untick it if you wouldn&apos;t do it.
          </p>
          {timeline(recommended)}
        </div>
      )}

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Choose a tier per item — 🩹 Patch Up, 🔨 Replace Budget or ✨ Replace High End — and DIY vs Pay someone. Tap See breakdown for the itemised materials (from the NZ materials database) plus labour. The total feeds the predicted sale price and investor yield.
        {persona === "investor" && " Rent-uplift figures are indicative typical-market estimates."}
      </p>
    </div>
  );
}

// ── Financial (basic, from real price) ───────────────────────────────────────
// ── Finance tab field helpers ────────────────────────────────────────────────
/**
 * A money field you can actually clear.
 *
 * It holds TEXT while it is being edited and only falls back to the committed
 * number once focus leaves. Bound straight to a number, clearing the box ran
 * `Number("") || 0` and put a 0 back into it — so the next keystroke landed
 * AFTER that zero and you were typing $0700000. An empty box has to be allowed
 * to BE empty, and a number cannot represent empty; only a string can.
 */
function MoneyInput({ value, onChange, disabled, width = "w-28" }: {
  value: number; onChange: (n: number) => void; disabled?: boolean; width?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      onWheel={blurOnWheel}
      value={draft ?? String(value)}
      disabled={disabled}
      onChange={(e) => {
        // A leading zero in front of a real digit is never wanted in a dollar
        // field, and is exactly what a 0-valued one does to the first keystroke.
        // Everything else is left as typed, so "" stays empty and a decimal
        // point survives long enough to type the rest of the number.
        const typed = e.target.value;
        const cleaned = /^0\d/.test(typed) ? String(Number(typed)) : typed;
        setDraft(cleaned);
        onChange(Math.max(0, Number(cleaned) || 0));
      }}
      // Hand the display back to the committed value, which normalises whatever
      // is left over — a trailing ".", a lone "-", "007".
      onBlur={() => setDraft(null)}
      className={`rounded px-2 py-1 text-sm ${width} mono text-right`}
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)", opacity: disabled ? 0.4 : 1 }}
    />
  );
}

/** MoneyInput's sibling for the fields that aren't dollars — rates, percentages,
 *  terms. Same draft, same reason; `commit` applies each field's own clamp. */
function NumInput({ value, onChange, disabled, width, step, className, style }: {
  value: number; onChange: (n: number) => void; disabled?: boolean;
  width: string; step?: number; className?: string; style?: React.CSSProperties;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      onWheel={blurOnWheel}
      step={step}
      value={draft ?? String(value)}
      disabled={disabled}
      onChange={(e) => {
        const typed = e.target.value;
        const cleaned = /^0\d/.test(typed) ? String(Number(typed)) : typed;
        setDraft(cleaned);
        onChange(Number(cleaned) || 0);
      }}
      onBlur={() => setDraft(null)}
      className={className ?? `rounded px-2 py-1 text-sm ${width} mono text-right`}
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)", ...style }}
    />
  );
}

function FinNum({ label, value, onChange, hint, disabled }: { label: string; value: number; onChange: (n: number) => void; hint?: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <span style={{ color: "var(--text-secondary)" }}>{label}{hint && <span className="text-[11px] ml-1" style={{ color: "var(--text-muted)" }}>· {hint}</span>}</span>
      <span className="inline-flex items-center gap-1 flex-shrink-0">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>$</span>
        <MoneyInput value={value} onChange={onChange} disabled={disabled} />
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

// ── Tectara Value Verdict (Change 1) — the headline number, top of the Finance tab.
// Suburb median $/m² (scraped) × condition multiplier (the hidden quality score)
// × floor area = Tectara fair value; compared against asking + selected renovations.
function ValueVerdict({ asking, improvementValuation, landAreaSqm, suburbValue, dwellingAdded = 0, listing, value = null }: {
  asking: number; improvementValuation: ImprovementValueResult; landAreaSqm: number | null; suburbValue?: SuburbValue; dwellingAdded?: number;
  listing?: StoredReport["listing"];
  /** THE valuation, from lib/scoring/property-value.ts. Never recomputed here. */
  value?: PropertyValue | null;
}) {
  const [open, setOpen] = useState(false);
  // The land the OWNER holds, which on a cross lease is their share of the site
  // and not the whole thing. Same function and same argument valueProperty used,
  // so the working shown here is the working that produced the number.
  const typicalLand = valueLand({ landAreaSqm: value?.landAreaValuedSqm ?? landAreaSqm, suburbValue });
  // The land line is THE valuation's — the typical section adjusted for this
  // one's shape, slope, orientation and access — never the unadjusted figure.
  const land = typicalLand && value ? { ...typicalLand, landValue: value.landValue } : typicalLand;

  // An apartment, a unit, or anything on a title that gives its owner no
  // section of their own. There is no land line to add because the land is
  // already inside what comparable sales of this type fetch — adding it again
  // would count it twice. Same figure the map carries; there is one valuation.
  const method = methodFor({
    propertyType: listing?.propertyType,
    titleType: listing?.titleType,
    floorAreaSqm: improvementValuation.floorAreaSqm || listing?.floorAreaSqm,
    landAreaSqm,
    landShareFraction: listing?.landShareFraction,
  });
  if (method === "floor-area-comparables") {
    return (
      <ByComparables
        asking={asking}
        floorAreaSqm={improvementValuation.floorAreaSqm || listing?.floorAreaSqm || 0}
        suburbValue={suburbValue}
        propertyType={listing?.propertyType ?? null}
        titleType={listing?.titleType ?? null}
      />
    );
  }

  if (!asking || improvementValuation.buildingValue <= 0 || !land || !suburbValue || !value) {
    const why = !asking
      ? "Add a purchase price to see the verdict."
      : improvementValuation.buildingValue <= 0
        ? "No floor area is on file, so we can't value the improvements."
        : !land
          ? "No land area or comparable-sales data, so we can't value the land yet."
          : "Not enough data to estimate a value.";
    return (
      <div className="card p-5" style={{ border: "1px solid var(--border)" }}>
        <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: "var(--brand)" }}>{PRODUCT_SHORT_NAME} Value Verdict</div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{why}</p>
      </div>
    );
  }

  const rv = value;
  const xl = value.crossLease;
  const verdict = asking > rv.high ? "over" : asking < rv.low ? "under" : "fair";
  const diff = rv.total - asking; // + = under (good), − = over
  const VC = verdict === "over" ? "var(--bad)" : verdict === "under" ? "var(--good)" : "var(--warn)";

  return (
    <div className="card p-5" style={{ border: `1px solid ${alpha(VC, 33)}` }}>
      <div className="text-[11px] uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>{PRODUCT_SHORT_NAME} Value Verdict</div>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between"><span style={{ color: "var(--text-secondary)" }}>Land value <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· est.{xl ? ` · this flat's ${land.landAreaSqm}m² share` : ""}</span></span><span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(land.landValue)}</span></div>
        <div className="flex items-center justify-between"><span style={{ color: "var(--text-secondary)" }}>Improvement value <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· itemised</span></span><span className="mono" style={{ color: "var(--text-primary)" }}>+{fmt(rv.buildingValue - dwellingAdded)}</span></div>
        {dwellingAdded > 0 && (
          <div className="flex items-center justify-between"><span style={{ color: "var(--text-secondary)" }}>Extra dwelling <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· depreciated, less compliance</span></span><span className="mono" style={{ color: "var(--text-primary)" }}>+{fmt(dwellingAdded)}</span></div>
        )}
        {xl && (
          <div className="flex items-center justify-between"><span style={{ color: "var(--text-secondary)" }}>Cross-lease adjustment <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· −{xl.pct}% · {xl.coOwners} flats share the title</span></span><span className="mono" style={{ color: "var(--bad)" }}>−{fmt(xl.deduction ?? 0)}</span></div>
        )}
        <div className="flex items-center justify-between font-bold pt-1.5" style={{ borderTop: "1px solid var(--border)" }}><span style={{ color: "var(--text-primary)" }}>{PRODUCT_SHORT_NAME} value</span><span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(rv.total)}</span></div>
        <div className="flex items-center justify-between"><span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Likely range</span><span className="mono text-[11px]" style={{ color: "var(--text-muted)" }}>{fmt(rv.low)} – {fmt(rv.high)}</span></div>
        <div className="flex items-center justify-between pt-2"><span style={{ color: "var(--text-secondary)" }}>Asking price</span><span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(asking)}</span></div>
      </div>

      <div className="mt-4 rounded-lg p-3" style={{ background: `${alpha(VC, 8)}`, border: `1px solid ${alpha(VC, 25)}` }}>
        {verdict === "over" && <div className="font-bold text-sm" style={{ color: VC }}>⚠️ OVERVALUED by ~{fmt(Math.abs(diff))}</div>}
        {verdict === "under" && <div className="font-bold text-sm" style={{ color: VC }}>✅ UNDERVALUED by ~{fmt(diff)}</div>}
        {verdict === "fair" && <div className="font-bold text-sm" style={{ color: VC }}>⚖️ FAIRLY PRICED — within the estimate range</div>}
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          {verdict === "over" && `The asking price is above ${PRODUCT_NAME}'s land + improvements estimate for this property.`}
          {verdict === "under" && `The asking price is below ${PRODUCT_NAME}'s land + improvements estimate — a potential opportunity.`}
          {verdict === "fair" && `The asking price sits inside ${PRODUCT_NAME}'s estimated value range for this property.`}
        </p>
      </div>

      {xl && (
        <p className="text-xs mt-3 rounded-lg p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          {explainCrossLeaseDiscount(xl)}
        </p>
      )}

      {/* What the figure rests on, stated with the figure rather than buried in
          the working. Components nobody could see are skipped entirely — no
          phantom value — which is right and completely invisible unless it is
          said. Weighted by replacement cost: missing the roof is not the same
          as missing the letterbox. */}
      <ConfirmedVsEstimated valuation={improvementValuation} sampleSize={suburbValue?.sampleSize ?? null} />

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
            <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{PRODUCT_SHORT_NAME} value &amp; verdict</div>
            <div className="mono" style={{ color: "var(--text-secondary)" }}>land {fmt(land.landValue)} + improvements {fmt(rv.buildingValue)}{xl ? ` − cross lease ${xl.pct}% (${fmt(xl.deduction ?? 0)})` : ""} = {fmt(rv.total)} (range {fmt(rv.low)}–{fmt(rv.high)})</div>
            <div className="mono" style={{ color: "var(--text-secondary)" }}>vs asking {fmt(asking)} → {diff >= 0 ? "under" : "over"} by {fmt(Math.abs(diff))}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * How much of the building valuation was seen, and how much was estimated.
 *
 * Both halves are real money and the reader is entitled to know the mix. A roof
 * that isn't in the photographs is still up there — on a house finished last
 * year it is almost certainly a new roof, and leaving it at zero understated the
 * property by the price of a reroof. But an estimate is not a measurement, and
 * a valuation that quietly blends the two is the thing this whole app exists
 * not to be.
 */
function ConfirmedVsEstimated({ valuation, sampleSize }: {
  valuation: ImprovementValueResult; sampleSize: number | null;
}) {
  const [open, setOpen] = useState(false);
  const total = valuation.confirmedValue + valuation.estimatedValue;
  if (total <= 0) return null;
  const confirmedPct = Math.round((valuation.confirmedValue / total) * 100);
  const estimatedPct = 100 - confirmedPct;

  // A donut, drawn with one stroke-dasharray rather than a chart library.
  const R = 26, C = 2 * Math.PI * R;
  const seen = (confirmedPct / 100) * C;
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

  return (
    <div className="mt-3 rounded-lg p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div className="text-[11px] font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
        What this is based on
      </div>
      <div className="flex items-center gap-4">
        <svg width="68" height="68" viewBox="0 0 68 68" role="img" aria-label={`${confirmedPct}% confirmed, ${estimatedPct}% estimated`} className="flex-shrink-0">
          <circle cx="34" cy="34" r={R} fill="none" stroke="var(--border)" strokeWidth="11" />
          <circle
            cx="34" cy="34" r={R} fill="none" stroke="var(--good)" strokeWidth="11"
            strokeDasharray={`${seen} ${C - seen}`} strokeDashoffset={C / 4} transform="rotate(-90 34 34)"
          />
          <text x="34" y="38" textAnchor="middle" className="mono" style={{ fontSize: 13, fontWeight: 700, fill: "var(--text-primary)" }}>
            {confirmedPct}%
          </text>
        </svg>
        <div className="min-w-0 text-[11px]" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>
          <div>
            <strong style={{ color: "var(--good)" }}>{confirmedPct}% confirmed</strong> — {valuation.coverage.valued} components
            read directly from the photos ({fmt(valuation.confirmedValue)}).
          </div>
          {valuation.estimatedValue > 0 && (
            <div className="mt-1">
              <strong style={{ color: "var(--text-primary)" }}>{estimatedPct}% estimated</strong> — {valuation.estimatedItems.length} components
              nobody could see ({fmt(valuation.estimatedValue)}), valued at the condition the rest of this building
              presents. A roof that isn&apos;t in the photos is still up there, and on a well-kept house it is
              probably well kept too — but nobody has looked, and a viewing may move it either way.
            </div>
          )}
          {sampleSize ? <div className="mt-1" style={{ color: "var(--text-muted)" }}>The land half comes from {sampleSize} recent nearby sales.</div> : null}
        </div>
      </div>
      {valuation.estimatedItems.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 text-[11px] cursor-pointer"
            style={{ color: "var(--brand)" }}
          >
            {open ? "Hide what was estimated" : `Show the ${valuation.estimatedItems.length} estimated components`}
          </button>
          {open && (
            <div className="mt-2 space-y-1">
              {[...valuation.estimatedItems].sort((a, b) => b.valueNow - a.valueNow).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 text-[11px]">
                  <span style={{ color: "var(--text-secondary)" }}>{e.label} <span style={{ color: "var(--text-muted)" }}>· {e.category}</span></span>
                  <span className="mono" style={{ color: "var(--text-muted)" }}>{fmt(e.valueNow)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The verdict for a property with no section of its own.
 *
 * One number, from what comparable sales of this type fetch per square metre.
 * The land is NOT missing from it — every one of those buyers paid for the
 * ground under their flat, so it is already inside the rate. Breaking it out as
 * a separate line would count it twice, and pricing a share of shared ground as
 * though it were a private section would overstate what is being bought.
 *
 * No condition adjustment. We can see the condition and the report says so
 * elsewhere; nobody has yet measured what a condition point is worth per m² in
 * this market, so the figure is what a TYPICAL one of these fetches and the
 * caveat is printed rather than a multiplier invented.
 */
function ByComparables({ asking, floorAreaSqm, suburbValue, propertyType, titleType }: {
  asking: number; floorAreaSqm: number; suburbValue?: SuburbValue;
  propertyType: string | null; titleType: string | null;
}) {
  const matched = comparablesMatch(propertyType, suburbValue?.propertyType);
  const rate = suburbValue?.medianPerSqm ?? 0;
  const total = matched && rate > 0 && floorAreaSqm > 0 ? Math.round(rate * floorAreaSqm) : 0;

  if (!total || !asking) {
    return (
      <div className="card p-5" style={{ border: "1px solid var(--border)" }}>
        <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: "var(--brand)" }}>{PRODUCT_SHORT_NAME} Value Verdict</div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {!asking
            ? "Add a purchase price to see the verdict."
            : !floorAreaSqm
              ? "This listing gives no floor area, and floor area is what a property like this is valued on."
              : `We value ${/^[aeiou]/i.test(propertyType ?? "") ? "an" : "a"} ${propertyType ?? "property"} like this from recent sales of the same kind nearby, and we couldn't find enough of them.`}
        </p>
      </div>
    );
  }

  const low = Math.round(total * 0.88);
  const high = Math.round(total * 1.12);
  const verdict = asking > high ? "over" : asking < low ? "under" : "fair";
  const diff = total - asking;
  const VC = verdict === "over" ? "var(--bad)" : verdict === "under" ? "var(--good)" : "var(--warn)";
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

  return (
    <div className="card p-5" style={{ border: `1px solid ${alpha(VC, 33)}` }}>
      <div className="text-[11px] uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>{PRODUCT_SHORT_NAME} Value Verdict</div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span style={{ color: "var(--text-secondary)" }}>{floorAreaSqm}m² × {fmt(rate)}/m² <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· {suburbValue?.sampleSize ?? 0} comparable sales</span></span>
          <span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(total)}</span>
        </div>
        <div className="flex items-center justify-between"><span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Likely range</span><span className="mono text-[11px]" style={{ color: "var(--text-muted)" }}>{fmt(low)} – {fmt(high)}</span></div>
        <div className="flex items-center justify-between pt-2"><span style={{ color: "var(--text-secondary)" }}>Asking price</span><span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(asking)}</span></div>
      </div>

      <div className="mt-4 rounded-lg p-3" style={{ background: `${alpha(VC, 8)}`, border: `1px solid ${alpha(VC, 25)}` }}>
        <div className="font-bold text-sm" style={{ color: VC }}>
          {verdict === "over" ? `Above the range by ~${fmt(Math.abs(diff))}` : verdict === "under" ? `Below the range by ~${fmt(diff)}` : "Inside the estimated range"}
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          Compared with what {propertyType ? `${propertyType}s` : "properties"} of this size have recently sold for nearby.
        </p>
      </div>

      <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
        {titleType === "cross_lease" || titleType === "unit_title"
          ? "There's no separate land figure because the land is already inside what these sell for — every one of those buyers paid for the ground under their home too. Showing it again would count it twice."
          : "There's no separate land figure because the land is already inside what these sell for."}
      </p>
      <div className="mt-3 rounded-lg p-2.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>What this is based on</div>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
          {suburbValue?.sampleSize ?? 0} recent sales of the same kind of property nearby, and this
          one&apos;s floor area. No part of it is inferred from the condition score.
        </p>
      </div>

      <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
        This is what a <strong style={{ color: "var(--text-secondary)" }}>typical</strong> one of these fetches at this size. We can see this
        one&apos;s condition — it&apos;s scored throughout this report — but we don&apos;t yet have the sales
        evidence to say what that condition is worth in dollars, so we haven&apos;t guessed at it. Always
        obtain a registered valuation before purchasing.
      </p>
    </div>
  );
}

function FinanceTab({ listing, persona, marketRent, capitalGrowth, renoLines, renoToggles, score, suburbValue, improvementValuation, dwellingAdded = 0, landOnly = false, propertyValue = null }: {
  listing: StoredReport["listing"];
  persona: Persona;
  /** Bare section — there is nothing to let, so there is no rent and no yield. */
  landOnly?: boolean;
  marketRent?: MarketRent;
  capitalGrowth?: CapitalGrowth;
  renoLines: RenoLine[];
  renoToggles: Record<string, RenoToggle>;
  score: number;
  suburbValue?: SuburbValue;
  improvementValuation: ImprovementValueResult;
  dwellingAdded?: number;
  /** THE valuation, computed once by the parent. Never rebuilt down here. */
  propertyValue?: PropertyValue | null;
}) {
  const { holdYears, withinHold } = useHoldPeriod();
  // The plan, split by WHEN you pay for it: the ticked work at purchase, the
  // rest as it falls due — the same split the Renovations tab shows.
  const { atPurchase: renoUpfront, duringHold: renoDeferred } = renoSplit(renoLines, renoToggles, withinHold);
  const renoTotal = renoUpfront + renoDeferred;
  const renoUplift = selectedRenoUplift(renoLines, renoToggles, withinHold);
  const price = listing.askingPrice ?? 0;
  const floorSqm = listing.floorAreaSqm ?? 0;
  const growthPct = capitalGrowth?.annualRatePct ?? 5;

  // OUR OWN VALUATION IS A PRICE. On a "By Negotiation" listing the whole tab
  // used to sit behind "Enter a purchase price above to run the calculator" —
  // on a report that had already worked out what the property is worth and
  // printed it two tabs over. Refusing to compute anything while holding the
  // number needed to compute it is the app declining to do its job.
  //
  // It is the SEED for the price box, and nothing more. It used to be forced
  // into the calculator on every render instead, which meant the reader could
  // type their own purchase price, watch the box accept it, and get the same
  // walk-away figure back — every number on the tab was still being computed
  // from the asking price. A control that visibly takes an input and silently
  // ignores it is worse than one that is disabled.
  const modelled = !price && propertyValue?.total ? propertyValue.total : null;
  const seedPrice = price || modelled || 0;

  const rentDefault = marketRent?.weekly ?? Math.round((seedPrice * 0.04) / 52);

  const [inp, setInp] = useState<FinanceInputs>(() => defaultInputs({ persona, price: seedPrice, floorSqm, holdYears, renoCost: renoTotal, weeklyRent: rentDefault, growthPct, buildYear: listing.buildYear }));
  const [rateLoading, setRateLoading] = useState(false);
  const [rateInfo, setRateInfo] = useState<{ source: string; retrievedAt: string; lender: string; options: { label: string; ratePct: number }[] } | null>(null);
  const [rateErr, setRateErr] = useState<string | null>(null);

  // Persona-driven defaults (deposit %, loan type) follow the header toggle.
  useEffect(() => {
    setInp((p) => ({ ...p, depositPct: persona === "investor" ? FINANCE_DEFAULTS.depositPctInvestor : FINANCE_DEFAULTS.depositPctBuyer, loanType: persona === "investor" ? "io" : "pi" }));
  }, [persona]);

  // The modelled valuation can arrive AFTER this mounts — it is computed from
  // the site geometry, which is fetched. Seed the price box when it lands, but
  // only while the box is still empty: overwriting a figure the reader typed
  // because a request came back late is the same bug in the other direction.
  // Returning the state object unchanged when there is nothing to do keeps this
  // from re-rendering on every seed change.
  useEffect(() => {
    setInp((p) => (p.price === 0 && seedPrice > 0 ? { ...p, price: seedPrice } : p));
  }, [seedPrice]);

  if (!seedPrice) {
    return <div className="card p-6 text-sm" style={{ color: "var(--text-secondary)" }}>Enter a purchase price above to run the calculator{listing.priceText ? ` — the listing says “${listing.priceText}”` : ""}.</div>;
  }

  // `inp.price` and nothing else. Deposit, loan, repayments, maintenance, the
  // projected sale value and therefore the walk-away all fall out of it.
  const inputs: FinanceInputs = { ...inp, persona, holdYears, renoCost: renoUpfront, renoDeferred, renoUplift };
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
      {/* Tectara Value Verdict — the most important thing a buyer needs to know. */}
      <ValueVerdict asking={price} improvementValuation={improvementValuation} landAreaSqm={listing.landAreaSqm} suburbValue={suburbValue} dwellingAdded={dwellingAdded} listing={listing} value={propertyValue} />

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
            {/* Only what you pay at settlement. Work due later is real money
                but not deposit money, so it appears under holding costs. */}
            <FinRow label="Renovations (now)" value={fmt(inputs.renoCost)} />
            <FinRow label="Total cash in" value={fmt(s.totalCashIn)} strong />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Sale in {holdYears} yrs</div>
            {/* The uplift gets its own line rather than quietly inflating the
                projected price. It moves a six-figure number and a reader is
                owed the reason — and it is OUR valuation model talking, not a
                promise about what a buyer will pay. */}
            {s.renoUplift > 0 && (
              <FinRow label="Renovation adds (our valuation)" value={"+" + fmt(s.renoUplift)} />
            )}
            <FinRow label="Projected price" value={fmt(s.projectedValue)} />
            <FinRow label="Less remaining loan" value={"−" + fmt(s.remainingLoan)} />
            <FinRow label="Less agent + legal" value={"−" + fmt(s.agentFees + s.saleLegal)} />
            <FinRow label="Net sale proceeds" value={fmt(s.netSaleProceeds)} strong />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Holding cost ({holdYears} yrs)</div>
            <FinRow label="Mortgage + ongoing" value={fmt(s.totalOngoingOverHold)} />
            {s.renoDeferred > 0 && (
              <FinRow label={`Renovations due within ${holdYears} yrs`} value={fmt(s.renoDeferred)} />
            )}
            {isInvestor && <FinRow label="Less rent received" value={"−" + fmt(s.rentalIncomeOverHold)} />}
            <FinRow label="Net cost of ownership" value={fmt(s.netCostOfOwnership)} strong />
          </div>
        </div>
        <div className="text-xs mt-4 pt-3" style={{ borderTop: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          Put {fmt(s.totalCashIn)} in a term deposit at {inp.termDepositRatePct}% for {holdYears} years and you&apos;d have <span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(s.termDepositValue)}</span>. This property returns <span className="mono" style={{ color: s.walkAway >= 0 ? "var(--good)" : "var(--bad)" }}>{fmt(s.walkAway)}</span>.
        </div>

        {/* The SAME slider as the one in the report header, not a copy of it.
            Both read and write `HoldPeriodContext`, so they move together with
            no syncing to get wrong — and the hold is the single input that moves
            this figure most, which made scrolling back up to the top of the
            report to try another number the wrong thing to ask of a reader. */}
        <div className="mt-4">
          <HoldPeriodSlider />
        </div>
      </div>

      {/* Section 1 — Purchase details */}
      <FinSection title="Purchase details">
        <FinNum label="Purchase price" value={inp.price} onChange={(v) => set({ price: v })} />
        <FinRow label="Hold period (set by either slider)" value={`${holdYears} years`} />
        <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Deposit</span>
          <span className="inline-flex items-center gap-1">
            <NumInput width="w-16" value={Math.round(inp.depositPct * 100)} onChange={(v) => set({ depositPct: Math.max(0, Math.min(100, v)) / 100 })} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>% = {fmt(s.deposit)}</span>
          </span>
        </div>
        <FinRow label="Loan amount" value={fmt(s.loan)} />
        {/* The upfront share only — this sits under "money needed to BUY", and
            the rest of the plan is a holding cost, shown as its own line above. */}
        <FinRow label="Renovations due now (from Renovations tab)" value={fmt(inputs.renoCost)} />
        <FinRow label="Total money needed to buy" value={fmt(s.totalCashIn)} strong />
      </FinSection>

      {/* Section 2 — Mortgage */}
      <FinSection title="Mortgage">
        <div className="flex items-center justify-between gap-2 py-1.5 text-sm flex-wrap">
          <span style={{ color: "var(--text-secondary)" }}>Interest rate</span>
          <span className="inline-flex items-center gap-2">
            <NumInput width="w-20" step={0.01} value={inp.interestRatePct} onChange={(v) => set({ interestRatePct: Math.max(0, v) })} />
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
          <span className="inline-flex items-center gap-1"><NumInput width="w-16" value={inp.loanTermYears} onChange={(v) => set({ loanTermYears: Math.max(1, Math.min(30, v || 30)) })} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>years</span></span>
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
            <span className="inline-flex items-center gap-1"><span className="text-xs" style={{ color: "var(--text-muted)" }}>$</span><MoneyInput value={inp.purchaseCosts[k]} disabled={!inp.purchaseCostsEnabled[k]} onChange={(v) => setCost(k, v)} width="w-24" /></span>
          </div>
        ))}
        <div className="mt-1 pt-2" style={{ borderTop: "1px solid var(--border)" }}><FinRow label="Total purchase costs" value={fmt(s.purchaseCostsTotal)} strong /></div>
      </FinSection>

      {/* Section 4 — Annual ongoing costs */}
      <FinSection title="Annual ongoing costs">
        <FinNum label="Council rates" value={inp.councilRates} onChange={(v) => set({ councilRates: v })} hint="regional estimate — verify" />
        <FinNum label="Home insurance" value={inp.insurance} onChange={(v) => set({ insurance: v })} hint="rebuild-cost estimate" />
        <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Maintenance <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>· {Math.round(inp.maintenancePctOfPrice * 1000) / 10}% of price · {maintenanceBasis(listing.buildYear, new Date().getFullYear())}</span></span>
          <span className="mono" style={{ color: "var(--text-primary)" }}>{fmt(s.maintenance)}</span>
        </div>
        <FinNum label="Body corporate" value={inp.bodyCorp} onChange={(v) => set({ bodyCorp: v })} hint="if applicable" />
        <div className="mt-1 pt-2 space-y-1" style={{ borderTop: "1px solid var(--border)" }}>
          <FinRow label="Total annual costs" value={fmt(s.annualOngoing)} strong />
          <FinRow label="Total weekly costs" value={fmt(s.weeklyOngoing) + "/wk"} />
        </div>
      </FinSection>

      {/* Section 5 — Investor.
          Not on a bare section. There is no dwelling to let, so weekly rent,
          vacancy, management and yield describe a building that doesn't exist —
          and the panel was printing "+$24/wk net cash flow" and "8.5% gross
          yield" against an empty paddock, with the rent figure lifted from the
          suburb's HOUSE median. A caveat inside the note isn't enough when the
          number beside it is a confident green figure. */}
      {isInvestor && landOnly && (
        <FinSection title="Investor — rent & cashflow">
          <p className="py-1.5 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
            There is no dwelling on this property, so it produces no rent and has no yield. The
            costs above are the real cost of holding the land — rates, insurance and finance — and
            they run whether or not anything is ever built on it.
          </p>
        </FinSection>
      )}
      {isInvestor && !landOnly && (
        <FinSection title="Investor — rent & cashflow">
          <FinNum label="Weekly rent" value={inp.weeklyRent} onChange={(v) => set({ weeklyRent: v })} hint={marketRent ? marketRent.source : "estimate — verify"} />
          <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <span style={{ color: "var(--text-secondary)" }}>Vacancy allowance</span>
            <span className="inline-flex items-center gap-1"><NumInput width="w-14" value={inp.vacancyWeeks} onChange={(v) => set({ vacancyWeeks: Math.max(0, v) })} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>wks/yr</span></span>
          </div>
          <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <label className="inline-flex items-center gap-2 cursor-pointer" style={{ color: "var(--text-secondary)" }}><input type="checkbox" checked={inp.mgmtEnabled} onChange={() => set({ mgmtEnabled: !inp.mgmtEnabled })} className="w-3.5 h-3.5 cursor-pointer" />Property management</label>
            <span className="inline-flex items-center gap-1"><NumInput width="w-14" step={0.5} value={Math.round(inp.mgmtFeePct * 1000) / 10} disabled={!inp.mgmtEnabled} onChange={(v) => set({ mgmtFeePct: Math.max(0, v) / 100 })} style={{ opacity: inp.mgmtEnabled ? 1 : 0.4 }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>%</span></span>
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
          <span className="inline-flex items-center gap-1 ml-2">override <NumInput width="w-14" step={0.1} value={inp.growthPct} onChange={(v) => set({ growthPct: v })} className="rounded px-1.5 py-0.5 text-xs w-14 mono text-right" />%</span>
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
          <span className="inline-flex items-center gap-1"><NumInput width="w-16" step={0.1} value={Math.round(inp.agentCommissionPct * 1000) / 10} onChange={(v) => set({ agentCommissionPct: Math.max(0, v) / 100 })} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>% = {fmt(s.agentFees)}</span></span>
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

// ── Healthy Homes (investor only) — the 5 legal standards, laid out like an
// Improvements item: what it is, whether it complies and what it costs on the
// card; the photos, what was seen and the action behind "See breakdown".
// It used to show a "Points" badge left over from the deleted 1,000-point score.

function HealthyHomesSection({ subItems, buildYear, renoControls, onOpenRenovations, hhAssessed, renoLines, renoToggles }: {
  subItems: SubItem[]; buildYear: number | null; renoControls: RenoControls; onOpenRenovations: () => void;
  /** The analysis's own read of each standard, against the requirement. */
  hhAssessed?: { standard: string; status: "met" | "not_visible" | "absent"; note?: string }[];
  renoLines: RenoLine[];
  renoToggles: Record<string, RenoToggle>;
}) {
  const [open, setOpen] = useState(false);
  const results = assessHealthyHomes(subItems, buildYear, hhAssessed);
  const byId = new Map(subItems.map((s) => [s.id, s]));
  const lineByKey = new Map(renoLines.filter((l) => !l.key.endsWith("_rem")).map((l) => [l.key, l]));
  // The same figure the Renovations tab prices the line at, at the option chosen there.
  const costOf = (key: string) => {
    const l = lineByKey.get(key);
    return l ? Math.round(lineCost(l, renoToggles[key])) : null;
  };
  // Only what we've actually established fails. Unknown is not a failure and it
  // is certainly not a pass.
  const failing = results.filter((r) => r.compliant === false);
  const toFixCost = failing.reduce((t, r) => t + (costOf(r.renoKey) ?? Math.round((r.remediation.low + r.remediation.high) / 2)), 0);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      {/* Folded by default, like the categories above it — the header carries
          the verdict and the cost, the five standards open on request. */}
      <button
        className="w-full text-left p-5 cursor-pointer flex items-center gap-4"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ borderLeft: `4px solid ${failing.length ? "var(--bad)" : "var(--good)"}` }}
      >
        <Shield size={22} className="flex-shrink-0" style={{ color: "var(--brand)" }} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base mb-1" style={{ color: "var(--text-primary)" }}>Healthy Homes — rental compliance</div>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>5 legal standards</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-right" style={{ background: failing.length ? "var(--bad-wash)" : "var(--good-wash)", color: failing.length ? "var(--bad)" : "var(--good)" }}>
            {failing.length ? <>{failing.length} of 5 to fix<span className="hidden sm:inline"> · </span><br className="sm:hidden" />{fmt(toFixCost)}</> : "None to fix"}
          </span>
          <ChevronRight size={18} style={{ color: "var(--text-muted)", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
        </div>
      </button>

      {open && (
      <div className="px-5 pb-5" style={{ borderTop: "1px solid var(--border)" }}>
      <p className="text-xs mt-4 mb-4" style={{ color: "var(--text-muted)", lineHeight: 1.55 }}>
        The 5 legal standards a rental has to meet. Anything that fails is a <strong style={{ color: "var(--text-secondary)" }}>must-do by law</strong> before
        you can tenant, so it&apos;s already ticked in your renovation plan.
      </p>

      <div className="space-y-3">
        {results.map((r) => (
          <HealthyHomesCard
            key={r.key}
            r={r}
            item={r.sourceItemId ? byId.get(r.sourceItemId) : undefined}
            note={hhAssessed?.find((h) => h.standard === r.key.replace(/^hh_/, ""))?.note}
            cost={costOf(r.renoKey)}
            buildYear={buildYear}
            renoControls={renoControls}
            onOpenRenovations={onOpenRenovations}
          />
        ))}
      </div>
      <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
        Read from the listing photos and the build year{buildYear ? ` (c.${buildYear})` : ""}. A certified Healthy Homes assessor signs it off before you tenant.
      </p>
      </div>
      )}
    </div>
  );
}

function HealthyHomesCard({ r, item, note, cost, buildYear, renoControls, onOpenRenovations }: {
  r: HHResult; item?: SubItem; note?: string; cost: number | null; buildYear: number | null;
  renoControls: RenoControls; onOpenRenovations: () => void;
}) {
  const [open, setOpen] = useState(false);
  const canReno = renoControls.has(r.renoKey);
  const inPlan = canReno && renoControls.included(r.renoKey);
  // Three states, not two. Showing "Compliant" for a standard nobody
  // established could put a landlord into a tenancy with a house that isn't.
  const state =
    r.compliant === null ? { label: "Not established", color: "var(--text-muted)", bg: "var(--surface)" }
    : r.compliant ? { label: "Meets the standard", color: "var(--good)", bg: "var(--good-wash)" }
    : { label: "⚖️ Must do, by law", color: "var(--bad)", bg: "var(--bad-wash)" };
  const accent = r.compliant === null ? "var(--warn)" : r.compliant ? "var(--good)" : "var(--bad)";
  // The list, plus any photo the standard's own note cites, so the header
  // never names different photos from the finding under it.
  const photos = r.basis === "observed" ? mergePhotoRefs(item?.photoReferences ?? [], citedPhotos(note)) : [];
  const range = `${fmt(r.remediation.low)}–${fmt(r.remediation.high)}`;
  const seen = mergeEvidence(
    [note, item?.observedDefect].filter((x): x is string => !!x),
    r.basis === "observed" && item ? evidenceFor(item) : [],
  );

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderLeft: `3px solid ${accent}` }}>
      <button className="w-full text-left p-4 cursor-pointer" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{r.label}</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: state.bg, color: state.color, border: r.compliant === null ? "1px solid var(--border)" : undefined }}>
                {state.label}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>{r.requirement}</p>
            <div className="inline-flex items-center gap-1 text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
              <ImageIcon size={11} />
              {photos.length > 0
                ? `Assessed from photo${photos.length > 1 ? "s" : ""} ${photos.join(", ")}`
                : r.basis === "build-era"
                  ? `Not in the photos — read from the build year${buildYear ? ` (c.${buildYear})` : ""}`
                  : "Not shown in any photo"}
            </div>
          </div>
          {r.compliant === false && (
            <span className="flex-shrink-0 inline-flex flex-col items-end rounded-lg font-bold tabular-nums" style={{ background: "var(--bad-wash)", border: "1px solid var(--bad)", color: "var(--bad)", fontFamily: "Fira Code, monospace", padding: "3px 10px", fontSize: 13 }}>
              {cost != null ? fmt(cost) : range}
              <span className="font-medium" style={{ fontSize: 10, opacity: 0.8 }}>to fix</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-2">
          <span className="text-xs" style={{ color: "var(--brand)" }}>{open ? "Hide detail" : "See breakdown"}</span>
          <ArrowRight size={11} style={{ color: "var(--brand)", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
        </div>
      </button>

      {canReno && (
        <div className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ borderTop: "1px solid var(--border)", background: inPlan ? "var(--accent-wash)" : "transparent" }}>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={inPlan} onChange={(e) => renoControls.toggle(r.renoKey, e.target.checked)} className="w-4 h-4 cursor-pointer flex-shrink-0" aria-label={`Add ${r.label} to the renovation plan`} />
            <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: inPlan ? "var(--brand)" : "var(--text-secondary)" }}>
              <Wrench size={11} />
              {inPlan
                ? renoControls.autoTicked(r.renoKey) ? "Needs doing before you rent it out" : "In your renovation plan"
                : "Optional — tick to do it straight after purchase"}
            </span>
          </label>
          {inPlan && (
            <button onClick={onOpenRenovations} className="inline-flex items-center gap-0.5 text-xs font-medium cursor-pointer hover:underline" style={{ color: "var(--brand)" }}>
              View <ArrowRight size={11} />
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="px-4 pb-4 pt-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
          <Step n={1} title="Listing photos">
            <div className="text-[13px]" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>
              {photos.length > 0 ? (
                <>Photos {photos.join(", ")}.</>
              ) : r.basis === "build-era" ? (
                <>The photos don&apos;t show this. It is read from the build year{buildYear ? ` (c.${buildYear})` : ""}, against when the Building Code started requiring it.</>
              ) : (
                <>No photo shows this, and the build year doesn&apos;t settle it.</>
              )}
            </div>
          </Step>
          <Step n={2} title="What we saw">
            {seen.concerns.length === 0 && seen.seen.length === 0 && r.basis !== "build-era" ? (
              <div className="text-[13px]" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>
                Nothing in the photos bears on this standard.
              </div>
            ) : r.basis === "build-era" && seen.concerns.length === 0 ? (
              <div className="text-[13px]" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>
                {r.compliant === true
                  ? `Built under the current Code, so it was required to meet this when it went up.`
                  : r.compliant === false
                    ? `Built before the Code required it. Nothing in the photos shows it has been added since.`
                    : `Built when the Code required it, but to a lower standard than today's minimum.`}
              </div>
            ) : (
              <EvidenceList concerns={seen.concerns} evidence={seen.seen} />
            )}
          </Step>
          <Step n={3} title="Action">
            <div className="text-[13px]" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>
              {r.compliant === false ? (
                <>
                  <strong style={{ color: "var(--text-primary)" }}>Required before you tenant.</strong> {r.fix}{" "}
                  {cost != null ? <>About <span className="mono">{fmt(cost)}</span> at the option chosen in your renovation plan.</> : <>Typically <span className="mono">{range}</span>.</>}
                </>
              ) : r.compliant === true ? (
                <>Nothing to do.</>
              ) : (
                <>
                  We couldn&apos;t establish this from the listing. What settles it: {r.settles.charAt(0).toLowerCase() + r.settles.slice(1)} If it
                  fails: {r.fix.charAt(0).toLowerCase() + r.fix.slice(1)} Typically <span className="mono">{range}</span>.
                </>
              )}
            </div>
          </Step>
        </div>
      )}
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

// ── Land reports ─────────────────────────────────────────────────────────────
// A section has no condition to score. What CAN be assessed is the site itself
// — contour, shape, orientation, access, planting — and the title behind it, so
// that is what the headline number is: those two inspections against their own
// total.
//
// Deliberately NOT shown out of 1,000. The engine normalises whatever it scored
// back to 1,000, so a land report would print a number that sits next to a
// house's and invites a comparison that means nothing. A house scoring 805/1000
// and a section scoring 805/1000 have almost no assessment in common.
function LandScoreBreakdown({ scored, locked = false }: { scored: ScoreResult; locked?: boolean }) {
  const land = scored.byInspection.land;
  const legal = scored.byInspection.legal;
  const earned = Math.round(land.earned + legal.earned);
  const max = Math.round(land.max + legal.max);
  const pct = max > 0 ? Math.round((earned / max) * 100) : 0;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Land &amp; title score</div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            There is no building on this property, so there is no condition to score. This is the site itself —
            contour, usable area, shape, orientation, access and planting — plus what the title carries. Scored
            against its own total, not the 1,000 points a house is scored out of.
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-3xl font-bold mono" style={{ color: "var(--text-primary)" }}>
            {locked ? (
              <BlurredValue label="Your score needs a paid plan">{earned}</BlurredValue>
            ) : (
              earned
            )}
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>/{max}</span>
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{locked ? "—" : `${pct}%`}</div>
        </div>
      </div>

      <div className="mt-4 space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span style={{ color: "var(--text-secondary)" }}>Site &amp; land quality</span>
          <span className="mono" style={{ color: "var(--text-primary)" }}>
            {locked ? <BlurredValue amount={6} label="Your score needs a paid plan">{Math.round(land.earned)}</BlurredValue> : Math.round(land.earned)}
            <span style={{ color: "var(--text-muted)" }}>/{Math.round(land.max)}</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ color: "var(--text-secondary)" }}>Title &amp; compliance</span>
          <span className="mono" style={{ color: "var(--text-primary)" }}>
            {locked ? <BlurredValue amount={6} label="Your score needs a paid plan">{Math.round(legal.earned)}</BlurredValue> : Math.round(legal.earned)}
            <span style={{ color: "var(--text-muted)" }}>/{Math.round(legal.max)}</span>
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
      </div>
    </div>
  );
}

/** What the section itself is worth. No building, so this is the whole valuation. */
function LandValueCard({ report }: { report: StoredReport }) {
  const landAreaSqm = report.listing.landAreaSqm ?? null;
  const typicalLand = valueLand({ landAreaSqm, suburbValue: report.suburbValue });
  // Bare land gets the same site adjustments as a house's section.
  const land = typicalLand
    ? { ...typicalLand, landValue: adjustLand(typicalLand.landValue, siteFactsFrom(report.subItems), report.listing.siteLayout?.measured?.nearby).valueNZD }
    : null;
  const asking = report.listing.askingPrice ?? null;
  // On a section the land value IS the report, so an unbounded extrapolation
  // from suburb house comps is the whole answer being wrong rather than a
  // rounding error. Say we can't value it instead.
  const publishable = land
    ? landValuePublishable({ landAreaSqm, landValue: land.landValue, askingPrice: asking })
    : { ok: false, reason: null };

  if (!land || !publishable.ok) {
    return (
      <div className="card p-5">
        <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: "var(--brand)" }}>Land value</div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {publishable.reason
            ? `We can't put a figure on this section yet — ${publishable.reason}.`
            : landAreaSqm
            ? "No recent comparable sales were found for this suburb, so the land can't be valued yet."
            : "The listing doesn't publish a land area, so the section can't be valued."}
        </p>
        <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
          Everything else in this report still stands — the site assessment, the title findings and the
          location facts all come from the listing itself, not from a valuation.
        </p>
      </div>
    );
  }

  const gap = asking && asking > 0 ? Math.round(((land.landValue - asking) / asking) * 100) : null;

  return (
    <div className="card p-5">
      <div className="text-[11px] uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>Land value</div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span style={{ color: "var(--text-secondary)" }}>
            Section <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· {land.landAreaSqm.toLocaleString()} m²</span>
          </span>
          <span className="mono" style={{ color: "var(--text-primary)" }}>${land.ratePerSqm.toLocaleString()}/m²</span>
        </div>
        <div className="flex items-center justify-between font-bold pt-1.5" style={{ borderTop: "1px solid var(--border)" }}>
          <span style={{ color: "var(--text-primary)" }}>Estimated land value</span>
          <span className="mono" style={{ color: "var(--text-primary)" }}>${land.landValue.toLocaleString()}</span>
        </div>
        {asking != null && (
          <>
            <div className="flex items-center justify-between pt-2">
              <span style={{ color: "var(--text-secondary)" }}>Asking price</span>
              <span className="mono" style={{ color: "var(--text-primary)" }}>${asking.toLocaleString()}</span>
            </div>
            {gap != null && (
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Against asking</span>
                <span className="mono font-semibold" style={{ color: gap >= 0 ? "var(--good)" : "var(--bad)" }}>
                  {gap >= 0 ? "+" : ""}{gap}%
                </span>
              </div>
            )}
          </>
        )}
      </div>
      <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
        An estimate from recent comparable sales in the suburb, adjusted for section size. It is not a
        registered valuation, and it values the land only — nothing is built on it.
      </p>
    </div>
  );
}

// ── The public record ────────────────────────────────────────────────────────
// Title and rating valuation from Toitū Te Whenua LINZ. Shown as its own card
// because its authority is different in kind from everything else in the
// report: the rest is read from photographs and a listing, this is the register.
//
// The two halves are NOT equally available. Title covers the whole country;
// the district valuation roll is published for roughly 12% of properties, so
// the valuation block is absent far more often than it is present — which is
// why nothing else in the report is allowed to depend on it.
function RecordRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm flex-shrink-0" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span
        className={`text-sm text-right mono ${bold ? "font-bold" : "font-medium"}`}
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}

function PublicRecordCard({ listing }: { listing: ScrapedListing }) {
  const rec = listing.linz;
  if (!rec || (!rec.title && !rec.valuation)) return null;
  const t = rec.title;
  const v = rec.valuation;
  const money = (n: number | null) => (n == null ? "—" : `$${n.toLocaleString()}`);
  // Two public records of the same house. When the advertised one is materially
  // bigger, something was built that the rating record hasn't caught up with —
  // which is what an undeclared addition looks like from the outside. It is NOT
  // called unconsented: no council file has been opened, and none can be.
  const floorArea = compareFloorArea({
    listingSqm: listing.floorAreaSqm,
    rollSqm: v?.floorAreaSqm ?? null,
    rollEffectiveDate: v?.effectiveDate ?? null,
  });

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="text-[11px] uppercase tracking-widest" style={{ color: "var(--brand)" }}>
          The public record
        </div>
        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>LINZ</div>
      </div>

      {t && (
        <div className="space-y-1.5 text-sm">
          <RecordRow label="Title type" value={t.type ?? "—"} bold />
          <RecordRow label="Record of Title" value={t.titleNo} />
          {t.estate && <RecordRow label="Estate" value={t.share ? `${t.estate} ${t.share}` : t.estate} />}
          {t.legalDescription && <RecordRow label="Legal description" value={t.legalDescription} />}
          {t.areaSqm != null && <RecordRow label="Title area" value={`${t.areaSqm.toLocaleString()} m²`} />}
        </div>
      )}

      {v && (
        <div className="mt-4 pt-3 space-y-1.5 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
            Rating valuation{v.effectiveDate ? ` · ${v.effectiveDate.slice(0, 10)}` : ""}
          </div>
          <RecordRow label="Capital value" value={money(v.capitalValue)} bold />
          <RecordRow label="Land value" value={money(v.landValue)} />
          <RecordRow label="Improvements" value={money(v.improvementsValue)} />
          {v.floorAreaSqm != null && <RecordRow label="Floor area" value={`${v.floorAreaSqm.toLocaleString()} m²`} />}
          {floorArea.status === "listing_larger" && (
            <div
              className="mt-2 rounded-lg p-3"
              style={{ background: "var(--warn-wash)", border: "1px solid var(--warn)" }}
            >
              <div className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                More house than the rating record knows about — {floorArea.differenceSqm}m² ({floorArea.differencePct}%)
              </div>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {floorArea.note}
              </p>
            </div>
          )}
          {v.landAreaSqm != null && <RecordRow label="Land area" value={`${v.landAreaSqm.toLocaleString()} m²`} />}
          {v.zoning && <RecordRow label="Zoning" value={v.zoning} />}
        </div>
      )}

      <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
        Sourced from Toitū Te Whenua LINZ under CC BY 4.0. A rating valuation is set for rates, not
        for sale — it is not a market appraisal and is often years old.
      </p>
    </div>
  );
}

/**
 * The items the analysis could not see.
 *
 * A listing photographs the kitchen, not the piles under the floor. Those items
 * used to be scored anyway — a foundation number inferred from a build year
 * carried the same 55 points as a roof somebody had actually photographed, and
 * the reader had no way to tell the two apart. They are now excluded from the
 * score and named here instead, with what they would have been worth, so the
 * gap is visible rather than papered over with a guess.
 */
function NotAssessed({ scored }: { scored: ScoreResult }) {
  const [open, setOpen] = useState(false);
  const share = scored.assessedPoints + scored.unassessedPoints;
  // Stated as how much WAS checked, not how much was missed. "15% of the points
  // available" read as though points had been withheld or were still to be won;
  // nothing is deducted for an unassessed item, it simply isn't in the maths.
  // "Based on 85% of what we'd normally check" says the same thing and tells the
  // reader what to do with it — the lower it is, the more a viewing will settle.
  const assessedPct = share > 0 ? Math.round((scored.assessedPoints / share) * 100) : 100;

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px dashed var(--border)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 text-left cursor-pointer"
      >
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Not assessed — not visible in the listing
          <span className="text-[11px] block" style={{ color: "var(--text-muted)" }}>
            {scored.unassessed.length} thing{scored.unassessed.length === 1 ? "" : "s"} couldn&apos;t be seen in the
            photos, so {scored.unassessed.length === 1 ? "it was" : "they were"} left out rather than guessed at. This
            score is based on {assessedPct}% of what we&apos;d normally check.
          </span>
        </span>
        <span className="text-xs mono flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }}>
          {open ? "hide" : "show"}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-1">
          {scored.unassessed.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3">
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {u.label} <span style={{ color: "var(--text-muted)" }}>· {u.category}</span>
              </span>
              <span className="text-xs mono flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                {u.points} pts
              </span>
            </div>
          ))}
          <p className="text-[11px] pt-1.5" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
            These need eyes on the property — a builder&apos;s report or an inspection. They are not counted for or
            against this house.
          </p>
        </div>
      )}
    </div>
  );
}
