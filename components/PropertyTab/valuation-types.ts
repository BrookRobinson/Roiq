// One type for "a valuation, or the reason there isn't one", so the card, the
// accordion and the tab don't each import four names from two modules.

import type { RoofValuation, RoofWithheldResult } from "@/lib/scoring/roof-value";
import type { GenericItemValuation, ItemWithheldResult } from "@/lib/scoring/item-value";

/**
 * An item read room by room — several bathrooms or bedrooms: one seven-step
 * valuation per room that was seen, summed. `life` and `action` are the
 * worst room's (the action's cost is every room's work added up), so
 * the card's summary line reads the same fields it reads for any item.
 */
export interface PerRoomValuation {
  kind: "per-room";
  /** Which rooms the item is spread across, for the card's wording. */
  noun: "bathroom" | "bedroom";
  parts: { room: string; condition: number; photoReferences: number[]; valuation: GenericItemValuation }[];
  /** Rooms no photo shows — estimated from the rest of the house, not valued here. */
  unseen: string[];
  valueNZD: number;
  cost: { totalNZD: number };
  life: GenericItemValuation["life"];
  action: GenericItemValuation["action"];
}

export type AnyValuation =
  | RoofValuation
  | GenericItemValuation
  | PerRoomValuation
  | RoofWithheldResult
  | ItemWithheldResult;

export const isPerRoom = (v: AnyValuation): v is PerRoomValuation =>
  (v as PerRoomValuation).kind === "per-room";

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
