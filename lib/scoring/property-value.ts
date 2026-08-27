// ============================================================
// THE Tectara valuation. One property, one number, one place it comes from.
//
// There used to be two. The report added an itemised building value to a land
// value; the map multiplied a suburb $/m² by a condition factor and the floor
// area, with no land term in it at all. Same house, two answers — 230 Sewell
// Street came out at $697,648 in the report and $657,233 on the map, and a
// buyer clicking from a pin into the report saw both with no explanation. On an
// unusual property the gap was far worse: 75 Revell Street has a 342m² building
// on the West Coast, and the map's floor-area-only method valued it at $1.17m
// against a $659,000 asking price, because nothing in that formula knows that
// $/m² falls as a building gets bigger.
//
// The map's method is gone. A pin carries the report's valuation or it carries
// no valuation at all — there is no second opinion to reconcile, and a pin
// without a report has never had a number and still doesn't.
//
// Pure and dependency-light on purpose: the report view, the map contribution
// and the server-side pin write all call THIS, so they cannot drift apart again.
// ============================================================

import { valueImprovementItems } from "./improvement-values";
import { valueExtraDwellings } from "./extra-dwelling-value";
import { valueLand, roiqValuation, type RoiqValuation } from "./valuation";
import type { SuburbValue } from "./investment";
import type { SubItem } from "@/lib/property-tab/types";
import type { ExtraDwelling } from "@/lib/property-tab/types";

export interface PropertyValueInput {
  /**
   * The report's sub-items. The report view passes its EFFECTIVE items — the
   * ones after anything it has withdrawn or a viewing photo has re-graded —
   * because a valuation must not claim a condition the report itself no longer
   * stands behind. The map contribution passes the raw ones, which is right:
   * a pin records what the analysis said when it was made, and nobody had been
   * to the property yet.
   */
  subItems: SubItem[];
  floorAreaSqm: number | null;
  bathrooms?: number | null;
  landAreaSqm: number | null;
  extraDwellings?: ExtraDwelling[];
  suburbValue?: SuburbValue | null;
}

export interface PropertyValue extends RoiqValuation {
  /** Depreciated value of the main building, before any extra dwelling. */
  mainBuildingValue: number;
  /** Sleepout, minor dwelling and the like — depreciated, less compliance work. */
  extraDwellingValue: number;
}

/**
 * Land + improvements, or null when we can't stand behind either half.
 *
 * Null is a real answer and the only honest one when an input is missing: no
 * floor area means no building to value, and no land area or no suburb comps
 * means no land to value. Returning a partial total would publish half a house
 * as a whole one.
 */
export function valueProperty(input: PropertyValueInput): PropertyValue | null {
  const improvements = valueImprovementItems({
    subItems: input.subItems,
    floorAreaSqm: input.floorAreaSqm,
    bathrooms: input.bathrooms,
  });
  const land = valueLand({ landAreaSqm: input.landAreaSqm, suburbValue: input.suburbValue });

  // Both halves are required. A building with no land under it, or land with an
  // unvalued house on it, is not a property valuation.
  if (!land || !improvements || improvements.buildingValue <= 0) return null;

  const extra = input.extraDwellings?.length
    ? valueExtraDwellings(input.extraDwellings).addedValue
    : 0;

  const rv = roiqValuation(improvements.buildingValue + extra, land);
  return {
    ...rv,
    mainBuildingValue: improvements.buildingValue,
    extraDwellingValue: extra,
  };
}
