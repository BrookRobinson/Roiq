// ============================================================
// The negotiation case — what a buyer can put to the agent.
//
// EVERYTHING HERE COMES OUT OF THE REPORT. No item, defect, figure or claim is
// invented: names, scores, urgency labels, observed defects, photo references
// and confidence tiers are copied from the analysis, and costs are the same
// Replace-Budget / tradie figures the Renovations tab shows. If the report
// didn't find it, this doesn't say it.
//
// That constraint is the point. A letter to an agent is a document someone will
// be held to in a negotiation, so an overstated defect or a made-up number is
// worse than no letter at all — it hands the other side a reason to dismiss the
// whole thing.
// ============================================================

import { costThreeTier } from "@/lib/reno-costing/three-tier";
import { valueImprovementItems } from "@/lib/scoring/improvement-values";
import { valueLand, roiqValuation } from "@/lib/scoring/valuation";
import { ITEM_BY_ID } from "@/lib/scoring/catalog";
import type { SubItem } from "@/lib/property-tab/types";
import type { StoredReport } from "@/lib/report-store";
import { dispositionFor } from "@/lib/viewing/status";
import type { ViewingState } from "@/lib/viewing/status";
import type { ChecklistItem } from "@/lib/viewing/checklist";

/** Same bands the report's own summary strip uses. */
export type Band = "critical" | "urgent";

export interface NegotiationItem {
  id: string;
  name: string;
  /** Where in the report it sits — improvements / land / legal. */
  area: string;
  band: Band;
  /** 1–10 condition score, exactly as assessed. */
  score: number;
  /** The report's own wording for that score. */
  urgencyLabel: string;
  /** What is actually visible in this property's photos, when the analysis said. */
  observedDefect?: string;
  /** Listing photo numbers the agent can go and look at. */
  photoRefs: number[];
  /** 1 = confirmed from photo, 2 = probable, 3 = not visible. Never hidden. */
  confidenceTier: number;
  evidenceSource: string;
  costLow: number;
  costHigh: number;
  /** The buyer stood in front of it and confirmed the finding. */
  confirmedOnSite?: boolean;
  /** What they wrote down when they did. Quoted verbatim; never paraphrased. */
  buyerNote?: string;
}

/** A specifically flagged remedy (consent, compliance, paperwork), kept separate from repairs. */
export interface NegotiationRemedy {
  id: string;
  name: string;
  area: string;
  description: string;
  costLow: number;
  costHigh: number;
}

/**
 * Where the advertised price sits against what the property is worth IN ITS
 * CURRENT CONDITION.
 *
 * This has to be established before any reduction is argued for, because the Tectara
 * valuation already has condition baked into it — improvement value is
 * replacement cost × spec tier × condition. A property that photographs badly
 * already values lower. So if the asking price is BELOW that figure, the vendor
 * has effectively priced the condition in, and claiming the repair total on top
 * is asking twice for the same money. An agent will see that immediately, and
 * the whole letter goes in the bin with it.
 */
export type PricePosition =
  | "above" // asking exceeds the valuation range — the repairs are the gap
  | "fair" // asking sits within it — condition is broadly priced in
  | "below" // asking is under it — already discounted for condition
  | "unknown"; // no land area or suburb comparables, so no valuation

export interface PriceCheck {
  position: PricePosition;
  bdrValue: number;
  low: number;
  high: number;
  askingPrice: number;
  /** Asking minus Tectara value. Positive = advertised above what it's worth as it stands. */
  aboveValueBy: number;
  isEstimate: boolean;
}

/**
 * The reduction being asked for — on every property, without exception.
 *
 * Every critical and urgent finding, plus the flagged compliance remedies, is
 * something the buyer would have to pay to put right, so every one of them
 * justifies money off. The headline is the UPPER end of the estimates: it's a
 * documented figure rather than an invented one, the schedule discloses the full
 * range beneath it, and it leaves somewhere to settle.
 *
 * The price position deliberately does NOT shrink this. Where a property is
 * already good value that is the BUYER'S information, shown to them in the app
 * and kept out of the letter — telling a vendor's agent "we think you're
 * under-priced" gives away the buyer's position for nothing.
 */
