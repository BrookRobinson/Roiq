// ============================================================
// Tectara — Development potential (can you add a tiny home / dwelling?)
//
// A positive OPPORTUNITY on the Land tab: whether the section could take a minor
// dwelling (granny flat), a second dwelling, or a subdivision. Scored as a
// persona-weighted BONUS (never a penalty for absence) plus an estimated value
// uplift. Assessed deterministically from land area vs the existing footprint.
//
// The ZONE is passed in, fetched from the council's own district-plan service
// (lib/zoning/district-plan.ts). This finding used to end "confirm zoning and
// coverage before you rely on it" — handing the reader the job they came here
// to avoid. It now states the zone, or states that this council doesn't publish
// one we can query. What stays out of reach is the rule TABLE behind the zone:
// site coverage, setbacks and density live in the plan text, not the map layer.
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
  subdivision: { label: "Subdivision / multi-unit possible", short: "Subdivision", blurb: "Large enough to potentially subdivide the title or add multiple units.", bonusBuyer: 10, bonusInvestor: 40, upliftLow: 220000, upliftHigh: 480000 },
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
 *
 * The zone is passed in rather than guessed at. This finding used to end with
 * "confirm zoning and coverage before you rely on it", which handed the reader
 * the job they came here to avoid — so where the council publishes a queryable
 * zone layer it is now stated as fact, and where it doesn't the report says
 * exactly that instead of assigning homework.
 *
 * What is still genuinely out of reach is the RULE TABLE behind the zone: site
 * coverage, setbacks and density live in the plan text, not the map layer. That
 * limit is named honestly rather than dressed up as a warning to go and check.
 *
 * Deliberately conservative and flagged isEstimate.
 */
export function assessDevelopment(args: {
  landAreaSqm: number | null;
  floorAreaSqm: number | null;
  suburbMedianPerSqm?: number | null;
  /** The district-plan zone, when the council publishes one we can query. */
  zone?: { zone: string; group: string | null; council: string; rulesUrl: string | null } | null;
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

  const zone = args.zone ?? null;
  const zoneLine = zone ? `Zoned ${zone.zone} (${zone.council})` : null;

  const enablers: string[] = [];
  const blockers: string[] = [];
  if (zoneLine) enablers.push(zoneLine);
  if (land) enablers.push(`Section is ${land.toLocaleString("en-NZ")}m²${spare ? `, with ~${spare.toLocaleString("en-NZ")}m² clear of the existing house` : ""}`);
  if (tier === "minor_dwelling") enablers.push("Granny-flat rules allow a ≤70m² standalone dwelling — often no consent required");
  if (tier === "second_dwelling" || tier === "subdivision") enablers.push("Enough room for more than a minor unit, subject to the zone's density rules");
  if (tier === "none") blockers.push(land ? "Limited spare land once the existing house is accounted for" : "Land area unknown — can't gauge spare space");
  blockers.push(
    zone
      ? "Site coverage, setbacks and density come from the zone's rule tables, which we don't read yet — the zone itself is above"
      : "The zone couldn't be retrieved for this property, so it isn't in this report"
  );

  // The zone either is or isn't known, and the sentence says which. What it
  // never does is tell the reader to go and find out.
  const zoneSentence = zone
    ? `It is zoned ${zone.zone}${zone.council ? ` under the ${zone.council} plan` : ""}.`
    // Deliberately doesn't claim WHY. A missing zone can mean the council
    // publishes no queryable layer, that its service didn't answer, or that the
    // point sits outside every zone polygon — and stating the wrong one would
    // be a small confident lie in place of an honest gap.
    : "We couldn't retrieve a zone for this property — not every council publishes its district plan as data we can query.";
  const rulesSentence = zone
    ? " The zone's site-coverage and setback rules sit in the plan text, which this report doesn't read."
    : "";

  const summary =
    tier === "none"
      ? `On the numbers alone this section is unlikely to take an additional dwelling${land ? ` (~${spare}m² spare)` : ""}. ${zoneSentence}${rulesSentence}`
      : `${meta.label.replace(/ possible$/, "")} looks feasible on section size (~${spare}m² spare of ${land}m²). ${meta.blurb} ${zoneSentence} Confidence: ${confidence}.${rulesSentence}`;

  return { tier, confidence, landAreaSqm: land, spareAreaSqm: spare, valueUpliftLow, valueUpliftHigh, enablers, blockers, summary, isEstimate: true };
}
