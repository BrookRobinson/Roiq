// ============================================================
// RoiQ — Land / site-quality bands
//
// Gives each Land item a plain descriptive band (Flat / Gentle / Steep …) shown
// alongside its score, so the Land tab reads like the banded Improvements tab.
// Section size is scored OBJECTIVELY against a typical lot rather than a
// subjective 1–10. (Suburb-specific typical lots arrive with the sales/geodata
// layer — Phase 2; for now we benchmark against a typical NZ section.)
// ============================================================

import type {
  AccessType,
  AspectDirection,
  ShapeType,
  SlopeBand,
  SunObstruction,
  TreeMaturity,
  TreeUpkeep,
} from "@/lib/property-tab/types";

/** Typical NZ residential section (m²) used as the section-size benchmark. */
export const TYPICAL_SECTION_SQM = 550;

// ── Topography ───────────────────────────────────────────────────────────────
// "6/10 contour" is unverifiable and means nothing to a buyer. Two things ARE
// genuinely readable from photos + aerials: which standard gradient band the
// site sits in, and roughly how much of it is flat enough to use. We ask the AI
// for those, then DERIVE the score — same shape as section size, where the m²
// is the fact and the score falls out of it.

/**
 * Standard NZ site-slope bands. `scoreRange` is the points band the gradient
 * earns; `usableRange` is the plausible usable-share span for that gradient,
 * used to position the item inside its band (mirrors the spec-tier method on
 * the Improvements tab).
 */
export const SLOPE_BANDS: Record<
  SlopeBand,
  {
    label: string;
    gradient: string;
    degrees: string;
    bandIndex: number;
    scoreRange: [number, number];
    usableRange: [number, number];
    typicalUsablePct: number;
    consequence: string;
  }
> = {
  flat: {
    label: "Flat",
    gradient: "flatter than 1:20",
    degrees: "under 3°",
    bandIndex: 3,
    scoreRange: [9, 10],
    usableRange: [85, 100],
    typicalUsablePct: 95,
    consequence: "Effectively the whole section is usable, and it is the cheapest ground to build on, landscape or add a dwelling to.",
  },
  gentle: {
    label: "Gentle slope",
    gradient: "about 1:20 to 1:10",
    degrees: "3–6°",
    bandIndex: 2,
    scoreRange: [7, 9],
    usableRange: [70, 95],
    typicalUsablePct: 85,
    consequence: "Most of the section is usable. Any build or major landscaping needs minor site works, but nothing unusual.",
  },
  moderate: {
    label: "Moderate slope",
    gradient: "about 1:10 to 1:5",
    degrees: "6–11°",
    bandIndex: 1,
    scoreRange: [4, 7],
    usableRange: [45, 80],
    typicalUsablePct: 65,
    consequence: "Part of the section is hard to use without terracing. Expect retaining and earthworks costs on any build, extension or flat-lawn project.",
  },
  steep: {
    label: "Steep",
    gradient: "steeper than 1:5",
    degrees: "over 11°",
    bandIndex: 0,
    scoreRange: [1, 4],
    usableRange: [15, 55],
    typicalUsablePct: 35,
    consequence: "Usable flat ground is limited. Building or landscaping needs specific engineering — retaining, piled foundations and access are all materially dearer.",
  },
};

// ── Section shape ────────────────────────────────────────────────────────────
// This item used to be "Shape & usability", which meant nothing specific — and
// once topography started reporting usable land, the two collided. Shape is a
// CATEGORY, not a quantity, so the AI names the outline and the score derives
// from that name plus how much of the section the shape leaves in a workable
// block. Access quality (ROW vs road frontage) is scored separately under
// land_frontage, so shape only accounts for the AREA a rear lot costs you.

export const SHAPE_TYPES: Record<
  ShapeType,
  {
    label: string;
    bandIndex: number;
    scoreRange: [number, number];
    workableRange: [number, number];
    typicalWorkablePct: number;
    consequence: string;
  }
