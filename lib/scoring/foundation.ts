// ============================================================
// Scoring a foundation nobody has photographed.
//
// Almost no listing shows under the floor. That does NOT make the foundation
// unassessable, and treating it as unassessable throws away the largest item in
// the model along with real evidence a buyer would want.
//
// Three things ARE readable from an ordinary listing:
//
//   1. The TYPE. A perimeter base board with a height gap between the ground and
//      the cladding, or subfloor vents, means timber piles. A continuous
//      vent-free concrete base at ground level means a slab.
//   2. The ERA, which sets the standard it was built to. A slab poured under the
//      post-Canterbury revision of NZS 3604 is a different proposition from
//      1960s piles, and the build year is usually stated.
//   3. The SYMPTOMS, which show up INSIDE. Floors that visibly slope, gaps
//      opening at the top or bottom of doorways, out-of-square openings,
//      diagonal cracking at the corners of linings — these are what pile
//      settlement looks like in a photograph of a living room, and they are the
//      strongest evidence available short of crawling underneath.
//
// So the score is built from type + era, then reduced by what the interior
// photos actually show. The same arrangement land_topography uses: the model
// reports the observable facts, this recomputes the number, and no number is
// invented from a build year alone.
//
// Pure and dependency-free — tested in scripts/verify-foundation.mjs.
// ============================================================

export type FoundationType =
  | "concrete_slab"
  | "concrete_piles"
  | "timber_piles"
  | "mixed"
  | "unknown";

/**
 * What the interior and exterior photos show. Every one of these is visible in
 * ordinary listing photography — none of them require the subfloor.
 */
export type FoundationSymptom =
  | "sloping_floor" // floor visibly out of level
  | "door_gaps" // uneven gaps at the head or foot of a doorway
  | "out_of_square" // door or window openings visibly out of square
  | "lining_cracks" // diagonal cracking at the corners of openings
  | "exterior_cracking" // stepped cracking in brick, block or plaster
  | "pile_damage"; // rot, borer or leaning piles — only if the subfloor IS shown

export interface FoundationAssessment {
  /** 1–10, the report's condition score for ext_foundation. */
  score: number;
  /** 1 confirmed from photo · 2 probable · 3 not visible. */
  confidenceTier: 1 | 2 | 3;
  /** "Concrete slab, post-2011 standard" — what the score is based on. */
  band: string;
  /** Plain-language reasoning, safe to show a buyer. */
  rationale: string;
}

/**
 * NZS 3604 was revised in 2011 after the Canterbury earthquakes, tightening
 * foundation and slab requirements. A slab poured under that revision is the
 * strongest ordinary residential foundation in New Zealand housing stock.
 */
const MODERN_STANDARD_YEAR = 2011;
/** NZS 3604 first published 1978 and revised through the 1990s. */
const ENGINEERED_ERA_YEAR = 1978;
/** Before this, timber piles were typically unbraced and often untreated. */
const OLD_PILE_YEAR = 1970;

/** Base score by type and era, before anything visible is taken off. */
function baseFor(type: FoundationType, buildYear: number | null): { score: number; band: string } {
  const modern = buildYear != null && buildYear >= MODERN_STANDARD_YEAR;
  const engineered = buildYear != null && buildYear >= ENGINEERED_ERA_YEAR;
  const old = buildYear != null && buildYear < OLD_PILE_YEAR;

  switch (type) {
    case "concrete_slab":
      if (modern) return { score: 10, band: "Concrete slab, post-2011 standard" };
      if (engineered) return { score: 8, band: "Concrete slab, engineered era" };
      return { score: 7, band: buildYear != null ? "Concrete slab, pre-1978" : "Concrete slab, era not stated" };
    case "concrete_piles":
      if (modern) return { score: 8, band: "Concrete piles, post-2011 standard" };
      if (engineered) return { score: 7, band: "Concrete piles, engineered era" };
      return { score: 6, band: buildYear != null ? "Concrete piles, pre-1978" : "Concrete piles, era not stated" };
    case "timber_piles":
      if (modern) return { score: 7, band: "Timber piles, post-2011 standard" };
      if (engineered) return { score: 6, band: "Timber piles, braced era" };
      if (old) return { score: 4, band: "Timber piles, pre-1970" };
      // No build year. Mid-band, and the label must not invent a decade — most
      // houses on piles with no stated era are 1970s or older, but "1970s" as a
      // stated fact is exactly the kind of small confident lie being removed.
      return { score: 5, band: buildYear != null ? "Timber piles, 1970s" : "Timber piles, era not stated" };
    case "mixed":
      return { score: 5, band: "Mixed foundation types" };
    default:
      // Type genuinely couldn't be read. Mid-band, and the tier says why.
      return { score: 6, band: "Foundation type not established" };
  }
}

/**
 * What each visible symptom costs.
 *
 * A sloping floor is the one that matters most: it is what differential
 * settlement looks like from inside, and on timber piles it is the classic
 * sign. Cracking is weighted lower on its own because plaster cracks for
 * ordinary reasons too, but it compounds.
 */
const SYMPTOM_PENALTY: Record<FoundationSymptom, number> = {
  sloping_floor: 3,
  door_gaps: 2,
  out_of_square: 2,
  lining_cracks: 1,
  exterior_cracking: 2,
  pile_damage: 3,
};

const SYMPTOM_LABEL: Record<FoundationSymptom, string> = {
  sloping_floor: "floors visibly out of level",
  door_gaps: "uneven gaps around doorways",
  out_of_square: "openings out of square",
  lining_cracks: "diagonal cracking at openings",
  exterior_cracking: "stepped cracking in the exterior cladding",
  pile_damage: "damaged or leaning piles",
};

/**
 * Score the foundation from what can actually be seen.
 *
 * Confidence follows the evidence, not the score: symptoms visible inside make
 * this a Tier 1 assessment even though nobody saw a pile, because subsidence
 * showing through the floor IS the finding. A clean read of the type with no
 * symptoms is Tier 2 — the type is inferred from perimeter cues. Only a
 * foundation whose type could not be established at all is Tier 3.
 */
export function assessFoundation(args: {
  type: FoundationType;
  buildYear: number | null;
  symptoms?: readonly FoundationSymptom[];
  /** True when a photo genuinely shows under the floor — rare. */
  subfloorVisible?: boolean;
}): FoundationAssessment {
  const symptoms = Array.from(new Set(args.symptoms ?? []));
  const { score: base, band } = baseFor(args.type, args.buildYear);
  const penalty = symptoms.reduce((sum, s) => sum + (SYMPTOM_PENALTY[s] ?? 0), 0);
  const score = Math.max(1, Math.min(10, base - penalty));

  const confidenceTier: 1 | 2 | 3 =
    symptoms.length > 0 || args.subfloorVisible ? 1 : args.type === "unknown" ? 3 : 2;

  const eraNote =
    args.buildYear != null ? ` (built ${args.buildYear})` : " (build year not stated)";

  const rationale =
    symptoms.length > 0
      ? `${band}${eraNote}. The photos show ${symptoms.map((s) => SYMPTOM_LABEL[s]).join(", ")} — signs of movement that carry more weight than the foundation type on its own.`
      : args.type === "unknown"
        ? `The foundation type could not be established from the photos${eraNote}, and no signs of movement are visible inside.`
        : `${band}${eraNote}. No signs of movement are visible in the photos — floors read level and openings look square. Nobody has been under the floor, so this rates the type, the era and what the interior shows, not the piles themselves.`;

  return { score, confidenceTier, band, rationale };
}