export interface ReductionAsk {
  /** Headline figure — the upper end of the documented estimates. */
  amount: number;
  low: number;
  high: number;
  itemCount: number;
  /** Share of the advertised price, so the ask can be seen for how modest it is. */
  pctOfAsking: number | null;
}

/**
 * A line the buyer settled at the viewing rather than the analysis settling it
 * from photographs. Two kinds, and the letter must not blur them: something they
 * saw, and something they were unable to see.
 */
export interface ViewingFinding {
  id: string;
  name: string;
  area: string;
  /** The buyer's own words. Left empty when they ticked the box and wrote nothing. */
  note?: string;
  /**
   * The report's own replacement-cost range, carried ONLY on items the buyer
   * confirmed at the property. Never on something nobody could inspect, and
   * never added into the reduction sought: the analysis did not grade these, so
   * the buyer's own read must not set the headline figure.
   */
  costLow?: number;
  costHigh?: number;
}

export interface ViewingOutcome {
  /** ISO date the buyer says they walked through it. The letter states this. */
  inspectedOn: string | null;
  /** Found on site, in the buyer's words — not a photo read. */
  confirmed: ViewingFinding[];
  /** Couldn't be reached, or the vendor hasn't produced it. Never costed. */
  notInspected: ViewingFinding[];
  /**
   * Items the report flagged that the buyer checked and found sound. They are
   * dropped from the case, and saying how many were dropped is the strongest
   * thing in the letter: it shows the remaining list survived a real inspection.
   */
  cleared: number;
}

export interface NegotiationCase {
  address: string;
  suburb: string | null;
  region: string | null;
  askingPrice: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floorAreaSqm: number | null;
  buildYear: number | null;
  listingUrl: string | null;

  reportId: string;
  reportDate: string;
  score: number;
  photosAnalysed: number;

  /** Null when the report lacks the land area or comparables to value it. */
  price: PriceCheck | null;
  /** Null only when there is nothing to ask for. */
  ask: ReductionAsk | null;

  critical: NegotiationItem[];
  urgent: NegotiationItem[];
  remedies: NegotiationRemedy[];

  repairsLow: number;
  repairsHigh: number;

  /** Items the analysis could not see well enough to score — stated, not glossed. */
  notAssessed: number;
  /** True if anything in the case is tier 2/3 rather than confirmed from a photo. */
  hasUnverified: boolean;

  /**
   * What the viewing settled. Null only on a case built without one, which the
   * app no longer allows — the "For the agent" tab stays locked until the
   * checklist is answered (components/Viewing/ViewingChecklist.tsx).
   */
  viewing: ViewingOutcome | null;
}

export const bandFor = (score: number): Band | null => (score <= 2 ? "critical" : score <= 4 ? "urgent" : null);

export const areaLabel = (id: string): string => {
  const inspection = ITEM_BY_ID[id]?.inspection;
  if (inspection === "improvements") return ITEM_BY_ID[id]?.category ?? "Building";
  if (inspection === "land") return "Land";
  if (inspection === "legal") return "Legal & title";
  if (inspection === "location") return "Location";
  return "Property";
};

/**
 * Cost for one item, the same way the Renovations tab derives it: the analysis's
 * own replacement-cost range where it gave one, otherwise a band around the
 * item's replacement-cost-new from the valuation. Priced at Replace-Budget with
 * a tradie doing the work, because that's the figure a vendor would recognise.
 */
function costFor(
  s: SubItem,
  rcnNew: number | undefined,
  ctx: { floorSqm: number | null; bedrooms: number | null }
): { low: number; high: number } {
  const low = s.estimatedReplacementCost?.low ?? Math.round((rcnNew ?? 0) * 0.8);
  const high = s.estimatedReplacementCost?.high ?? Math.round((rcnNew ?? 0) * 1.25);
  if (high <= 0) return { low: 0, high: 0 };

  const t = costThreeTier({
    id: s.id,
    name: s.name,
    category: ITEM_BY_ID[s.id]?.category,
    floorSqm: ctx.floorSqm,
    bedrooms: ctx.bedrooms,
    fallback: { low, high },
  });
  // The tier carries its own low/high spread; keep both ends rather than a point
  // estimate, so the letter never claims more precision than the model has.
  return {
    low: Math.round(t.budget.tradieTotal * 0.85),
    high: Math.round(t.budget.tradieTotal * 1.15),
  };
}

