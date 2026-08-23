// ============================================================
// Tectara SCORING ENGINE (v4)
// Condition & Quality Score = BASE (0–1000, the property itself)
//                             − location penalties (capped)
//                             + on-site value-add bonuses (capped)
// ============================================================

import {
  SCORING_MODEL,
  isFactsOnly,
  tierBandFraction,
  LOCATION_PENALTIES,
  PENALTY_CAP,
  BONUS_CAP,
  type ScoringSubItem,
  type Persona,
  type Inspection,
} from "./model";
import type { SpecTier } from "@/lib/property-tab/types";
import { DEV_TIERS, developmentBonus, type DevTier } from "./development";

export interface PropertyContext {
  titleType: "freehold" | "cross_lease" | "unit_title" | "leasehold" | "unknown";
  hasChimney: boolean;
  hasSolar: boolean;
  hasRetainingWalls: boolean;
  hasPool: boolean;
  hasBodyCorporate: boolean;
}

export interface SubItemResult {
  id: string;
  score: number; // 1–10 from the AI (0 or null = not scored / not applicable)
  applicable: boolean; // resolved at runtime from PropertyContext
  specTier?: SpecTier; // Improvements (v5) — the tier sets the points band; condition positions within it
  /**
   * 1 confirmed from photo · 2 probable · 3 not visible.
   *
   * Tier 3 does not score. See scoreProperty(): the model is stating it could
   * not see the thing, and a number derived from a build year must not carry
   * the same weight as a roof somebody photographed.
   */
  confidenceTier?: 1 | 2 | 3;
}

export interface ExtraDwelling {
  type: string; // 'pole_shed' | 'sleepout' | 'minor_dwelling' | 'carport' | etc.
  conditionScore: number; // 1–10
  replacementCostMid: number; // NZD midpoint estimate
}

/** One objective location negative, as detected for THIS address. severity 0–10. */
export interface PenaltyInput {
  id: string; // matches a LOCATION_PENALTIES id
  severity: number; // 0 = not present, 10 = full severity
  note?: string; // human-readable reason (e.g. "within airport noise contour ~1.2km")
}

export interface InspectionScore {
  earned: number;
  max: number;
  pct: number;
}

/** An itemised adjustment to the base. points < 0 for a penalty, > 0 for a bonus. */
export interface ScoreAdjustment {
  id: string;
  label: string;
  points: number;
  note?: string;
}

/** An item the analysis could not actually see, and what it would have been worth. */
export interface UnassessedItem {
  id: string;
  label: string;
  points: number;
  category: string;
}

export interface ScoreResult {
  total: number; // 0–1060 (base − penalties + bonuses, floored at 0)
  base: number; // 0–1000 (normalised property quality)
  /**
   * What the score is actually built on. `assessedPoints` is the denominator
   * that survived; `unassessed` is everything dropped for not being visible.
   * The report shows both — a score out of what could be seen is honest only
   * if the reader is told how much that was.
   */
  assessedPoints: number;
  unassessedPoints: number;
  unassessed: UnassessedItem[];
  penalties: ScoreAdjustment[]; // itemised, points negative
  penaltyTotal: number; // capped total deducted (positive number)
  bonuses: ScoreAdjustment[]; // itemised, points positive
  bonusTotal: number; // capped total added
  byInspection: Record<Inspection, InspectionScore>;
  byCategory: Record<string, InspectionScore>;
}

// 1 — Resolve whether a conditional item applies to THIS property
export function resolveApplicable(item: ScoringSubItem, ctx: PropertyContext): boolean {
  if (!item.conditional) return true;
  switch (item.id) {
    case "ext_chimney":
      return ctx.hasChimney;
    case "ext_solar":
      return ctx.hasSolar;
    case "out_retaining":
      return ctx.hasRetainingWalls;
    case "leg_bodycorp":
      return ctx.hasBodyCorporate || ctx.titleType === "unit_title";
    case "leg_crosslease":
      return ctx.titleType === "cross_lease";
    default:
      return true;
  }
}

// 2 — Get the max points for an item under the active persona
export function getMaxPoints(item: ScoringSubItem, persona: Persona): number {
  return persona === "investor" ? item.investorPoints : item.buyerPoints;
}

const ITEM_BY_ID = new Map(SCORING_MODEL.map((i) => [i.id, i]));

/**
 * Points an Improvements item earns for the active persona — for the per-card
 * "Dated · 4/13" display. Mirrors the engine: tiered → band positioned by
 * condition; untiered-but-scored → condition × max; otherwise not applicable.
 */
export function improvementItemPoints(
  id: string,
  tier: SpecTier | undefined,
  condition: number | null,
  persona: Persona
): { earned: number; max: number } | null {
  const item = ITEM_BY_ID.get(id);
  if (!item || item.inspection !== "improvements") return null;
  const max = getMaxPoints(item, persona);
  if (tier) return { earned: Math.round(max * tierBandFraction(tier, condition ?? 1)), max };
  if (condition != null && condition > 0) return { earned: Math.round((condition / 10) * max), max };
  return null;
}

const clamp10 = (n: number): number => Math.max(0, Math.min(10, n));