> = {
  rectangular: {
    label: "Rectangular",
    bandIndex: 3,
    scoreRange: [9, 10],
    workableRange: [92, 100],
    typicalWorkablePct: 97,
    consequence: "A regular outline with no wasted corners — the easiest shape to build on, fence and lay out.",
  },
  square: {
    label: "Square",
    bandIndex: 3,
    scoreRange: [9, 10],
    workableRange: [92, 100],
    typicalWorkablePct: 97,
    consequence: "A regular outline with no wasted corners, and the most flexible for where you place a building.",
  },
  wide_frontage: {
    label: "Wide frontage",
    bandIndex: 3,
    scoreRange: [8, 10],
    workableRange: [90, 100],
    typicalWorkablePct: 95,
    consequence: "Regular and wider than it is deep — good for a single-level layout, garaging and street appeal.",
  },
  long_narrow: {
    label: "Long & narrow",
    bandIndex: 2,
    scoreRange: [5, 7],
    workableRange: [70, 92],
    typicalWorkablePct: 82,
    consequence: "Regular but tight across the width — side setbacks eat into it, which limits the footprint you can fit.",
  },
  l_shaped: {
    label: "L-shaped",
    bandIndex: 2,
    scoreRange: [5, 7],
    workableRange: [70, 92],
    typicalWorkablePct: 80,
    consequence: "The return leg is awkward to build on and tends to end up as leftover yard rather than useful space.",
  },
  rear_lot: {
    label: "Rear lot (battle-axe)",
    bandIndex: 1,
    scoreRange: [4, 7],
    workableRange: [65, 88],
    typicalWorkablePct: 75,
    consequence: "The driveway leg is counted in the title area but is dead space — the usable part is the rear block only. (Access quality is scored separately under Frontage.)",
  },
  wedge: {
    label: "Wedge / triangular",
    bandIndex: 1,
    scoreRange: [3, 6],
    workableRange: [55, 82],
    typicalWorkablePct: 68,
    consequence: "The narrow end is largely unusable and setbacks bite hardest on the angles, so a chunk of the title area can't be built on.",
  },
  irregular: {
    label: "Irregular",
    bandIndex: 0,
    scoreRange: [2, 5],
    workableRange: [50, 82],
    typicalWorkablePct: 65,
    consequence: "An awkward outline leaves slivers you can't use, and makes building placement, fencing and any subdivision dearer.",
  },
};

// ── Trees & planting ─────────────────────────────────────────────────────────
// Two plain facts a buyer can check from the photos, instead of an opaque 1–10:
// how ESTABLISHED the planting is (the asset) and what STATE it has been kept in
// (the liability). Maturity sets the points band, upkeep positions the item
// inside it — so mature-but-neglected can't outscore mature-and-cared-for.

export const TREE_MATURITY: Record<
  TreeMaturity,
  { label: string; bandIndex: number; scoreRange: [number, number]; asset: string }
> = {
  bare: {
    label: "Bare / minimal",
    bandIndex: 0,
    scoreRange: [3, 5],
    asset: "Little established planting — no shade, screening or privacy yet, and anything you want will take years to grow in.",
  },
  young: {
    label: "Young planting",
    bandIndex: 1,
    scoreRange: [5, 7],
    asset: "Planting is in but still filling out — the screening and shade benefit is a few years away.",
  },
  established: {
    label: "Established",
    bandIndex: 2,
    scoreRange: [6, 9],
    asset: "Settled planting that already gives shade, screening and privacy — a genuine amenity you would otherwise wait years for.",
  },
  mature: {
    label: "Mature planting",
    bandIndex: 3,
    scoreRange: [6, 10],
    asset: "Large, fully grown specimens — the biggest amenity a section can carry, but also the most to go wrong if they have been left alone.",
  },
};

export const TREE_UPKEEP: Record<
  TreeUpkeep,
  { label: string; position: number; upkeep: string; consequence: string }
