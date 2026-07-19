// ============================================================
// RoiQ IMPROVEMENT (BUILDING) VALUATION — v4, slice 1
//
// Values the building on TWO axes, because condition alone is not enough:
//   • SPEC   — quality of the materials/finish (a tiled bathroom is worth more
//              than a vinyl one, even at the same condition). Sets the "as-new" rate.
//   • CONDITION — how much life is left (the 1–10 score). Depreciates that rate.
//
//   building $/m² = BASE_BUILD_RATE × spec multiplier × condition factor
//   building value = building $/m² × floor area   (capped at the suburb ceiling)
//
// Constants are deliberately explicit and tunable — they get calibrated against
// real comparable sales in Phase 2. The STRUCTURE (two axes) is the point here.
// ============================================================

import { SCORING_MODEL } from "./model";
import type { SuburbValue } from "./investment";
import type { SpecTier, SubItem } from "@/lib/property-tab/types";

/** Reference NZ build cost per m² at the 1.0× baseline (between dated and modern), average condition. Tunable. */
export const BASE_BUILD_RATE = 2600;

/** How much each spec tier moves the as-new rate. Tunable (calibrate vs sales in Phase 2). */
export const SPEC_MULTIPLIER: Record<SpecTier, number> = {
  deteriorated: 0.55, // absent / broken / needs full replacement — adds little building value
  dated: 0.9, // updated once, now old-fashioned
  modern: 1.2, // updated / contemporary — tiling, stone-look, good flooring, modern fittings
  luxury: 1.6, // clearly high-end — natural stone, designer/architectural
};

/** Neutral fallback when the AI didn't return a spec tier (don't reward or penalise). */
const DEFAULT_SPEC_MULT = 1.0;

const SPEC_ORDER: SpecTier[] = ["deteriorated", "dated", "modern", "luxury"];

/** Building elements the AI assesses that carry material spec (the value-bearing ones). */
const improvementWeight = new Map(
  SCORING_MODEL.filter((i) => i.inspection === "improvements").map((i) => [i.id, i.buyerPoints])
);

/** 1–10 condition → depreciation factor. New (10) keeps ~all value; poor (1) keeps ~a third. */
export function conditionFactor(score0to10: number): number {
  const s = Math.max(0, Math.min(10, score0to10));
  return Math.round((0.3 + 0.07 * s) * 100) / 100; // 10→1.0, 5→0.65, 1→0.37
}

/** Nearest spec tier to a numeric multiplier (for reporting the blended overall spec). */
function tierFromMultiplier(mult: number): SpecTier {
  let best: SpecTier = "modern";
  let bestDiff = Infinity;
  for (const t of SPEC_ORDER) {
    const d = Math.abs(SPEC_MULTIPLIER[t] - mult);
    if (d < bestDiff) { bestDiff = d; best = t; }
  }
  return best;
}

export interface ImprovementValuation {
  buildingValue: number; // depreciated building value, NZD
  ratePerSqm: number; // effective building $/m² after spec + condition
  floorAreaSqm: number;
  overallSpec: SpecTier; // blended spec tier across the building
  specMultiplier: number; // blended spec multiplier
  conditionFactor: number; // blended depreciation factor
  cappedBySuburb: boolean; // true when the suburb ceiling clipped an over-capitalised spec
}

/**
 * Value the improvements from the assessed sub-items + floor area.
 * `suburbCeilingRatePerSqm` (optional) caps the building rate so a luxury fit-out in a
 * modest suburb doesn't add luxury VALUE (over-capitalisation).
 */
