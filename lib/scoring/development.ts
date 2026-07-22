// ============================================================
// RoiQ — Development potential (can you add a tiny home / dwelling?)
//
// A positive OPPORTUNITY on the Land tab: whether the section could take a minor
// dwelling (granny flat), a second dwelling, or a subdivision. Scored as a
// persona-weighted BONUS (never a penalty for absence) plus an estimated value
// uplift. Assessed deterministically from land area vs the existing footprint;
// zone is inferred + flagged to confirm with the council (paid geodata = Phase 2).
//
// Reflects the NZ granny-flat rules: a standalone dwelling up to 70m² can go on
// many residential/rural/mixed sites without a resource or building consent.
// ============================================================

export type DevTier = "none" | "minor_dwelling" | "second_dwelling" | "subdivision";

export interface DevTierMeta {
  label: string; // headline verdict
  short: string; // badge label
  blurb: string; // one-line meaning
  bonusBuyer: number; // score bonus for a home buyer
  bonusInvestor: number; // score bonus for an investor (weighted higher)
  upliftLow: number; // indicative value uplift at a 1.0 location factor
  upliftHigh: number;
}

export const DEV_TIERS: Record<DevTier, DevTierMeta> = {
  none: { label: "No extra dwelling likely", short: "None", blurb: "The site is unlikely to take an additional dwelling as-is.", bonusBuyer: 0, bonusInvestor: 0, upliftLow: 0, upliftHigh: 0 },
  minor_dwelling: { label: "Minor dwelling possible", short: "Minor dwelling", blurb: "Room for a ≤70m² standalone dwelling — often no resource/building consent needed under the granny-flat rules.", bonusBuyer: 6, bonusInvestor: 20, upliftLow: 90000, upliftHigh: 160000 },
  second_dwelling: { label: "Second dwelling possible", short: "Second dwelling", blurb: "Room for a full second dwelling — resource consent likely required.", bonusBuyer: 8, bonusInvestor: 30, upliftLow: 160000, upliftHigh: 320000 },
  subdivision: { label: "Subdivision / multi-unit possible", short: "Subdivision", blurb: "Large enough to potentially subdivide the title or add multiple units — subject to zoning.", bonusBuyer: 10, bonusInvestor: 40, upliftLow: 220000, upliftHigh: 480000 },
};

export const DEV_TIER_ORDER: DevTier[] = ["none", "minor_dwelling", "second_dwelling", "subdivision"];

export interface DevelopmentPotential {
  tier: DevTier;
  confidence: "likely" | "possible" | "unlikely";
  landAreaSqm: number | null;
  spareAreaSqm: number | null; // land minus the existing footprint
  valueUpliftLow: number;
  valueUpliftHigh: number;
  enablers: string[];
  blockers: string[];
  summary: string;
  isEstimate: boolean; // always true until council zoning data is wired
}

/** Persona-weighted score bonus for a development tier. */
export function developmentBonus(tier: DevTier, persona: "buyer" | "investor"): number {
  const m = DEV_TIERS[tier];
  return persona === "investor" ? m.bonusInvestor : m.bonusBuyer;
}

/** Location multiplier for the value uplift — pricier suburbs → bigger uplift. */
function locationFactor(suburbPerSqm: number | null | undefined): number {
  if (!suburbPerSqm || suburbPerSqm <= 0) return 1;
  return Math.max(0.6, Math.min(2.6, suburbPerSqm / 7000));
}

/**
 * Assess development potential from the section size vs the existing footprint.
 * Deliberately conservative; flagged isEstimate — confirm zone/coverage/access
 * with the council or a LIM. Phase 2 swaps the heuristic for licensed geodata.
 */
export function assessDevelopment(args: {
  landAreaSqm: number | null;
  floorAreaSqm: number | null;
  suburbMedianPerSqm?: number | null;
}): DevelopmentPotential {
  const land = args.landAreaSqm && args.landAreaSqm > 0 ? args.landAreaSqm : null;
  // Approx ground footprint: assume mostly single-level (conservative). Falls back
  // to 20% site coverage when the floor area is unknown.
  const footprint = args.floorAreaSqm && args.floorAreaSqm > 0 ? args.floorAreaSqm : land ? Math.round(land * 0.2) : 0;
  const spare = land ? Math.max(0, land - footprint) : null;

  let tier: DevTier = "none";
  if (land && spare) {
    if (land >= 1000 && spare >= 550) tier = "subdivision";
    else if (land >= 750 && spare >= 380) tier = "second_dwelling";
    else if (land >= 450 && spare >= 130) tier = "minor_dwelling";
  }

  // Confidence: comfortably past the threshold → likely; near it → possible.
  let confidence: DevelopmentPotential["confidence"] = "unlikely";
  if (tier !== "none" && land && spare) {
    const margins: Record<DevTier, number> = { none: 0, minor_dwelling: 130, second_dwelling: 380, subdivision: 550 };
    confidence = spare >= margins[tier] * 1.4 ? "likely" : "possible";
  }

  const meta = DEV_TIERS[tier];
  const lf = locationFactor(args.suburbMedianPerSqm);
  const valueUpliftLow = Math.round((meta.upliftLow * lf) / 1000) * 1000;
  const valueUpliftHigh = Math.round((meta.upliftHigh * lf) / 1000) * 1000;

  const enablers: string[] = [];
  const blockers: string[] = [];
  if (land) enablers.push(`Section is ${land.toLocaleString("en-NZ")}m²${spare ? `, with ~${spare.toLocaleString("en-NZ")}m² clear of the existing house` : ""}`);
  if (tier === "minor_dwelling") enablers.push("Granny-flat rules allow a ≤70m² standalone dwelling — often no consent required");
  if (tier === "second_dwelling" || tier === "subdivision") enablers.push("Enough room for more than a minor unit, subject to the zone's density rules");
  if (tier === "none") blockers.push(land ? "Limited spare land once the existing house is accounted for" : "Land area unknown — can't gauge spare space");
  blockers.push("Confirm the zone, site-coverage limit, setbacks and access with the council / LIM before relying on this");

  const summary =
    tier === "none"
      ? `On the numbers alone this section is unlikely to take an additional dwelling${land ? ` (~${spare}m² spare)` : ""}. Zoning could still allow density — confirm with the council.`
      : `${meta.label.replace(/ possible$/, "")} looks feasible on section size (~${spare}m² spare of ${land}m²). ${meta.blurb} Confidence: ${confidence}. Confirm zoning and coverage before you rely on it.`;

  return { tier, confidence, landAreaSqm: land, spareAreaSqm: spare, valueUpliftLow, valueUpliftHigh, enablers, blockers, summary, isEstimate: true };
}
