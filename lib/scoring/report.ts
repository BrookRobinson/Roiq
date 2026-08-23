// ============================================================
// Tectara scoring bridge (v3.1)
// Pure helpers that turn the persona-independent assessment into
// engine inputs and both persona ScoreResults. Used on the server
// (report generation) AND the client (instant re-score on toggle).
// ============================================================

import {
  scoreProperty,
  type PropertyContext,
  type ScoreResult,
  type SubItemResult,
  type ExtraDwelling as EngineExtraDwelling,
  type PenaltyInput,
} from "./engine";
import type { Persona } from "./model";
import { buildCatalog } from "./catalog";
import type { DevTier } from "./development";
import type { SubItem, ExtraDwelling, Category } from "@/lib/property-tab/types";

/** Persona-independent assessment that fully determines both persona scores. */
export interface Assessment {
  subItems: SubItem[]; // rich AI assessments keyed by v4 sub-item id
  extraDwellings: ExtraDwelling[];
  context: PropertyContext;
  penalties?: PenaltyInput[]; // objective location negatives (persona-independent)
  developmentTier?: DevTier; // add-a-dwelling opportunity (persona-weighted bonus)
}

/** Raw 1–10 scores + spec tiers the engine consumes (persona-independent). */
export function toResults(subItems: SubItem[]): SubItemResult[] {
  // confidenceTier travels with the score: the engine refuses to score an item
  // the analysis admits it could not see, and it can only do that if it knows.
  return subItems.map((s) => ({
    id: s.id,
    score: s.score ?? 0,
    specTier: s.specTier,
    applicable: true,
    confidenceTier: s.confidenceTier,
  }));
}

/** Rich extra dwellings → the engine's minimal {conditionScore, replacementCostMid}. */
export function toEngineDwellings(dwellings: ExtraDwelling[]): EngineExtraDwelling[] {
  return dwellings.map((d) => ({
    type: d.type,
    conditionScore: d.score,
    replacementCostMid: (d.estimatedReplacementCost.low + d.estimatedReplacementCost.high) / 2,
  }));
}

/** Score one persona from an assessment. */
export function scoreFor(assessment: Assessment, persona: Persona): ScoreResult {
  return scoreProperty(
    toResults(assessment.subItems),
    persona,
    assessment.context,
    toEngineDwellings(assessment.extraDwellings),
    assessment.penalties ?? [],
    assessment.developmentTier ?? "none"
  );
}

/** Both persona scores, computed once from the same raw assessment. */
export function scoreBoth(assessment: Assessment): { buyer: ScoreResult; investor: ScoreResult } {
  return { buyer: scoreFor(assessment, "buyer"), investor: scoreFor(assessment, "investor") };
}

/**
 * Group the Improvements sub-items into the rich Category[] shape the existing
 * PropertyTab accordion UI renders. Preserves model category order; weight is
 * unused by the v3.1 display so it is left at 0.
 */
export function improvementsCategories(subItems: SubItem[]): Category[] {
  const insp = buildCatalog().find((i) => i.inspection === "improvements");
  if (!insp) return [];
  const byId = new Map(subItems.map((s) => [s.id, s]));
  const cats: Category[] = [];
  for (const cat of insp.categories) {
    const items = cat.items.map((it) => byId.get(it.id)).filter((s): s is SubItem => Boolean(s));
    if (items.length === 0) continue;
    cats.push({ id: cat.category, name: cat.category, icon: cat.icon, weight: 0, subItems: items });
  }
  return cats;
}
