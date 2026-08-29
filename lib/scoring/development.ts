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

import type { SiteLayout } from "./site-layout";

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

/** An instrument on the title that could bear on what may be built here. */
export interface TitleRestriction {
  /** LINZ's instrument number — the thing a solicitor can actually look up. */
  instrumentNo: string;
  /** LINZ's own description, e.g. "Land Transfer Plan Land Covenant". */
  label: string;
  kind: "covenant" | "easement";
}

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
  /**
   * Covenants and easements registered against the title, from LINZ.
   *
   * A no-second-dwelling or no-further-subdivision covenant is common on
   * subdivision titles and is precisely the thing that stops this — and until
   * the register was being read, this finding had never heard of one. An
   * easement matters too: a right of way across the back of the section is why
   * the minor dwelling can't go there.
   */
  titleRestrictions: TitleRestriction[];
  /**
   * True when something is registered that could forbid this and we cannot read
   * its terms — which is always, because the wording is a paid download.
   *
   * The score bonus is WITHHELD while this is true. That is the Tier 3 rule
   * applied to an opportunity: the bonus is awarded for a development we can no
   * longer confirm is permitted, and a number nobody can stand behind should not
   * be adding to a property's score. The indicative VALUE range is still shown,
   * because "this might be worth $122,000 — go and read covenant 5638539.1" is
   * useful where silence is not.
   */
  restrictedByTitle: boolean;
  /**
   * True when this came from the parcel geometry rather than from land area
   * minus a footprint. The card's footnote says which, because "measured" and
   * "estimated" are very different claims to put under a six-figure number.
   */
  measured: boolean;
}

/**
 * Persona-weighted score bonus for a development tier.
 *
 * WITHHELD ENTIRELY when the title carries a covenant or easement whose terms we
 * cannot read. Halving it would be an invented number; zero is the same rule
 * Tier 3 improvements follow — we do not know this development is permitted, so
 * it does not score. The Land tab says so rather than the points quietly
 * vanishing.
 */
