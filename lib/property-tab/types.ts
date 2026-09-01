export type ConfidenceTier = 1 | 2 | 3;

export type UrgencyScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Quality / spec tier of an improvement's materials & finish. In v5 this is the
 * PRIMARY driver of an Improvements item's score: the tier sets a capped points
 * band and condition positions the item inside it (a tiled bathroom and a vinyl
 * one can both be 10/10 condition but sit at very different tiers). It also drives
 * the improvement value. `deteriorated` = the item is absent, broken, or so worn
 * it needs full replacement, regardless of its original spec. */
export type SpecTier = "deteriorated" | "dated" | "modern" | "luxury";

/** Site slope, banded to the standard NZ gradient ranges. Asked of the AI directly
 * (it IS readable from photos + aerials) instead of an unverifiable 1–10, so the
 * topography score becomes a derivation rather than an opinion. */
export type SlopeBand = "flat" | "gentle" | "moderate" | "steep";

/** Section outline, read off the title diagram or an aerial. Shape is a CATEGORY,
 * not a quantity — so we name it honestly and derive the score from the name plus
 * how much of the section the shape leaves in a workable block. */
/** Which way the SECTION faces. This is the site fact; how well the HOUSE captures
 * that sun is scored separately under Improvements (loc_sun) — a north section can
 * still carry a badly-oriented house. */
export type AspectDirection =
  | "north"
  | "north_east"
  | "north_west"
  | "east"
  | "west"
  | "south_east"
  | "south_west"
  | "south";

/** What actually blocks the sun the aspect promises — hill, neighbour, canopy. */
export type SunObstruction = "open" | "partly_shaded" | "heavily_shaded";

/** How you physically get to the property, off the title / aerial. */
export type AccessType =
  | "prime_frontage"
  | "corner_site"
  | "road_frontage"
  | "shared_driveway"
  | "right_of_way"
  | "rear_lot";

/** How far along the planting is — the asset side of trees & vegetation. */
export type TreeMaturity = "bare" | "young" | "established" | "mature";
/** What state it has been kept in — the liability side. Together these set the score. */
export type TreeUpkeep = "well_maintained" | "tidy" | "overgrown" | "neglected";

export type ShapeType =
  | "rectangular"
  | "square"
  | "wide_frontage"
  | "long_narrow"
  | "l_shaped"
  | "wedge"
  | "rear_lot"
  | "irregular";

export interface ReplacementCost {
  low: number;
  high: number;
  notes: string;
}

// ── v3.2 sourced-reasoning fields (Location / Land / Legal) ──────────────────

export type SourceType =
  | "photo"
  | "council_data"
  | "linz"
  | "title"
  | "lim"
  | "gns"
  | "market_data"
  | "map_poi"
  | "moe_zones"
  | "inference";

/** Present only when a specific Location/Land/Legal finding is genuinely fixable. */
export interface Remediation {
  description: string; // e.g. "Certificate of Acceptance for rear studio"
  low: number;
  mid: number;
  high: number;
  urgencyYears: number; // for hold-period gating
  renovationLineItem: string; // label shown in the Renovations tab
}

export interface SubItem {
  id: string;
  name: string;
  /**
   * What the thing is made of, when that is a sensible question and we know the
   * answer. Undefined for items where "material" means nothing — appliances are
   * a brand and a type, heating is an appliance, layout is a shape — and for
   * anything nobody could see, since the material of an unphotographed item is
   * a guess.
   */
  material?: string;
  estimatedAge: string;
  condition: string;
  score: UrgencyScore | null;          // null = Tier 3 unscored
  urgencyLabel: string;
  confidenceTier: ConfidenceTier;
  evidenceSource: string;
  aiSummary: string;
  estimatedReplacementCost: ReplacementCost | null;
  replacementCostWeight: number;       // 0–1, fraction of category score
  specTier?: SpecTier;                 // quality/spec of the materials (Improvements) — drives building value
  observedDefect?: string;             // what's actually VISIBLE in this property's photos that needs work
  estimatedSqm?: number;               // for size/area items — the estimated area in m² (shown instead of material/age)

  slopeBand?: SlopeBand;               // land_topography only — the measured-ish fact behind its score
  usableLandPct?: number;              // land_topography only — 0–100, share of the section flat enough to use
  shapeType?: ShapeType;               // land_shape only — the named outline its score derives from
  workableLandPct?: number;            // land_shape only — 0–100, share left in a regular, workable block
  treeMaturity?: TreeMaturity;         // land_trees only — how established the planting is
  treeUpkeep?: TreeUpkeep;             // land_trees only — what state it has been kept in
  treesProtected?: boolean;            // land_trees only — a protected/notable tree constrains removal
  aspectDirection?: AspectDirection;   // land_aspect only — which way the section faces
  sunObstruction?: SunObstruction;     // land_aspect only — what blocks the sun that aspect promises
  accessType?: AccessType;             // land_frontage only — how you get to the property
  homesOnAccess?: number;              // land_frontage only — dwellings using the driveway, incl. this one
  renovationLink: boolean;
  healthyHomesLink: boolean;
  photoReferences: number[];

