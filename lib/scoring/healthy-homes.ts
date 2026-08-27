// ============================================================
// Tectara — Healthy Homes standards (investor / rental compliance)
//
// The 5 NZ Healthy Homes Standards, scored with the SAME tier-band method as the
// rest of Improvements. Four of them reuse an existing scored item (so ticking a
// standard for renovation ticks that item's existing reno line — no duplicates);
// draught-stopping has no equivalent, so it's derived from the build era.
//
// A standard is NON-COMPLIANT when its tier is "deteriorated" (score ≤30%) — i.e.
// the feature is effectively non-existing. Those are a legal must-do to rent.
// ============================================================

import { tierBandFraction, SPEC_TIER_SHORT } from "./model";
import type { SpecTier, SubItem } from "@/lib/property-tab/types";

/**
 * When the Building Code started requiring this, and when it was materially
 * lifted. A dwelling built after those dates meets the standard BY LAW — that
 * is a fact about the building, not a guess about it, which matters because
 * none of these can be photographed.
 *
 * Undefined means the era tells you nothing useful. A fixed heater is a fitting
 * somebody installed, not a consequence of when the house went up, so an
 * unassessed heater stays unassessed rather than being inferred from a date.
 */
export interface EraRule {
  /** Built from here, and it comfortably exceeds the minimum. */
  modernFrom: number;
  /** Built from here, and it was required, though to a lower standard. */
  requiredFrom: number;
}

export interface HHStandard {
  key: string; // hh_* id (for the compliance list)
  label: string;
  requirement: string; // the legal requirement, plain English
  sourceItemId?: string; // scoring item this derives from (undefined = derived from build era)
  renoKey: string; // reno-line key to tick (the source item, or hh_draught)
  maxPoints: number; // points denominator shown in the compliance list
  remediation: { low: number; high: number }; // cost to bring up to standard (draught only; others reuse the item)
  /** Used only when the item itself could not be assessed. */
  era?: EraRule;
}

export const HH_STANDARDS: HHStandard[] = [
  // No era rule: a heater is a fitting somebody chose, not a consequence of the
  // build date — and unlike the rest of these, it is visible in a photograph.
  { key: "hh_heating", label: "Fixed heating", requirement: "A fixed heater in the main living room able to heat it to 18°C.", sourceItemId: "liv_heating", renoKey: "liv_heating", maxPoints: 20, remediation: { low: 2500, high: 4500 } },
  { key: "hh_insulation", label: "Insulation", requirement: "Ceiling and underfloor insulation meeting the current minimum R-values.", sourceItemId: "liv_insulation", renoKey: "liv_insulation", maxPoints: 15, remediation: { low: 2400, high: 3800 }, era: { modernFrom: 2008, requiredFrom: 1978 } },
  { key: "hh_ventilation", label: "Ventilation", requirement: "Openable windows plus extractor fans ducted outside in kitchens and bathrooms.", sourceItemId: "bath_ventilation", renoKey: "bath_ventilation", maxPoints: 8, remediation: { low: 700, high: 1400 }, era: { modernFrom: 2008, requiredFrom: 1978 } },
  { key: "hh_moisture", label: "Moisture & drainage", requirement: "Efficient drainage and a ground moisture barrier under any suspended floor.", sourceItemId: "out_drainage", renoKey: "out_drainage", maxPoints: 6, remediation: { low: 1500, high: 3500 }, era: { modernFrom: 2008, requiredFrom: 1978 } },
  { key: "hh_draught", label: "Draught stopping", requirement: "No unreasonable gaps or holes; unused open fireplaces blocked off.", renoKey: "hh_draught", maxPoints: 6, remediation: { low: 600, high: 1600 }, era: { modernFrom: 2008, requiredFrom: 1978 } },
];

/** The reno-line keys that carry a Healthy Homes legal obligation. */
export const HH_RENO_KEYS = new Set(HH_STANDARDS.map((s) => s.renoKey));