export function developmentBonus(
  tier: DevTier,
  persona: "buyer" | "investor",
  restrictedByTitle = false
): number {
  if (restrictedByTitle) return 0;
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
/** "an easement instrument", "a building line restriction". */
function article(label: string): string {
  return /^[aeiou]/i.test(label.trim()) ? "an" : "a";
}

export function assessDevelopment(args: {
  landAreaSqm: number | null;
  floorAreaSqm: number | null;
  suburbMedianPerSqm?: number | null;
  /** The district-plan zone, when the council publishes one we can query. */
  zone?: { zone: string; group: string | null; council: string; rulesUrl: string | null } | null;
  /**
   * Covenants and easements on the title, from LINZ. Undefined means the
   * register was never read — which is NOT the same as a clear title, and the
   * finding must not read as though it were.
   */
  titleRestrictions?: TitleRestriction[] | null;
  /**
   * The section's REAL layout — where the buildings stand and whether anything
   * fits beside them. When present it replaces the subtraction entirely, because
   * "land minus footprint" cannot tell a house at the front of a section with a
   * clear back yard from one in the middle ringed by 4m strips, and puts the
   * same six-figure sentence on both.
   */
  layout?: SiteLayout | null;
}): DevelopmentPotential {
  const layout = args.layout ?? null;
  const land = args.landAreaSqm && args.landAreaSqm > 0 ? args.landAreaSqm : null;
  // Approx ground footprint: assume mostly single-level (conservative). Falls back
  // to 20% site coverage when the floor area is unknown.
  const footprint = args.floorAreaSqm && args.floorAreaSqm > 0 ? args.floorAreaSqm : land ? Math.round(land * 0.2) : 0;
  // MEASURED clear ground where we have the parcel geometry, subtraction only
  // as the fallback. They are not the same number and not the same claim: on 230
  // Sewell Street subtraction says 427m² spare, and the geometry says 224m² of
  // it is actually clear — in pieces no bigger than 5m × 8m.
  const spare = layout ? layout.clearAreaSqm : land ? Math.max(0, land - footprint) : null;

  let tier: DevTier = "none";
  if (land && spare) {
    if (land >= 1000 && spare >= 550) tier = "subdivision";
    else if (land >= 750 && spare >= 380) tier = "second_dwelling";
    else if (land >= 450 && spare >= 130) tier = "minor_dwelling";
  }

  // THE GATE. A section can be huge and still have nowhere to put anything —
  // 230 Sewell Street is 811m² with three buildings on it and no contiguous
  // 7m × 10m rectangle anywhere. Where the geometry says nothing fits, there is
  // no development potential to report, whatever the area thresholds said.
  if (layout && !layout.unitFits) tier = "none";

  const restrictions = (args.titleRestrictions ?? []).filter(
    (r) => r.kind === "covenant" || r.kind === "easement"
  );
  const restrictedByTitle = tier !== "none" && restrictions.length > 0;

  // Confidence: comfortably past the threshold → likely; near it → possible.
  let confidence: DevelopmentPotential["confidence"] = "unlikely";
  if (tier !== "none" && land && spare) {
    const margins: Record<DevTier, number> = { none: 0, minor_dwelling: 130, second_dwelling: 380, subdivision: 550 };
    confidence = spare >= margins[tier] * 1.4 ? "likely" : "possible";
    // The section is big enough — that was never the question. Something is
    // registered that could forbid it outright, so "likely" is a claim the
    // register no longer supports.
    if (restrictedByTitle) confidence = "possible";
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
  if (land) {
    enablers.push(
      layout
        ? `Section is ${land.toLocaleString("en-NZ")}m², measured on the parcel boundary — ${layout.builtAreaSqm}m² built on, ${layout.clearAreaSqm}m² genuinely clear`
        : `Section is ${land.toLocaleString("en-NZ")}m²${spare ? `, with ~${spare.toLocaleString("en-NZ")}m² clear of the existing house` : ""}`
    );
  }
  if (layout?.largestClear && tier !== "none") {
    enablers.push(
      `The largest unbroken clear area is ${layout.largestClear.width}m × ${layout.largestClear.length}m${layout.placement ? `, ${layout.placement}` : ""}`
    );
  }
  if (tier === "minor_dwelling") enablers.push("Granny-flat rules allow a ≤70m² standalone dwelling — often no consent required");
  if (tier === "second_dwelling" || tier === "subdivision") enablers.push("Enough room for more than a minor unit, subject to the zone's density rules");
  if (tier === "none") {
    blockers.push(
      layout
        ? layout.largestClear
          ? `Measured on the parcel: the largest clear rectangle is ${layout.largestClear.width}m × ${layout.largestClear.length}m — too small for a ${layout.assumed.unit.width}m × ${layout.assumed.unit.length}m dwelling`
          : "Measured on the parcel: no clear buildable ground once the existing buildings and boundary setbacks are allowed for"
        : land
          ? "Limited spare land once the existing house is accounted for"
          : "Land area unknown — can't gauge spare space"
    );
    if (layout && layout.buildingCount > 1) {
      blockers.push(`${layout.buildingCount} structures already stand on this section, covering ${layout.builtAreaSqm}m²`);
    }
  }
  blockers.push(
    zone
      ? "Site coverage, setbacks and density come from the zone's rule tables, which we don't read yet — the zone itself is above"
      : "The zone couldn't be retrieved for this property, so it isn't in this report"
  );
  if (restrictedByTitle) {
    const covenants = restrictions.filter((r) => r.kind === "covenant");
    const named = restrictions.map((r) => r.instrumentNo).join(", ");
    blockers.push(
      covenants.length
        ? `The title carries ${covenants.length === 1 ? "a covenant" : `${covenants.length} covenants`} (${named}) — no-second-dwelling and no-further-subdivision covenants are common, and we can't read the wording`
        : `The title carries an easement (${named}) — where it runs may rule out the part of the section this would go on`
    );
  }

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

  // Said in the summary, not only in the blockers list. The uplift figure is the
  // most quotable number on the Land tab, and a caveat further down the card
  // loses to a dollar range every time.
  const restrictionSentence = restrictedByTitle
    ? ` NOTE: the record of title carries ${restrictions.map((r) => `${article(r.label)} ${r.label.toLowerCase()} (${r.instrumentNo})`).join(" and ")}. The wording of a registered instrument isn't public, so we can't tell you whether it permits this — the value above is what the section could support, not what the title allows. Give those numbers to your solicitor before you count on it.`
    : "";

  // Written from THIS property's geometry where we have it. The old sentence —
  // "looks feasible on section size (~427m² spare of 612m²)" — is true of every
  // large section in the country and told a reader nothing about theirs.
  const houseLine = layout?.housePosition ? ` The existing house sits ${layout.housePosition}.` : "";
  const marginLine = layout
    ? ` Measured off the parcel boundary and LINZ's building footprints, allowing ${layout.assumed.boundarySetback}m to the boundaries and ${layout.assumed.buildingGap}m clear of what's already built — our assumptions, not the council's rules.`
    : "";

  const summary =
    tier === "none"
      ? layout
        ? `There is nowhere on this section to put another dwelling.${houseLine} Of its ${land ?? layout.parcelAreaSqm}m², ${layout.builtAreaSqm}m² is already built on${layout.buildingCount > 1 ? ` across ${layout.buildingCount} structures` : ""} and ${layout.clearAreaSqm}m² is clear — but the largest unbroken piece of it is ${layout.largestClear ? `${layout.largestClear.width}m × ${layout.largestClear.length}m` : "too small to measure"}, and a ${layout.assumed.unit.width}m × ${layout.assumed.unit.length}m minor dwelling needs more than that in ONE piece. Spare area on its own is misleading here.${marginLine} ${zoneSentence}${rulesSentence}`
        : `On the numbers alone this section is unlikely to take an additional dwelling${land ? ` (~${spare}m² spare)` : ""}. ${zoneSentence}${rulesSentence}`
      : layout
        ? `${meta.label.replace(/ possible$/, "")} looks feasible on this section's actual layout.${houseLine} That leaves a clear area of ${layout.largestClear?.width}m × ${layout.largestClear?.length}m${layout.placement ? `, ${layout.placement}` : ""} — enough for a ${layout.assumed.unit.width}m × ${layout.assumed.unit.length}m dwelling. ${meta.blurb} ${zoneSentence} Confidence: ${confidence}.${marginLine}${rulesSentence}${restrictionSentence}`
        : `${meta.label.replace(/ possible$/, "")} looks feasible on section size (~${spare}m² spare of ${land}m²). ${meta.blurb} ${zoneSentence} Confidence: ${confidence}.${rulesSentence}${restrictionSentence}`;

  return {
    tier, confidence, landAreaSqm: land, spareAreaSqm: spare,
    valueUpliftLow, valueUpliftHigh, enablers, blockers, summary, isEstimate: true,
    titleRestrictions: restrictions,
    restrictedByTitle,
    measured: !!layout,
  };
}
