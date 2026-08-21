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
import { ITEM_BY_ID } from "@/lib/scoring/catalog";
import type { SubItem } from "@/lib/property-tab/types";
import type { StoredReport } from "@/lib/report-store";

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

  critical: NegotiationItem[];
  urgent: NegotiationItem[];
  remedies: NegotiationRemedy[];

  repairsLow: number;
  repairsHigh: number;

  /** Items the analysis could not see well enough to score — stated, not glossed. */
  notAssessed: number;
  /** True if anything in the case is tier 2/3 rather than confirmed from a photo. */
  hasUnverified: boolean;
}

const bandFor = (score: number): Band | null => (score <= 2 ? "critical" : score <= 4 ? "urgent" : null);

const areaLabel = (id: string): string => {
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

export function buildNegotiationCase(report: StoredReport): NegotiationCase {
  const listing = report.listing;
  const subItems = report.subItems ?? [];
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

  for (const s of subItems) {
    const band = s.score !== null ? bandFor(s.score) : null;
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
      };
      (band === "critical" ? critical : urgent).push(item);
    }

    // Flagged remedies are a different kind of claim — a specific job someone
    // identified, not a condition score — so they get their own section rather
    // than being folded in with the repairs.
    if (s.remediation) {
      remedies.push({
        id: s.id,
        name: s.remediation.renovationLineItem,
        area: areaLabel(s.id),
        description: s.remediation.description,
        costLow: s.remediation.low,
        costHigh: s.remediation.high,
      });
    }
  }

  // Worst first — that's the order the case is strongest in.
  const bySeverity = (a: NegotiationItem, b: NegotiationItem) => a.score - b.score || b.costHigh - a.costHigh;
  critical.sort(bySeverity);
  urgent.sort(bySeverity);

  const all = [...critical, ...urgent];
  const repairsLow = all.reduce((n, i) => n + i.costLow, 0) + remedies.reduce((n, r) => n + r.costLow, 0);
  const repairsHigh = all.reduce((n, i) => n + i.costHigh, 0) + remedies.reduce((n, r) => n + r.costHigh, 0);

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

    critical,
    urgent,
    remedies,
    repairsLow,
    repairsHigh,

    notAssessed: subItems.filter((s) => s.score === null).length,
    hasUnverified: all.some((i) => i.confidenceTier > 1),
  };
}