export interface HHResult extends HHStandard {
  tier: SpecTier;
  score: number; // 1–10 condition informing the band position
  earned: number; // points earned (tier band × condition, out of maxPoints)
  fraction: number; // 0–1 of maxPoints
  /**
   * True = meets the standard. False = must be remediated by law.
   * NULL = nobody has established either way, which is not the same as
   * compliant and must never be shown as it — a landlord reading "Compliant"
   * about something we never checked could tenant a house that isn't.
   */
  compliant: boolean | null;
  present: boolean; // false = the feature is effectively absent (non-existing)
  /** False when neither the photographs nor the build year could settle it. */
  assessed: boolean;
  /** Where the answer came from, so the report can cite rather than assert. */
  basis: "observed" | "build-era" | null;
}

/** Status label for a standard: "Non-existing" when absent, "Deteriorated" when
 * present but end-of-life, otherwise the spec tier (Dated / Modern / Luxury). */
export function hhStatusLabel(r: { tier: SpecTier; present: boolean }): string {
  if (r.tier === "deteriorated") return r.present ? "Deteriorated" : "Non-existing";
  return SPEC_TIER_SHORT[r.tier];
}

/**
 * What the build year tells us, for the standards the Building Code governs.
 *
 * This is the half of the fix that matters. Insulation sits in a ceiling,
 * ventilation ducting runs inside a wall, and a ground moisture barrier is
 * under the floor — NONE of them can be photographed, so the vision analysis
 * cannot assess them and quite correctly doesn't. What it used to hit instead
 * was a silent `?? "dated"` fallback, which scored a brand-new townhouse 8/15
 * for insulation and 3/8 for ventilation on no evidence whatsoever.
 *
 * The build year is evidence. A dwelling put up under the current Building Code
 * meets these requirements by law — that is a fact about the building, not an
 * assumption about it.
 */
function fromEra(era: EraRule, buildYear: number | null): { tier: SpecTier; score: number } | null {
  // No build year is no evidence. Don't reach for a default.
  if (!buildYear || !Number.isFinite(buildYear)) return null;
  // Top of the "modern" band, not the middle of it: a dwelling built under the
  // current Code is at the current standard by definition. Not "luxury" — that
  // band means the fit-out exceeds what is required, and a build date cannot
  // show that. So a new build tops out around 80% of the points here, which is
  // the model saying "meets the standard well" rather than "beats it".
  if (buildYear >= era.modernFrom) return { tier: "modern", score: 9 };
  if (buildYear >= era.requiredFrom) return { tier: "dated", score: 5 };
  // Built before it was required at all. Absent unless somebody retrofitted it,
  // which a later photograph or an inspection can still overturn.
  return { tier: "deteriorated", score: 1 };
}

/** Assess all 5 standards from the property's existing item scores + build era. */
export function assessHealthyHomes(subItems: SubItem[], buildYear: number | null): HHResult[] {
  const byId = new Map(subItems.map((s) => [s.id, s]));
  return HH_STANDARDS.map((std) => {
    // What was actually SEEN wins over what the era implies. A 2024 build with a
    // visibly failed extractor fan is not compliant because it is new.
    const item = std.sourceItemId ? byId.get(std.sourceItemId) : undefined;
    const observed =
      item && item.specTier && typeof item.score === "number"
        ? { tier: item.specTier, score: item.score }
        : null;

    const derived = observed ?? (std.era ? fromEra(std.era, buildYear) : null);

    // Neither a photograph nor the build year could settle it. Say so, and score
    // it nothing — the same rule the rest of the model follows for anything it
    // cannot see. A guessed "dated" here is a claim about a legal standard.
    if (!derived) {
      return {
        ...std,
        tier: "dated" as SpecTier,
        score: 0,
        earned: 0,
        fraction: 0,
        compliant: null,
        present: false,
        assessed: false,
        basis: null,
      };
    }

    const { tier, score } = derived;
    const fraction = tierBandFraction(tier, score);
    // "Non-existing" = deteriorated AND at the very bottom of the band (score ≤1).
    const present = !(tier === "deteriorated" && score <= 1);
    return {
      ...std,
      tier,
      score,
      earned: Math.round(fraction * std.maxPoints),
      fraction,
      compliant: tier !== "deteriorated",
      present,
      assessed: true,
      basis: observed ? ("observed" as const) : ("build-era" as const),
    };
  });
}
