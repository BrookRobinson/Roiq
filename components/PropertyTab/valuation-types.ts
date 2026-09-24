// One type for "a valuation, or the reason there isn't one", so the card, the
// accordion and the tab don't each import four names from two modules.

import type { RoofValuation, RoofWithheldResult } from "@/lib/scoring/roof-value";
import type { GenericItemValuation, ItemWithheldResult } from "@/lib/scoring/item-value";

export type AnyValuation =
  | RoofValuation
  | GenericItemValuation
  | RoofWithheldResult
  | ItemWithheldResult;

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
