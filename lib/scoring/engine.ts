// ============================================================
// RoiQ SCORING ENGINE (v3.1)
// ============================================================

import { SCORING_MODEL, isTownContext, type ScoringSubItem, type Persona, type Inspection } from "./model";

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
}

export interface ExtraDwelling {
  type: string; // 'pole_shed' | 'sleepout' | 'minor_dwelling' | 'carport' | etc.
  conditionScore: number; // 1–10
  replacementCostMid: number; // NZD midpoint estimate
}

export interface InspectionScore {
  earned: number;
  max: number;
  pct: number;
}

export interface ScoreResult {
  total: number; // 0–1050
  base: number; // 0–1000 (normalised)
  dwellingBonus: number; // 0–50
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
    case "out_pool":
      return ctx.hasPool;
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

// 3 — Main scoring function. Re-run whenever the persona toggle changes.
export function scoreProperty(
  results: SubItemResult[],
  persona: Persona,
  ctx: PropertyContext,
  extraDwellings: ExtraDwelling[] = []
): ScoreResult {
  const resultMap = new Map(results.map((r) => [r.id, r]));
  let totalEarned = 0;
  let totalMax = 0;

  const byInspection: Record<Inspection, InspectionScore> = {
    improvements: { earned: 0, max: 0, pct: 0 },
    location: { earned: 0, max: 0, pct: 0 },
    land: { earned: 0, max: 0, pct: 0 },
    legal: { earned: 0, max: 0, pct: 0 },
  };
  const byCategory: Record<string, InspectionScore> = {};

  for (const item of SCORING_MODEL) {
    if (isTownContext(item.id)) continue; // town-wide context — shown in City/Town tab, not scored
    const applicable = resolveApplicable(item, ctx);
    if (!applicable) continue; // conditional item not present → drop from denominator

    const max = getMaxPoints(item, persona);
    const r = resultMap.get(item.id);

    // If the AI could not score it at all, treat as not contributing to either side.
    if (!r || r.score == null || r.score <= 0) continue;

    const earned = (r.score / 10) * max;
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

  // Extra dwellings — additive bonus, capped at 50
  const dwellingBonus = Math.min(
    50,
    Math.round(
      extraDwellings.reduce((sum, d) => {
        const conditionFactor = d.conditionScore / 10; // 0–1
        const valuePoints = d.replacementCostMid / 10000; // $10k = 1 pt at perfect condition
        return sum + valuePoints * conditionFactor;
      }, 0)
    )
  );

  const total = Math.min(1050, base + dwellingBonus);

  return { total, base, dwellingBonus, byInspection, byCategory };
}
