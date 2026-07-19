// ============================================================
// RoiQ — Healthy Homes standards (investor / rental compliance)
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

export interface HHStandard {
  key: string; // hh_* id (for the compliance list)
  label: string;
  requirement: string; // the legal requirement, plain English
  sourceItemId?: string; // scoring item this derives from (undefined = derived from build era)
  renoKey: string; // reno-line key to tick (the source item, or hh_draught)
  maxPoints: number; // points denominator shown in the compliance list
  remediation: { low: number; high: number }; // cost to bring up to standard (draught only; others reuse the item)
}

export const HH_STANDARDS: HHStandard[] = [
  { key: "hh_heating", label: "Fixed heating", requirement: "A fixed heater in the main living room able to heat it to 18°C.", sourceItemId: "liv_heating", renoKey: "liv_heating", maxPoints: 20, remediation: { low: 2500, high: 4500 } },
  { key: "hh_insulation", label: "Insulation", requirement: "Ceiling and underfloor insulation meeting the current minimum R-values.", sourceItemId: "liv_insulation", renoKey: "liv_insulation", maxPoints: 15, remediation: { low: 2400, high: 3800 } },
  { key: "hh_ventilation", label: "Ventilation", requirement: "Openable windows plus extractor fans ducted outside in kitchens and bathrooms.", sourceItemId: "bath_ventilation", renoKey: "bath_ventilation", maxPoints: 8, remediation: { low: 700, high: 1400 } },
  { key: "hh_moisture", label: "Moisture & drainage", requirement: "Efficient drainage and a ground moisture barrier under any suspended floor.", sourceItemId: "out_drainage", renoKey: "out_drainage", maxPoints: 6, remediation: { low: 1500, high: 3500 } },
  { key: "hh_draught", label: "Draught stopping", requirement: "No unreasonable gaps or holes; unused open fireplaces blocked off.", renoKey: "hh_draught", maxPoints: 6, remediation: { low: 600, high: 1600 } },
];

/** The reno-line keys that carry a Healthy Homes legal obligation. */
export const HH_RENO_KEYS = new Set(HH_STANDARDS.map((s) => s.renoKey));

export interface HHResult extends HHStandard {
  tier: SpecTier;
  score: number; // 1–10 condition informing the band position
  earned: number; // points earned (tier band × condition, out of maxPoints)
  fraction: number; // 0–1 of maxPoints
  compliant: boolean; // false = tier "deteriorated" (≤30%) = must remediate by law
  present: boolean; // false = the feature is effectively absent (non-existing)
}

/** Status label for a standard: "Non-existing" when absent, "Deteriorated" when
 * present but end-of-life, otherwise the spec tier (Dated / Modern / Luxury). */
export function hhStatusLabel(r: { tier: SpecTier; present: boolean }): string {
  if (r.tier === "deteriorated") return r.present ? "Deteriorated" : "Non-existing";
  return SPEC_TIER_SHORT[r.tier];
}

/** Derive a draught-stopping tier + score from the build era (no direct item).
 * Pre-1978 homes were built without draught-stopping → treat as non-existing. */
function draughtFromEra(buildYear: number | null): { tier: SpecTier; score: number } {
  const y = buildYear ?? 1975;
  if (y >= 2008) return { tier: "modern", score: 8 };
  if (y >= 1978) return { tier: "dated", score: 5 };
  return { tier: "deteriorated", score: 1 };
}

/** Assess all 5 standards from the property's existing item scores + build era. */
export function assessHealthyHomes(subItems: SubItem[], buildYear: number | null): HHResult[] {
  const byId = new Map(subItems.map((s) => [s.id, s]));
  return HH_STANDARDS.map((std) => {
    let tier: SpecTier;
    let score: number;
    if (std.sourceItemId) {
      const s = byId.get(std.sourceItemId);
      tier = s?.specTier ?? "dated";
      score = s?.score ?? 5;
    } else {
      ({ tier, score } = draughtFromEra(buildYear));
    }
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
    };
  });
}
