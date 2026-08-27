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
import { methodFor, comparablesMatch, type ValuationMethod } from "./valuation-method";
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
  /** LINZ's tenure. The thing that decides whether there is land to value. */
  titleType?: string | null;
  /** The portal's label — weak evidence, used only where tenure is silent. */
  propertyType?: string | null;
}

export interface PropertyValue extends RoiqValuation {
  /** Depreciated value of the main building, before any extra dwelling. */
  mainBuildingValue: number;
  /** Sleepout, minor dwelling and the like — depreciated, less compliance work. */
  extraDwellingValue: number;
  /** Which method produced this. The report says so; a figure with no stated
   *  method is a figure the reader can't argue with. */
  method: ValuationMethod;
  /**
   * Set when the figure is what a TYPICAL property of this type and size
   * fetches, with no adjustment for how this one presents.
   *
   * The condition read still exists and the report shows it — what doesn't
   * exist yet is any evidence for how many dollars a condition point is worth
   * in an apartment market, and inventing a multiplier for it is the thing this
   * codebase keeps having to undo. Until real sales say otherwise, the number
   * is sourced and the caveat is printed.
   */
  typicalForType?: boolean;
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
  const method = methodFor({
    propertyType: input.propertyType,
    titleType: input.titleType,
    floorAreaSqm: input.floorAreaSqm,
    landAreaSqm: input.landAreaSqm,
  });

  if (method === "floor-area-comparables") return valueByFloorArea(input, method);
  // Bare land is deliberately withheld — the land rate is stretched well past
  // what it was built from, and on a land report that IS the whole answer.
  if (method !== "land-and-building") return null;

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
    method,
  };
}

/**
 * An apartment, a unit, or anything on a title that gives its owner no section
 * of their own.
 *
 * The method is the one the market itself uses: what comparable sales of this
 * type fetch per square metre of floor area, times this property's floor area.
 * There is no land term because there is no land to add — that is the whole
 * reason the house method returns nothing here.
 *
 * The comparables must be for the RIGHT TYPE. A suburb median built from house
 * sales says nothing about what an apartment fetches in the same street, and
 * reaching for it because it was the figure to hand is how the map ended up
 * valuing a 342m² West Coast building at $1.17m. `comparablesMatch` refuses it.
 *
 * NO CONDITION MULTIPLIER IS APPLIED, and that is deliberate. We can see the
 * condition — that is the product — but nobody has yet measured what a
 * condition point is worth per square metre in an apartment market, and picking
 * one would be the same invented staircase this codebase has already had to
 * delete once. So the figure says what a typical apartment of this size fetches
 * around here, `typicalForType` is set, and the report prints the caveat.
 */
function valueByFloorArea(input: PropertyValueInput, method: ValuationMethod): PropertyValue | null {
  const floor = input.floorAreaSqm ?? 0;
  const sv = input.suburbValue;
  if (floor <= 0 || !sv?.medianPerSqm) return null;
  if (!comparablesMatch(input.propertyType, sv.propertyType)) return null;

  const total = Math.round(sv.medianPerSqm * floor);
  if (total <= 0) return null;

  const rv = roiqValuation(total, { landValue: 0, ratePerSqm: 0, landAreaSqm: 0, isEstimate: true });
  return {
    ...rv,
    mainBuildingValue: total,
    extraDwellingValue: 0,
    method,
    typicalForType: true,
  };
}
