// ============================================================
// Tectara — shared valuation constants and the LAND value.
//
// The building is valued in improvement-values.ts, item by item. What lives
// here is what both halves share: the spec multipliers (what a finish costs to
// build NEW), the reference build rate the land extraction leans on, and the
// land estimate itself. The old whole-building rate × spec × condition-factor
// valuation (valueImprovements) is gone — it had no callers and guessed an
// unscored item at "fair".
// ============================================================

import type { SuburbValue } from "./investment";
import type { SpecTier } from "@/lib/property-tab/types";

/** Reference NZ build cost per m² at the 1.0× baseline (between dated and modern), average condition. Tunable. */
export const BASE_BUILD_RATE = 2600;

/** How much each spec tier moves the as-new rate. Tunable (calibrate vs sales in Phase 2). */
export const SPEC_MULTIPLIER: Record<SpecTier, number> = {
  deteriorated: 0.55, // absent / broken / needs full replacement — adds little building value
  dated: 0.9, // updated once, now old-fashioned
  modern: 1.2, // updated / contemporary — tiling, stone-look, good flooring, modern fittings
  luxury: 1.6, // clearly high-end — natural stone, designer/architectural
};

/** 1–10 condition → depreciation factor. New (10) keeps ~all value; poor (1) keeps ~a third. */
export function conditionFactor(score0to10: number): number {
  const s = Math.max(0, Math.min(10, score0to10));
  return Math.round((0.3 + 0.07 * s) * 100) / 100; // 10→1.0, 5→0.65, 1→0.37
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

/** Land + improvements = Tectara value, with a confidence band. Takes the building
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