> = {
  well_maintained: {
    label: "Well maintained",
    position: 1,
    upkeep: "Low",
    consequence: "It has clearly been pruned and cared for, so you inherit it in good order rather than paying to catch up.",
  },
  tidy: {
    label: "Tidy",
    position: 0.7,
    upkeep: "Some",
    consequence: "Kept in reasonable order — expect normal seasonal pruning and green waste, nothing unusual.",
  },
  overgrown: {
    label: "Overgrown",
    position: 0.33,
    upkeep: "High",
    consequence: "It has got away on someone. Budget for a catch-up prune, and check nothing is growing into gutters, fences, drains or a neighbour's airspace.",
  },
  neglected: {
    label: "Neglected",
    position: 0,
    upkeep: "High",
    consequence: "Left alone long enough to become a liability — get an arborist's read on dead limbs, roots near foundations and drains, and anything overhanging a boundary before you commit.",
  },
};

// ── Section orientation ──────────────────────────────────────────────────────
// The compass direction is the fact; what BLOCKS that sun positions the score.
// A north section under a hill or a two-storey neighbour is not a sunny section.
// NB this scores the SITE. How well the HOUSE captures the sun (living-room
// orientation, glazing, outdoor flow) is loc_sun over on the Improvements tab.

export const ASPECT_DIRECTIONS: Record<
  AspectDirection,
  { label: string; short: string; bandIndex: number; scoreRange: [number, number]; note: string }
> = {
  north: {
    label: "North-facing", short: "N", bandIndex: 3, scoreRange: [7, 10],
    note: "The best aspect in New Zealand — sun across the whole day, and the winter sun that actually matters here.",
  },
  north_east: {
    label: "North-east facing", short: "NE", bandIndex: 3, scoreRange: [6, 9],
    note: "Strong morning and midday sun, dropping off in the late afternoon.",
  },
  north_west: {
    label: "North-west facing", short: "NW", bandIndex: 3, scoreRange: [6, 9],
    note: "Good midday and afternoon sun — warm outdoor living into the evening, though it can run hot in summer.",
  },
  east: {
    label: "East-facing", short: "E", bandIndex: 2, scoreRange: [5, 8],
    note: "Bright mornings, but it loses the sun early and the outdoor living goes cold in the afternoon.",
  },
  west: {
    label: "West-facing", short: "W", bandIndex: 2, scoreRange: [5, 8],
    note: "No morning sun, then strong late-afternoon sun — good for evening outdoor living, harsh in midsummer.",
  },
  south_east: {
    label: "South-east facing", short: "SE", bandIndex: 1, scoreRange: [3, 6],
    note: "Limited direct sun, mostly early. Expect cooler, damper rooms and a higher heating bill.",
  },
  south_west: {
    label: "South-west facing", short: "SW", bandIndex: 1, scoreRange: [3, 6],
    note: "Limited direct sun, mostly late. Expect cooler rooms, and it catches the prevailing southerly.",
  },
  south: {
    label: "South-facing", short: "S", bandIndex: 0, scoreRange: [2, 5],
    note: "The weakest aspect here — little direct winter sun, which means colder, damper rooms and more heating.",
  },
};

export const SUN_OBSTRUCTION: Record<SunObstruction, { label: string; position: number; note: string }> = {
  open: { label: "open", position: 1, note: "Nothing significant blocks it, so the aspect delivers what it promises." },
  partly_shaded: {
    label: "partly shaded", position: 0.5,
    note: "Some shading from neighbouring buildings, trees or the land behind takes the edge off it.",
  },
  heavily_shaded: {
    label: "heavily shaded", position: 0,
    note: "A hill, a tall neighbour or heavy canopy blocks much of the sun the aspect would otherwise give you — verify on a site visit at the time of day you'd actually use it.",
  },
};

// ── Frontage & access ────────────────────────────────────────────────────────
// Two facts: HOW you reach the property, and HOW MANY households share that
// access. The second is the one that bites — a right of way shared with five
// homes carries maintenance cost, dispute risk and traffic past your windows.

export const ACCESS_TYPES: Record<
  AccessType,
  { label: string; bandIndex: number; scoreRange: [number, number]; note: string }