export function buildNegotiationCase(
  report: StoredReport,
  /** What the buyer recorded at the property. See lib/viewing/checklist.ts. */
  viewingState?: ViewingState,
  checklist?: ChecklistItem[],
  /**
   * The EFFECTIVE sub-items the report is displaying — verified documents applied,
   * and Tier 3 improvements stripped of their score. Pass them, or the letter
   * claims a condition score the report itself has withdrawn: a foundation the
   * analysis refused to grade would still reach the vendor as "4/10, $18,000".
   */
  effectiveSubItems?: SubItem[]
): NegotiationCase {
  const listing = report.listing;
  const subItems = effectiveSubItems ?? report.subItems ?? [];
  const ctx = { floorSqm: listing.floorAreaSqm ?? null, bedrooms: listing.bedrooms ?? null };

  const valuation = valueImprovementItems({
    subItems,
    floorAreaSqm: listing.floorAreaSqm,
    bathrooms: listing.bathrooms,
  });
  const rcnById = new Map(valuation.items.map((v) => [v.id, v.rcnNew]));

  const critical: NegotiationItem[] = [];
  const urgent: NegotiationItem[] = [];
  const remedies: NegotiationRemedy[] = [];

  const answers = viewingState?.answers ?? {};

  // What the buyer settled on site. Ordered the same way the checklist was, so
  // the letter reads in the order they walked the house.
  const confirmed: ViewingFinding[] = [];
  const notInspected: ViewingFinding[] = [];
  let cleared = 0;

  for (const s of subItems) {
    const answer = answers[s.id]?.answer;
    const buyerNote = answers[s.id]?.note;
    const band = s.score !== null ? bandFor(s.score) : null;
    const finding = (withCost = false): ViewingFinding => {
      const base = {
        id: s.id,
        name: s.name || ITEM_BY_ID[s.id]?.label || s.id,
        area: areaLabel(s.id),
        note: buyerNote,
      };
      if (!withCost) return base;
      const { low, high } = costFor(s, rcnById.get(s.id), ctx);
      return high > 0 ? { ...base, costLow: low, costHigh: high } : base;
    };

    // Flagged remedies are a different kind of claim — a specific job someone
    // identified, not a condition score — so they get their own section rather
    // than being folded in with the repairs. Handled BEFORE the disposition
    // switch, which returns early: an item the buyer couldn't reach still has
    // whatever compliance work the public record showed against it.
    //
    // Two answers remove a remedy. "Found it sound" — the buyer looked and there
    // is nothing to put right. And "couldn't inspect": asking a vendor for the
    // cost of a Certificate of Acceptance, on the same page that says the consent
    // position could not be established, is the contradiction an agent reads
    // first and the reason the rest of the letter stops being believed.
    if (s.remediation && answer !== "ok" && answer !== "no_access") {
      remedies.push({
        id: s.id,
        name: s.remediation.renovationLineItem,
        area: areaLabel(s.id),
        description: s.remediation.description,
        costLow: s.remediation.low,
        costHigh: s.remediation.high,
      });
    }

    // One rule, in lib/viewing/status.ts, so it can be verified in isolation.
    switch (dispositionFor(answer, band !== null)) {
      // Checked on site and found sound. The report's read is superseded by
      // someone who was actually there, so it is dropped rather than argued.
      case "drop":
        if (band) cleared++;
        continue;
      // They couldn't get to it. Stated as unverified and never costed — a
      // figure attached to something nobody could look at is the first thing an
      // agent pulls, and it takes the honest items down with it.
      case "unverified":
        notInspected.push(finding());
        continue;
      // A problem the analysis had no score for, because it never saw it. The
      // buyer's own observation, kept separate and labelled as theirs.
      case "observe":
        confirmed.push(finding(true));
        continue;
    }

    if (band) {
      const { low, high } = costFor(s, rcnById.get(s.id), ctx);
      const item: NegotiationItem = {
        id: s.id,
        name: s.name,
        area: areaLabel(s.id),
        band,
        score: s.score as number,
        urgencyLabel: s.urgencyLabel,
        observedDefect: s.observedDefect || undefined,
        photoRefs: s.photoReferences ?? [],
        confidenceTier: s.confidenceTier,
        evidenceSource: s.evidenceSource,
        costLow: low,
        costHigh: high,
        confirmedOnSite: answer === "problem" || undefined,
        buyerNote: answer === "problem" ? buyerNote : undefined,
      };
      (band === "critical" ? critical : urgent).push(item);
    }
  }

  // Checklist lines that aren't sub-items — the gaps the analysis flagged in its
  // own words ("west elevation not photographed"). They carry no score, so they
  // only ever reach the letter through what the buyer wrote about them.
  for (const c of checklist ?? []) {
    if (c.itemId) continue; // already handled with its sub-item above
    const rec = answers[c.key];
    if (!rec) continue;
    const finding: ViewingFinding = { id: c.key, name: c.label, area: c.group, note: rec.note };
    if (rec.answer === "problem") confirmed.push(finding);
    else if (rec.answer === "no_access") notInspected.push(finding);
  }

  const viewing: ViewingOutcome | null = viewingState
    ? { inspectedOn: viewingState.viewedOn, confirmed, notInspected, cleared }
    : null;

  // Price position FIRST — it decides whether a reduction can honestly be argued
  // for at all, and the valuation's own confidence band is the threshold rather
  // than an arbitrary percentage.
  let price: PriceCheck | null = null;
  const asking = listing.askingPrice ?? 0;
  const land = valueLand({ landAreaSqm: listing.landAreaSqm, suburbValue: report.suburbValue });
  if (asking > 0 && land) {
    const v = roiqValuation(valuation.buildingValue, land);
    price = {
      position: asking > v.high ? "above" : asking < v.low ? "below" : "fair",
      bdrValue: v.total,
      low: v.low,
      high: v.high,
      askingPrice: asking,
      aboveValueBy: Math.round(asking - v.total),
      isEstimate: v.isEstimate,
    };
  }

  // Worst first — that's the order the case is strongest in.
  const bySeverity = (a: NegotiationItem, b: NegotiationItem) => a.score - b.score || b.costHigh - a.costHigh;
  critical.sort(bySeverity);
  urgent.sort(bySeverity);

  const all = [...critical, ...urgent];
  const repairsLow = all.reduce((n, i) => n + i.costLow, 0) + remedies.reduce((n, r) => n + r.costLow, 0);
  const repairsHigh = all.reduce((n, i) => n + i.costHigh, 0) + remedies.reduce((n, r) => n + r.costHigh, 0);

  // Every critical and urgent item, plus the compliance remedies — all of it is
  // work the buyer would be paying for.
  const askLow = repairsLow;
  const askHigh = repairsHigh;
  const ask: ReductionAsk | null =
    askHigh > 0
      ? {
          amount: askHigh,
          low: askLow,
          high: askHigh,
          itemCount: critical.length + urgent.length + remedies.length,
          pctOfAsking: asking > 0 ? Math.round((askHigh / asking) * 1000) / 10 : null,
        }
      : null;

  return {
    address: listing.address ?? "",
    suburb: listing.suburb,
    region: listing.region ?? listing.city,
    askingPrice: listing.askingPrice,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    floorAreaSqm: listing.floorAreaSqm,
    buildYear: listing.buildYear,
    listingUrl: listing.url || null,

    reportId: report.id,
    reportDate: report.createdAt,
    score: Math.round(report.scores?.buyer?.base ?? 0),
    photosAnalysed: report.photosAnalysed ?? 0,

    price,
    ask,
    critical,
    urgent,
    remedies,
    repairsLow,
    repairsHigh,

    notAssessed: subItems.filter((s) => s.score === null).length,
    hasUnverified: all.some((i) => i.confidenceTier > 1 && !i.confirmedOnSite),

    viewing,
  };
}
