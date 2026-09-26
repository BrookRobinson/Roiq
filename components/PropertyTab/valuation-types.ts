// One type for "a valuation, or the reason there isn't one", so the card, the
// accordion and the tab don't each import four names from two modules.

import type { RoofValuation, RoofWithheldResult } from "@/lib/scoring/roof-value";
import type { GenericItemValuation, ItemWithheldResult } from "@/lib/scoring/item-value";

/**
 * A per-bathroom item in a house with several bathrooms: one seven-step
 * valuation per bathroom that was seen, summed. `life` and `action` are the
 * worst bathroom's (the action's cost is every bathroom's work added up), so
 * the card's summary line reads the same fields it reads for any item.
 */
export interface PerBathroomValuation {
  kind: "per-bathroom";
  parts: { bathroom: string; condition: number; photoReferences: number[]; valuation: GenericItemValuation }[];
  /** Bathrooms no photo shows — estimated from the rest of the house, not valued here. */
  unseen: string[];
  valueNZD: number;
  cost: { totalNZD: number };
  life: GenericItemValuation["life"];
  action: GenericItemValuation["action"];
}

export type AnyValuation =
  | RoofValuation
  | GenericItemValuation
  | PerBathroomValuation
  | RoofWithheldResult
  | ItemWithheldResult;

export const isPerBathroom = (v: AnyValuation): v is PerBathroomValuation =>
  (v as PerBathroomValuation).kind === "per-bathroom";

/**
 * Did we end up with a valuation, or a reason there isn't one?
 *
 * One predicate rather than calling both modules' guards and narrowing twice —
 * `withheld` is the discriminant on both refusal shapes, and checking for it
 * directly is what the two guards each do anyway.
 */
export const isRefused = (
  v: AnyValuation
): v is RoofWithheldResult | ItemWithheldResult => "withheld" in v;