  // Set when a visual item's score was stripped because the listing had 0 photos —
  // the card then shows an "upload photos to assess" prompt instead of a score.
  noPhotoNotAssessed?: boolean;

  // v3.2 — populated for Location/Land/Legal items (and optionally Improvements).
  finding?: string;                    // one-line status, e.g. "Low — not in mapped flood plain"
  source?: string;                     // specific named source, e.g. "Auckland Council flood-hazard overlay"
  sourceType?: SourceType;
  verifyAgainst?: string;              // e.g. "LIM", "record of title"
  remediation?: Remediation | null;    // present only when the finding is fixable
}

export interface Category {
  id: string;
  name: string;
  icon: string;                        // emoji icon for display
  weight: number;                      // 0–1, fraction of overall score (excl. extra dwellings)
  subItems: SubItem[];
}

/** The 5 Healthy Homes standards, as they apply to a habitable extra dwelling. */
export type DwellingHHStandard = "heating" | "insulation" | "ventilation" | "moisture" | "draught";
/** met = visible evidence · not_visible = can't tell from photos, verify · absent = clearly not there. */
export type DwellingHHStatus = "met" | "not_visible" | "absent";

export interface DwellingHealthyHomes {
  standard: DwellingHHStandard;
  status: DwellingHHStatus;
  note?: string;
}

export interface ExtraDwelling {
  id: string;
  type: string;
  sizeEstimate: string;
  construction: string;
  condition: string;
  score: UrgencyScore;
  estimatedReplacementCost: ReplacementCost;
  consentStatus: "consented" | "unconsented" | "unknown";
  aiSummary: string;
  photoReferences: number[];
  /** True when someone could sleep in it — then it's a dwelling, not a shed, and
   * Healthy Homes applies if it's rented. */
  habitable?: boolean;
  /** What kind of structure it is — drives the cost basis and value retention.
   * See lib/scoring/structures.ts. */
  structureType?: import("@/lib/scoring/structures").StructureType;
  /** Numeric floor area (m²) — valued off this whenever the listing states it. */
  sizeSqm?: number;
  /** Bedroom count (0 = studio / open plan). */
  bedrooms?: number;
  /** Has its own kitchen AND bathroom, so it can be let independently. */
  selfContained?: boolean;
  /** Material risks an investor must know about (unconsented sleeping space, damp…). */
  redFlags?: string[];
  /** Per-standard Healthy Homes read — only meaningful when habitable. */
  healthyHomes?: DwellingHealthyHomes[];
}

export interface PropertyTabData {
  categories: Category[];
  extraDwellings: ExtraDwelling[];
  overallScore: number;
}

/** Bridge that lets an Improvements item card add/remove itself from the
 * renovation plan (state lives in the report view, shared with the Reno tab). */
export interface RenoControls {
  has: (id: string) => boolean; // true when this item can be renovated (has a reno line)
  included: (id: string) => boolean; // is it currently in the plan
  toggle: (id: string, on: boolean) => void;
}

// ── Urgency helpers ────────────────────────────────────────────────────────

export function urgencyLabel(score: UrgencyScore | null): string {
  if (score === null) return "Not assessed — inspect";
  const labels: Record<number, string> = {
    10: "Brand new — no action needed",
    9:  "Excellent — no action needed",
    8:  "Very good — monitor only",
    7:  "Good — inspect every 2–3 years",
    6:  "Fair — plan replacement within 5–7 years",
    5:  "Average — plan replacement within 3–5 years",
    4:  "Below average — replace within 2–3 years",
    3:  "Poor — replace within 1–2 years",
    2:  "Very poor — replace urgently (within 12 months)",
    1:  "Critical — immediate action required",
  };
  return labels[score] ?? "Unknown";
}

// Years until replacement is needed, derived from the urgency score.
// Upper bound of each label's range (spec 5.5); 99 = no replacement within any hold period.
export function urgencyScoreToYears(score: UrgencyScore | null): number {
  if (score === null) return 99;
  const years: Record<number, number> = {
    10: 99, 9: 99, 8: 99, 7: 99,
    6: 7,  // plan replacement within 5–7 years
    5: 5,  // 3–5 years
    4: 3,  // 2–3 years
    3: 2,  // 1–2 years
    2: 1,  // within 12 months
    1: 0,  // immediate
  };
  return years[score] ?? 99;
}

export function urgencyColor(score: UrgencyScore | null): "green" | "amber" | "red" | "muted" {
  if (score === null) return "muted";
  if (score >= 8) return "green";
  if (score >= 5) return "amber";
  return "red";
}

export function worstSubItemScore(category: Category): UrgencyScore | null {
  const scored = category.subItems.filter((s) => s.score !== null);
  if (scored.length === 0) return null;
  return Math.min(...scored.map((s) => s.score as number)) as UrgencyScore;
}

// Note: the overall quality score now lives in the v3.1 engine
// (lib/scoring/engine.ts → scoreProperty). The old fractional calcOverallScore /
// calcCategoryScore have been removed; this file keeps only the display types
// and urgency helpers that the Improvements UI shares.