export function valueImprovements(args: {
  subItems: SubItem[];
  floorAreaSqm: number | null;
  suburbCeilingRatePerSqm?: number | null;
}): ImprovementValuation | null {
  const floor = args.floorAreaSqm ?? 0;
  if (floor <= 0) return null;

  let wSpec = 0;
  let wCond = 0;
  let wTotal = 0;
  for (const s of args.subItems) {
    const weight = improvementWeight.get(s.id);
    if (!weight) continue; // not a value-bearing building element
    const specMult = s.specTier ? SPEC_MULTIPLIER[s.specTier] : DEFAULT_SPEC_MULT;
    const cond = s.score ?? 6; // unscored → assume fair
    wSpec += weight * specMult;
    wCond += weight * cond;
    wTotal += weight;
  }
  if (wTotal === 0) return null;

  const specMultiplier = wSpec / wTotal;
  const overallCondition = wCond / wTotal; // 0–10
  const condFactor = conditionFactor(overallCondition);

  let ratePerSqm = BASE_BUILD_RATE * specMultiplier * condFactor;
  let cappedBySuburb = false;
  const ceiling = args.suburbCeilingRatePerSqm ?? null;
  if (ceiling && ratePerSqm > ceiling) {
    ratePerSqm = ceiling;
    cappedBySuburb = true;
  }

  return {
    buildingValue: Math.round(ratePerSqm * floor),
    ratePerSqm: Math.round(ratePerSqm),
    floorAreaSqm: floor,
    overallSpec: tierFromMultiplier(specMultiplier),
    specMultiplier: Math.round(specMultiplier * 100) / 100,
    conditionFactor: condFactor,
    cappedBySuburb,
  };
}

// ── Land value (interim estimate — Phase 2 swaps in a real sold-sales feed) ────

/** Typical NZ house section, used to turn a suburb's typical land value into a rate. Tunable. */
export const TYPICAL_SECTION_SQM = 550;
/** The condition we assume a "typical" suburb home is in, when extracting land value. */
const TYPICAL_CONDITION = 7;

/** Diminishing land value with size — the first ~500m² carry most of the value. */
function sizeAdjustedArea(area: number): number {
  const base = Math.min(area, 500);
  const extra = Math.max(0, area - 500);
  return base + extra * 0.4;
}

export interface LandValuation {
  landValue: number;
  ratePerSqm: number; // effective $/m² of land after the size curve
  landAreaSqm: number;
  isEstimate: boolean; // true until a real land/sales feed anchors it
}

/**
 * Interim land value: extract a typical land value from suburb comps
 * (typical total − typical building), express it as a land rate over a typical
 * section, then apply it to THIS property's land area with a diminishing-size curve.
 * Deliberately flagged isEstimate — Phase 2 replaces it with real land/sold-sales data.
 */
export function valueLand(args: {
  landAreaSqm: number | null;
  suburbValue?: SuburbValue | null;
}): LandValuation | null {
  const land = args.landAreaSqm ?? 0;
  const sv = args.suburbValue;
  if (land <= 0 || !sv || !sv.medianPerSqm) return null;
  const typicalFloor = sv.medianFloorArea ?? 150;
  const typicalTotal = sv.medianSalePrice ?? sv.medianPerSqm * typicalFloor;
  const typicalBuilding = BASE_BUILD_RATE * conditionFactor(TYPICAL_CONDITION) * typicalFloor;
  const typicalLand = Math.max(0, typicalTotal - typicalBuilding);
  const rate = typicalLand / sizeAdjustedArea(TYPICAL_SECTION_SQM);
  const landValue = Math.round(rate * sizeAdjustedArea(land));
  return { landValue, ratePerSqm: Math.round(landValue / land), landAreaSqm: land, isEstimate: true };
}

export interface RoiqValuation {
  landValue: number;
  buildingValue: number;
  total: number;
  low: number;
  high: number;
  isEstimate: boolean;
}

/** Land + improvements = RoiQ value, with a confidence band. Takes the building
 * value as a plain number so it works with the itemised valuation (v5.1). */
export function roiqValuation(
  buildingValue: number,
  land: LandValuation,
  band = 0.12
): RoiqValuation {
  const total = buildingValue + land.landValue;
  return {
    landValue: land.landValue,
    buildingValue,
    total,
    low: Math.round(total * (1 - band)),
    high: Math.round(total * (1 + band)),
    isEstimate: land.isEstimate,
  };
}