> = {
  prime_frontage: {
    label: "Prime frontage", bandIndex: 3, scoreRange: [9, 10],
    note: "Wide, direct street frontage — easy parking and turning, good street presence, and the best position for any future subdivision.",
  },
  corner_site: {
    label: "Corner site", bandIndex: 3, scoreRange: [8, 10],
    note: "Frontage to two streets — flexible access and often a second entry point, at the cost of a longer boundary to fence and more passing traffic.",
  },
  road_frontage: {
    label: "Road frontage", bandIndex: 2, scoreRange: [8, 9],
    note: "Your own direct access off the road — nothing shared, nothing to negotiate.",
  },
  shared_driveway: {
    label: "Shared driveway", bandIndex: 1, scoreRange: [5, 7],
    note: "You share the driveway with neighbours: shared upkeep costs, less privacy, and parking or manoeuvring can become a point of friction.",
  },
  right_of_way: {
    label: "Right of way", bandIndex: 1, scoreRange: [4, 7],
    note: "Access runs over someone else's title under a registered easement. Check the ROW's maintenance clause and who pays for what — it binds you as owner.",
  },
  rear_lot: {
    label: "Rear lot (battle-axe)", bandIndex: 0, scoreRange: [3, 6],
    note: "Set behind another property down a long leg — quieter and more private, but with no street presence, awkward for deliveries and larger vehicles, and it resells to a narrower pool of buyers.",
  },
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Aspect from the facts: the compass direction sets the band, shading positions it. */
export function assessAspect(
  direction: AspectDirection | null | undefined,
  obstruction: SunObstruction | null | undefined
): {
  score: number;
  band: number;
  meta: (typeof ASPECT_DIRECTIONS)[AspectDirection];
  obstructionMeta: (typeof SUN_OBSTRUCTION)[SunObstruction];
} | null {
  if (!direction || !ASPECT_DIRECTIONS[direction]) return null;
  const meta = ASPECT_DIRECTIONS[direction];
  // No stated obstruction → assume an ordinary suburban site rather than guessing badly.
  const obs = SUN_OBSTRUCTION[obstruction ?? "partly_shaded"] ?? SUN_OBSTRUCTION.partly_shaded;
  const [lo, hi] = meta.scoreRange;
  return { score: clamp(Math.round(lo + (hi - lo) * obs.position), 1, 10), band: meta.bandIndex, meta, obstructionMeta: obs };
}

/** Frontage from the facts: the access type sets the band, the number sharing positions it. */
export function assessFrontage(
  accessType: AccessType | null | undefined,
  homesOnAccess: number | null | undefined
): { score: number; band: number; homes: number; meta: (typeof ACCESS_TYPES)[AccessType] } | null {
  if (!accessType || !ACCESS_TYPES[accessType]) return null;
  const meta = ACCESS_TYPES[accessType];
  const [lo, hi] = meta.scoreRange;
  const homes =
    homesOnAccess != null && Number.isFinite(homesOnAccess) ? clamp(Math.round(homesOnAccess), 1, 20) : 1;
  // Each extra household on the access costs a quarter of the band; 5+ bottoms out.
  const t = clamp(1 - (homes - 1) * 0.25, 0, 1);
  return { score: clamp(Math.round(lo + (hi - lo) * t), 1, 10), band: meta.bandIndex, homes, meta };
}

/** Trees from the facts: maturity sets the band, upkeep positions the item inside it. */
export function assessTrees(
  maturity: TreeMaturity | null | undefined,
  upkeep: TreeUpkeep | null | undefined
): {
  score: number;
  band: number;
  maturityMeta: (typeof TREE_MATURITY)[TreeMaturity];
  upkeepMeta: (typeof TREE_UPKEEP)[TreeUpkeep];
} | null {
  if (!maturity || !TREE_MATURITY[maturity]) return null;
  const m = TREE_MATURITY[maturity];
  // No stated upkeep → assume ordinary, kept-tidy grounds rather than guessing badly.
  const u = TREE_UPKEEP[upkeep ?? "tidy"] ?? TREE_UPKEEP.tidy;
  const [lo, hi] = m.scoreRange;
  return {
    score: clamp(Math.round(lo + (hi - lo) * u.position), 1, 10),
    band: m.bandIndex,
    maturityMeta: m,
    upkeepMeta: u,
  };
}

/** Shape from the facts: the named outline sets the points band, the workable share positions it within. */
export function assessShape(
  shapeType: ShapeType | null | undefined,
  workableLandPct: number | null | undefined
): { score: number; band: number; workablePct: number; meta: (typeof SHAPE_TYPES)[ShapeType] } | null {
  if (!shapeType || !SHAPE_TYPES[shapeType]) return null;
  const meta = SHAPE_TYPES[shapeType];
  const [wMin, wMax] = meta.workableRange;
  const [lo, hi] = meta.scoreRange;
  const workablePct =
    workableLandPct != null && Number.isFinite(workableLandPct)
      ? clamp(Math.round(workableLandPct), 0, 100)
      : meta.typicalWorkablePct;
  const t = wMax > wMin ? clamp((workablePct - wMin) / (wMax - wMin), 0, 1) : 0.5;
  return { score: clamp(Math.round(lo + (hi - lo) * t), 1, 10), band: meta.bandIndex, workablePct, meta };
}

/**
 * Topography from the facts: the gradient band sets the points band, the usable
 * share positions the item within it. Returns the usable area so the badge can
 * show something real (and it composes with the section size — 612m² → ~520m²).
 */
export function assessTopography(
  slopeBand: SlopeBand | null | undefined,
  usableLandPct: number | null | undefined,
  landAreaSqm?: number | null
): { score: number; band: number; usablePct: number; usableSqm: number | null; meta: (typeof SLOPE_BANDS)[SlopeBand] } | null {
  if (!slopeBand || !SLOPE_BANDS[slopeBand]) return null;
  const meta = SLOPE_BANDS[slopeBand];
  const [uMin, uMax] = meta.usableRange;
  const [lo, hi] = meta.scoreRange;
  const usablePct =
    usableLandPct != null && Number.isFinite(usableLandPct)
      ? clamp(Math.round(usableLandPct), 0, 100)
      : meta.typicalUsablePct;
  // Position within the band by how much of the site is actually usable.
  const t = uMax > uMin ? clamp((usablePct - uMin) / (uMax - uMin), 0, 1) : 0.5;
  const score = clamp(Math.round(lo + (hi - lo) * t), 1, 10);
  const land = landAreaSqm && landAreaSqm > 0 ? landAreaSqm : null;
  return {
    score,
    band: meta.bandIndex,
    usablePct,
    usableSqm: land ? Math.round((land * usablePct) / 100) : null,
    meta,
  };
}

/** Descriptive bands per land item, index 0 (poorest) → 3 (best). */
export const LAND_BANDS: Record<string, [string, string, string, string]> = {
  land_size: ["Compact", "Typical", "Large", "Very large"],
  land_topography: ["Steep", "Moderate slope", "Gentle slope", "Flat"],
  land_shape: ["Awkward", "Irregular", "Mostly regular", "Regular & usable"],
  land_aspect: ["Shaded", "Mixed sun", "Good sun", "North-facing"],
  land_frontage: ["ROW / rear lot", "Shared access", "Road frontage", "Prime frontage"],
  land_trees: ["Protected constraint", "Minimal planting", "Some established", "Established asset"],
};

/** Band index (0–3) from a 1–10 score. */
export function bandFromScore(score: number | null): number {
  if (score == null) return 1;
  if (score >= 9) return 3;
  if (score >= 7) return 2;
  if (score >= 4) return 1;
  return 0;
}

/** Section size scored objectively vs a typical lot → { score, band }. */
export function assessSectionSize(landAreaSqm: number | null): { score: number; band: number } {
  const land = landAreaSqm && landAreaSqm > 0 ? landAreaSqm : 0;
  if (!land) return { score: 5, band: 1 };
  const ratio = land / TYPICAL_SECTION_SQM;
  if (ratio >= 2.5) return { score: 10, band: 3 }; // very large
  if (ratio >= 1.4) return { score: 9, band: 2 }; // large
  if (ratio >= 0.75) return { score: 7, band: 1 }; // typical
  return { score: 4, band: 0 }; // compact
}

/** Descriptive band label for a land item (size and contour use their facts; the rest use the score). */
export function landBandLabel(
  id: string,
  score: number | null,
  landAreaSqm?: number | null,
  slopeBand?: SlopeBand | null,
  shapeType?: ShapeType | null,
  treeMaturity?: TreeMaturity | null,
  aspectDirection?: AspectDirection | null,
  accessType?: AccessType | null
): string {
  const bands = LAND_BANDS[id];
  if (!bands) return "";
  if (id === "land_size") return bands[assessSectionSize(landAreaSqm ?? null).band];
  // Prefer the AI's stated category over reverse-engineering one from the score.
  if (id === "land_topography" && slopeBand && SLOPE_BANDS[slopeBand]) return SLOPE_BANDS[slopeBand].label;
  if (id === "land_shape" && shapeType && SHAPE_TYPES[shapeType]) return SHAPE_TYPES[shapeType].label;
  if (id === "land_trees" && treeMaturity && TREE_MATURITY[treeMaturity]) return TREE_MATURITY[treeMaturity].label;
  if (id === "land_aspect" && aspectDirection && ASPECT_DIRECTIONS[aspectDirection]) return ASPECT_DIRECTIONS[aspectDirection].label;
  if (id === "land_frontage" && accessType && ACCESS_TYPES[accessType]) return ACCESS_TYPES[accessType].label;
  return bands[bandFromScore(score)];
}

/** Compact area for the badge — hectares once a section stops reading as m². */
function fmtArea(sqm: number): { value: string; unit: string } {
  if (sqm >= 10000) {
    const ha = sqm / 10000;
    return { value: ha < 10 ? ha.toFixed(1) : String(Math.round(ha)), unit: "ha" };
  }
  return { value: Math.round(sqm).toLocaleString("en-NZ"), unit: "m²" };
}

/**
 * Section size shows the ACTUAL AREA in the badge, not a 1–10 score — "7/10
 * section size" is meaningless to a buyer, whereas "612m²" is the fact they
 * came for. The band pill ("Typical") carries the judgement and the underlying
 * score is disclosed in the reasoning so the roll-up still reconciles.
 */
export function sectionSizeStat(
  landAreaSqm: number | null | undefined
): { value: string; unit: string; note: string } | null {
  const land = landAreaSqm && landAreaSqm > 0 ? landAreaSqm : null;
  if (!land) return null;
  const { score, band } = assessSectionSize(land);
  const { value, unit } = fmtArea(land);
  const label = LAND_BANDS.land_size[band];
  const ratio = land / TYPICAL_SECTION_SQM;
  const rel =
    ratio >= 1.1
      ? `about ${ratio.toFixed(1)}× a typical ${TYPICAL_SECTION_SQM}m² NZ section`
      : ratio <= 0.9
      ? `about ${Math.round(ratio * 100)}% of a typical ${TYPICAL_SECTION_SQM}m² NZ section`
      : `right on a typical ${TYPICAL_SECTION_SQM}m² NZ section`;
  return {
    value,
    unit,
    note: `${Math.round(land).toLocaleString("en-NZ")}m² — ${rel}, so it rates ${label} and contributes ${score}/10 to the Land score.`,
  };
}

/**
 * Topography badge — usable land, not a 1–10. Falls back to null (so the card
 * keeps its score badge) when the AI didn't give a gradient band or we have no
 * section area to apply the usable share to.
 */
export function topographyStat(
  slopeBand: SlopeBand | null | undefined,
  usableLandPct: number | null | undefined,
  landAreaSqm?: number | null
): { value: string; unit: string; note: string } | null {
  const t = assessTopography(slopeBand, usableLandPct, landAreaSqm);
  if (!t || t.usableSqm == null) return null;
  const area = fmtArea(t.usableSqm);
  const est = usableLandPct == null ? " (estimated from the gradient)" : "";
  return {
    value: `${area.value}${area.unit}`,
    unit: "usable",
    note:
      `${t.meta.label} — ${t.meta.gradient} (${t.meta.degrees}). About ${t.usablePct}% of the section` +
      `${est} is flat enough to use, roughly ${t.usableSqm.toLocaleString("en-NZ")}m² of ${Math.round(landAreaSqm as number).toLocaleString("en-NZ")}m². ` +
      `${t.meta.consequence} That contributes ${t.score}/10 to the Land score.`,
  };
}

/**
 * Shape badge — the share of the section left in a regular, workable block.
 * A percentage rather than m², deliberately: it reads as a different lens from
 * topography's usable area, and the two reductions are not additive.
 */
export function shapeStat(
  shapeType: ShapeType | null | undefined,
  workableLandPct: number | null | undefined,
  landAreaSqm?: number | null
): { value: string; unit: string; note: string } | null {
  const s = assessShape(shapeType, workableLandPct);
  if (!s) return null;
  const est = workableLandPct == null ? " (typical for this shape)" : "";
  const land = landAreaSqm && landAreaSqm > 0 ? landAreaSqm : null;
  const area = land ? ` — roughly ${Math.round((land * s.workablePct) / 100).toLocaleString("en-NZ")}m² of ${Math.round(land).toLocaleString("en-NZ")}m²` : "";
  return {
    value: `${s.workablePct}%`,
    unit: "workable",
    note:
      `${s.meta.label}. About ${s.workablePct}% of the section${est} sits in a regular block you can actually build on or lay out${area}. ` +
      `${s.meta.consequence} That contributes ${s.score}/10 to the Land score.`,
  };
}

/**
 * Trees badge — the upkeep you are signing up for. The maturity (the asset) sits
 * in the pill beside the item name, so the two facts read together: what you get,
 * and what it will ask of you.
 */
export function treesStat(
  maturity: TreeMaturity | null | undefined,
  upkeep: TreeUpkeep | null | undefined,
  protectedTree?: boolean
): { value: string; unit: string; note: string } | null {
  const t = assessTrees(maturity, upkeep);
  if (!t) return null;
  const assumed = upkeep == null ? " (assumed — the photos don't show the grounds clearly)" : "";
  const prot = protectedTree
    ? " A protected or notable tree is flagged here: it can't be pruned heavily or removed without council consent, which is a genuine constraint on any build or extension near it."
    : "";
  return {
    value: t.upkeepMeta.upkeep,
    unit: "upkeep",
    note:
      `${t.maturityMeta.label}, ${t.upkeepMeta.label.toLowerCase()}${assumed}. ${t.maturityMeta.asset} ` +
      `${t.upkeepMeta.consequence}${prot} Together that contributes ${t.score}/10 to the Land score.`,
  };
}

/** Aspect badge — the compass direction itself. The one fact everything else follows from. */
export function aspectStat(
  direction: AspectDirection | null | undefined,
  obstruction: SunObstruction | null | undefined
): { value: string; unit: string; note: string } | null {
  const a = assessAspect(direction, obstruction);
  if (!a) return null;
  const assumed = obstruction == null ? " (assumed — shading isn't clear from the photos)" : "";
  return {
    value: a.meta.short,
    unit: "facing",
    note:
      `${a.meta.label}, ${a.obstructionMeta.label}${assumed}. ${a.meta.note} ${a.obstructionMeta.note} ` +
      `That contributes ${a.score}/10 to the Land score. (How well the HOUSE is oriented to use this sun is scored separately under Sun & aspect on the Improvements tab.)`,
  };
}

/** Frontage badge — how many households share the access. Sole access is the good case. */
export function frontageStat(
  accessType: AccessType | null | undefined,
  homesOnAccess: number | null | undefined
): { value: string; unit: string; note: string } | null {
  const f = assessFrontage(accessType, homesOnAccess);
  if (!f) return null;
  const sole = f.homes <= 1;
  const sharing = sole
    ? "Nothing is shared — the access is yours alone."
    : `Shared with ${f.homes - 1} other ${f.homes - 1 === 1 ? "household" : "households"} (${f.homes} in total on the access), so upkeep is shared and so is the traffic past your windows.`;
  return {
    value: sole ? "Sole" : String(f.homes),
    unit: sole ? "access" : "on drive",
    note: `${f.meta.label}. ${f.meta.note} ${sharing} That contributes ${f.score}/10 to the Land score.`,
  };
}