// 3 — Main scoring function. Re-run whenever the persona toggle changes.
export function scoreProperty(
  results: SubItemResult[],
  persona: Persona,
  ctx: PropertyContext,
  extraDwellings: ExtraDwelling[] = [],
  penalties: PenaltyInput[] = [],
  developmentTier: DevTier = "none"
): ScoreResult {
  const resultMap = new Map(results.map((r) => [r.id, r]));
  let totalEarned = 0;
  let totalMax = 0;
  const unassessed: UnassessedItem[] = [];
  let unassessedPoints = 0;

  const byInspection: Record<Inspection, InspectionScore> = {
    improvements: { earned: 0, max: 0, pct: 0 },
    location: { earned: 0, max: 0, pct: 0 },
    land: { earned: 0, max: 0, pct: 0 },
    legal: { earned: 0, max: 0, pct: 0 },
  };
  const byCategory: Record<string, InspectionScore> = {};

  for (const item of SCORING_MODEL) {
    if (isFactsOnly(item.id)) continue; // location — shown as facts, not scored
    const applicable = resolveApplicable(item, ctx);
    if (!applicable) continue; // conditional item not present → drop from denominator

    const max = getMaxPoints(item, persona);
    const r = resultMap.get(item.id);

    // The model said it could not see this. Nobody can read the piles under a
    // house from a listing photo, and a foundation "score" inferred from a
    // build year is not an assessment — it is a guess wearing the same badge
    // as the roof somebody actually photographed. It is dropped from BOTH
    // sides of the fraction and reported as an unknown instead, so the score
    // means "of what could be seen, this is how it rates".
    if (r?.confidenceTier === 3) {
      unassessed.push({ id: item.id, label: item.label, points: max, category: item.category });
      unassessedPoints += max;
      continue;
    }

    // Earned points:
    //  • Improvements (v5) — the spec TIER sets a capped band, condition positions
    //    within it. A tiered item counts even at low condition, so a "deteriorated"
    //    item genuinely drags the score down (band floor, not dropped).
    //  • Everything else — the 1–10 condition scaled across the item's max points.
    //  • Genuinely un-assessed (no tier, no score) → drop from both numerator and
    //    denominator so a missing photo doesn't punish the property.
    let earned: number;
    if (item.inspection === "improvements" && r?.specTier) {
      earned = max * tierBandFraction(r.specTier, r.score ?? 1);
    } else if (r && r.score != null && r.score > 0) {
      earned = (r.score / 10) * max;
    } else {
      continue;
    }
    totalEarned += earned;
    totalMax += max;

    byInspection[item.inspection].earned += earned;
    byInspection[item.inspection].max += max;

    const catKey = `${item.inspection}:${item.category}`;
    if (!byCategory[catKey]) byCategory[catKey] = { earned: 0, max: 0, pct: 0 };
    byCategory[catKey].earned += earned;
    byCategory[catKey].max += max;
  }

  // Normalise base score back to 1000 across applicable+scored items
  const base = totalMax > 0 ? Math.round((totalEarned / totalMax) * 1000) : 0;
  const assessedPoints = Math.round(totalMax);

  // Fill percentages for UI bars
  (Object.keys(byInspection) as Inspection[]).forEach((k) => {
    const v = byInspection[k];
    v.pct = v.max > 0 ? Math.round((v.earned / v.max) * 100) : 0;
    v.earned = Math.round(v.earned);
  });
  Object.keys(byCategory).forEach((k) => {
    const v = byCategory[k];
    v.pct = v.max > 0 ? Math.round((v.earned / v.max) * 100) : 0;
    v.earned = Math.round(v.earned);
  });

  // Location penalties — subtract only, scaled by severity, capped
  const penMap = new Map(penalties.map((p) => [p.id, p]));
  const penaltyList: ScoreAdjustment[] = [];
  for (const p of LOCATION_PENALTIES) {
    const inp = penMap.get(p.id);
    const sev = clamp10(inp?.severity ?? 0);
    if (sev <= 0) continue;
    const pts = Math.round((sev / 10) * p.maxDeduction);
    if (pts <= 0) continue;
    penaltyList.push({ id: p.id, label: p.label, points: -pts, note: inp?.note });
  }
  const rawPenalty = penaltyList.reduce((s, a) => s - a.points, 0); // points are negative
  const penaltyTotal = Math.min(PENALTY_CAP, rawPenalty);

  // On-site value-adds — add only, scaled by condition, capped.
  // NOTE: extra dwellings are NOT a bonus here — they carry their own capped
  // VALUE only (lib/scoring/extra-dwelling-value.ts) — never points, so the score
  // stays a clean, comparable /1000 for every property.
  const bonusList: ScoreAdjustment[] = [];
  // Development potential — a persona-weighted opportunity (add a dwelling / subdivide).
  const devPts = developmentBonus(developmentTier, persona);
  if (devPts > 0) {
    bonusList.push({ id: "bonus_development", label: `Development potential — ${DEV_TIERS[developmentTier].short}`, points: devPts });
  }
  const rawBonus = bonusList.reduce((s, a) => s + a.points, 0);
  const bonusTotal = Math.min(BONUS_CAP, rawBonus);

  const total = Math.max(0, base - penaltyTotal + bonusTotal);

  return {
    total,
    base,
    assessedPoints,
    unassessedPoints,
    unassessed,
    penalties: penaltyList,
    penaltyTotal,
    bonuses: bonusList,
    bonusTotal,
    byInspection,
    byCategory,
  };
}
