// ============================================================
// RoiQ SCORING MODEL — single source of truth (v4)
//
// The Condition & Quality Score measures the property itself, not lifestyle
// desirability. Three arms:
//   • BASE (0–1000)      — Improvements + Land + Legal, normalised.
//   • PENALTIES (−, cap 150) — objective location negatives (highway, flight
//                          path…), address-specific. See LOCATION_PENALTIES.
//   • BONUSES (+, cap 60)    — on-site value-adds (extra dwelling, pool).
//
// Location items stay in the model so the AI still assesses them, but they are
// FACTS ONLY (isFactsOnly) — shown to the buyer, never scored. The old Land
// hazards (flood, liquefaction, coastal, soil, fault, wind) are erased: too
// hard to judge reliably from a listing.
// ============================================================

export type Persona = "buyer" | "investor";
export type Inspection = "improvements" | "location" | "land" | "legal";

export interface ScoringSubItem {
  id: string;
  label: string;
  inspection: Inspection;
  category: string; // e.g. "Exterior", "Kitchen", "Schools & demand"
  buyerPoints: number; // max points for a Home Buyer
  investorPoints: number; // max points for an Investor
  conditional: boolean; // true = only scored when it applies to the property
  appliesWhen?: string; // human-readable rule for when a conditional item applies
  costBearing: boolean; // true = has a replacement cost (Renovations tab + hold-period logic)
  affectsHealthyHomes: boolean; // true = feeds the Healthy Homes module (investor)
}

export const SCORING_MODEL: ScoringSubItem[] = [
  // ========================================================
  // INSPECTION 1 — IMPROVEMENTS  (Buyer 506 / Investor 475)
  // ========================================================
  // --- Exterior (Buyer 230 / Investor 225) ---
  { id: "ext_foundation", label: "Foundation", inspection: "improvements", category: "Exterior", buyerPoints: 55, investorPoints: 52, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "ext_roof", label: "Roof", inspection: "improvements", category: "Exterior", buyerPoints: 48, investorPoints: 50, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "ext_cladding", label: "Cladding", inspection: "improvements", category: "Exterior", buyerPoints: 42, investorPoints: 44, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "ext_windows", label: "Windows & glazing", inspection: "improvements", category: "Exterior", buyerPoints: 28, investorPoints: 28, conditional: false, costBearing: true, affectsHealthyHomes: true },
  { id: "ext_decking", label: "Decking / balcony", inspection: "improvements", category: "Exterior", buyerPoints: 12, investorPoints: 6, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "ext_gutters", label: "Guttering & downpipes", inspection: "improvements", category: "Exterior", buyerPoints: 10, investorPoints: 11, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "ext_soffits", label: "Soffits & fascias", inspection: "improvements", category: "Exterior", buyerPoints: 9, investorPoints: 9, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "ext_doors", label: "Exterior doors / joinery", inspection: "improvements", category: "Exterior", buyerPoints: 8, investorPoints: 6, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "ext_paint", label: "Exterior paint & general condition", inspection: "improvements", category: "Exterior", buyerPoints: 8, investorPoints: 9, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "ext_chimney", label: "Chimney", inspection: "improvements", category: "Exterior", buyerPoints: 5, investorPoints: 5, conditional: true, appliesWhen: "Property has a chimney visible in photos or stated in listing", costBearing: true, affectsHealthyHomes: false },
  { id: "ext_solar", label: "Solar panels", inspection: "improvements", category: "Exterior", buyerPoints: 5, investorPoints: 5, conditional: true, appliesWhen: "Property has solar panels visible or stated", costBearing: false, affectsHealthyHomes: false },

  // --- Kitchen (Buyer 70 / Investor 55) ---
  { id: "kit_cabinetry", label: "Cabinetry", inspection: "improvements", category: "Kitchen", buyerPoints: 20, investorPoints: 15, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "kit_appliances", label: "Appliances (oven, cooktop, rangehood, dishwasher)", inspection: "improvements", category: "Kitchen", buyerPoints: 16, investorPoints: 13, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "kit_benchtop", label: "Benchtop", inspection: "improvements", category: "Kitchen", buyerPoints: 13, investorPoints: 9, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "kit_flooring", label: "Flooring", inspection: "improvements", category: "Kitchen", buyerPoints: 8, investorPoints: 8, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "kit_layout", label: "Layout & storage", inspection: "improvements", category: "Kitchen", buyerPoints: 6, investorPoints: 5, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "kit_sink", label: "Sink & tapware", inspection: "improvements", category: "Kitchen", buyerPoints: 4, investorPoints: 3, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "kit_splashback", label: "Splashback", inspection: "improvements", category: "Kitchen", buyerPoints: 3, investorPoints: 2, conditional: false, costBearing: true, affectsHealthyHomes: false },

  // --- Bathroom(s) (Buyer 65 / Investor 62) — scored per bathroom, then averaged ---
  { id: "bath_shower", label: "Shower / bath", inspection: "improvements", category: "Bathroom", buyerPoints: 16, investorPoints: 13, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "bath_waterproof", label: "Waterproofing (inferred)", inspection: "improvements", category: "Bathroom", buyerPoints: 15, investorPoints: 16, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "bath_hotwater", label: "Hot water system (cylinder / gas califont)", inspection: "improvements", category: "Bathroom", buyerPoints: 12, investorPoints: 13, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "bath_vanity", label: "Vanity & tapware", inspection: "improvements", category: "Bathroom", buyerPoints: 8, investorPoints: 5, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "bath_toilet", label: "Toilet", inspection: "improvements", category: "Bathroom", buyerPoints: 6, investorPoints: 4, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "bath_ventilation", label: "Ventilation / extraction", inspection: "improvements", category: "Bathroom", buyerPoints: 5, investorPoints: 8, conditional: false, costBearing: true, affectsHealthyHomes: true },
  { id: "bath_flooring", label: "Flooring", inspection: "improvements", category: "Bathroom", buyerPoints: 3, investorPoints: 3, conditional: false, costBearing: true, affectsHealthyHomes: false },

  // --- Living areas (Buyer 61 / Investor 63) ---
  { id: "liv_heating", label: "Heating (primary source)", inspection: "improvements", category: "Living areas", buyerPoints: 15, investorPoints: 20, conditional: false, costBearing: true, affectsHealthyHomes: true },
  { id: "liv_fixtures", label: "Lighting & electrical fixtures (fittings, switches, downlights)", inspection: "improvements", category: "Living areas", buyerPoints: 6, investorPoints: 5, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "liv_size", label: "Size & flow", inspection: "improvements", category: "Living areas", buyerPoints: 13, investorPoints: 9, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "liv_insulation", label: "Insulation (visible / inferred)", inspection: "improvements", category: "Living areas", buyerPoints: 10, investorPoints: 15, conditional: false, costBearing: true, affectsHealthyHomes: true },
  { id: "liv_light", label: "Natural light & aspect", inspection: "improvements", category: "Living areas", buyerPoints: 7, investorPoints: 5, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "liv_flooring", label: "Flooring", inspection: "improvements", category: "Living areas", buyerPoints: 6, investorPoints: 6, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "liv_ceiling", label: "Ceiling condition & height", inspection: "improvements", category: "Living areas", buyerPoints: 4, investorPoints: 3, conditional: false, costBearing: true, affectsHealthyHomes: false },

  // --- Bedrooms (Buyer 40 / Investor 35) — scored across all ---
  { id: "bed_size", label: "Size", inspection: "improvements", category: "Bedrooms", buyerPoints: 13, investorPoints: 12, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "bed_heating", label: "Heating source", inspection: "improvements", category: "Bedrooms", buyerPoints: 8, investorPoints: 6, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "bed_storage", label: "Wardrobe / storage", inspection: "improvements", category: "Bedrooms", buyerPoints: 7, investorPoints: 7, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "bed_windows", label: "Windows & natural light", inspection: "improvements", category: "Bedrooms", buyerPoints: 6, investorPoints: 5, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "bed_flooring", label: "Flooring", inspection: "improvements", category: "Bedrooms", buyerPoints: 4, investorPoints: 3, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "bed_ceiling", label: "Ceiling condition", inspection: "improvements", category: "Bedrooms", buyerPoints: 2, investorPoints: 2, conditional: false, costBearing: true, affectsHealthyHomes: false },

  // --- Garage (Buyer 25 / Investor 20) ---
  { id: "gar_type", label: "Type (single / double / internal access)", inspection: "improvements", category: "Garage", buyerPoints: 9, investorPoints: 8, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "gar_construction", label: "Construction", inspection: "improvements", category: "Garage", buyerPoints: 6, investorPoints: 5, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "gar_door", label: "Door & auto opener", inspection: "improvements", category: "Garage", buyerPoints: 4, investorPoints: 3, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "gar_floor", label: "Floor & condition", inspection: "improvements", category: "Garage", buyerPoints: 4, investorPoints: 2, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "gar_power", label: "Power / lighting", inspection: "improvements", category: "Garage", buyerPoints: 2, investorPoints: 2, conditional: false, costBearing: false, affectsHealthyHomes: false },

  // --- Outdoor & grounds (Buyer 15 / Investor 15) ---
  { id: "out_drainage", label: "Drainage (visible falls / ponding)", inspection: "improvements", category: "Outdoor & grounds", buyerPoints: 3, investorPoints: 4, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "out_driveway", label: "Driveway & access", inspection: "improvements", category: "Outdoor & grounds", buyerPoints: 4, investorPoints: 3, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "out_fencing", label: "Fencing", inspection: "improvements", category: "Outdoor & grounds", buyerPoints: 3, investorPoints: 4, conditional: false, costBearing: true, affectsHealthyHomes: false },
  { id: "out_landscaping", label: "Landscaping / gardens", inspection: "improvements", category: "Outdoor & grounds", buyerPoints: 2, investorPoints: 2, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "out_retaining", label: "Retaining walls", inspection: "improvements", category: "Outdoor & grounds", buyerPoints: 2, investorPoints: 1, conditional: true, appliesWhen: "Property has retaining walls visible or on site plan", costBearing: true, affectsHealthyHomes: false },
  { id: "out_pool", label: "Pool / spa", inspection: "improvements", category: "Outdoor & grounds", buyerPoints: 1, investorPoints: 1, conditional: true, appliesWhen: "Property has a pool or spa", costBearing: true, affectsHealthyHomes: false },

  // ========================================================
  // INSPECTION 2 — LOCATION — facts only, never scored (v4).
  // Trimmed to the 4 signals worth keeping; the messy subjective rest were removed.
  // These are surfaced on OTHER tabs, not their own: sun → Improvements (it's the
  // house), noise + views → Land, growth → Financial. No standalone Location tab.
  // ========================================================
  { id: "loc_growth", label: "Suburb growth trend & demand", inspection: "location", category: "Demand & lifestyle", buyerPoints: 30, investorPoints: 42, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "loc_sun", label: "Sun / aspect (orientation)", inspection: "location", category: "Demand & lifestyle", buyerPoints: 25, investorPoints: 10, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "loc_views", label: "Views & outlook", inspection: "location", category: "Demand & lifestyle", buyerPoints: 11, investorPoints: 8, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "loc_noise", label: "Noise sources (motorway, rail, flight path, industry)", inspection: "location", category: "Demand & lifestyle", buyerPoints: 8, investorPoints: 8, conditional: false, costBearing: false, affectsHealthyHomes: false },

  // ========================================================
  // INSPECTION 3 — LAND  (Buyer 62 / Investor 60) — hazards erased (v4)
  // Removed: flood, liquefaction, coastal, soil, fault, wind — too hard to
  // judge reliably from a listing. Only site-specific, judgeable items remain.
  // ========================================================
  { id: "land_size", label: "Section size", inspection: "land", category: "Hazard & site", buyerPoints: 18, investorPoints: 14, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_topography", label: "Topography / contour (flat vs steep)", inspection: "land", category: "Hazard & site", buyerPoints: 14, investorPoints: 9, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_aspect", label: "Aspect of land (north-facing slope etc.)", inspection: "land", category: "Hazard & site", buyerPoints: 10, investorPoints: 7, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_shape", label: "Shape & usability", inspection: "land", category: "Hazard & site", buyerPoints: 9, investorPoints: 6, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_subdivision", label: "Subdivision / development potential", inspection: "land", category: "Hazard & site", buyerPoints: 3, investorPoints: 14, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_frontage", label: "Frontage & access (ROW vs road frontage)", inspection: "land", category: "Hazard & site", buyerPoints: 5, investorPoints: 8, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_trees", label: "Established / protected trees & vegetation", inspection: "land", category: "Hazard & site", buyerPoints: 3, investorPoints: 2, conditional: false, costBearing: false, affectsHealthyHomes: false },

  // ========================================================
  // INSPECTION 4 — LEGAL  (Buyer 110 / Investor 130)
  // ========================================================
  { id: "leg_title", label: "Title type (freehold / cross-lease / unit / leasehold)", inspection: "legal", category: "Title & compliance", buyerPoints: 28, investorPoints: 30, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "leg_weathertight", label: "Weathertightness history (leaky-building era 1994–2004)", inspection: "legal", category: "Title & compliance", buyerPoints: 22, investorPoints: 24, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "leg_unconsented", label: "Unconsented works risk", inspection: "legal", category: "Title & compliance", buyerPoints: 18, investorPoints: 16, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "leg_consents", label: "Consents & code compliance (all structures)", inspection: "legal", category: "Title & compliance", buyerPoints: 14, investorPoints: 14, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "leg_eqc", label: "EQC / insurance claim history", inspection: "legal", category: "Title & compliance", buyerPoints: 9, investorPoints: 10, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "leg_bodycorp", label: "Body corporate (fees, minutes, disputes)", inspection: "legal", category: "Title & compliance", buyerPoints: 6, investorPoints: 18, conditional: true, appliesWhen: "Title is unit title, or cross-lease with an active body corporate", costBearing: false, affectsHealthyHomes: false },
  { id: "leg_easements", label: "Easements & covenants on title", inspection: "legal", category: "Title & compliance", buyerPoints: 5, investorPoints: 6, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "leg_crosslease", label: "Cross-lease defects (flats plan accuracy)", inspection: "legal", category: "Title & compliance", buyerPoints: 4, investorPoints: 5, conditional: true, appliesWhen: "Title is cross-lease", costBearing: false, affectsHealthyHomes: false },
  { id: "leg_lim", label: "LIM red flags", inspection: "legal", category: "Title & compliance", buyerPoints: 2, investorPoints: 4, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "leg_encumbrances", label: "Encumbrances / caveats", inspection: "legal", category: "Title & compliance", buyerPoints: 2, investorPoints: 3, conditional: false, costBearing: false, affectsHealthyHomes: false },
];

const ITEM_INSPECTION: Record<string, Inspection> = Object.fromEntries(
  SCORING_MODEL.map((i) => [i.id, i.inspection])
);

/** Location items are FACTS ONLY (v4) — assessed and shown to the buyer, but never
 * scored, because location desirability is subjective. Everything else (Improvements,
 * the trimmed Land items, and all Legal) scores toward the base. Pool is excluded from
 * the base too — it feeds the on-site value-add bonus instead. */
export const isFactsOnly = (id: string): boolean => ITEM_INSPECTION[id] === "location";

// ── Location penalties (v4) — objective negatives that hurt resale for almost
//    everyone. Subtract only, address-specific, scaled by severity (0–10), capped.
export interface LocationPenalty {
  id: string;
  label: string;
  maxDeduction: number; // full deduction at severity 10
  appliesWhen: string;
}

export const LOCATION_PENALTIES: LocationPenalty[] = [
  { id: "pen_highway", label: "Busy road / highway frontage", maxDeduction: 60, appliesWhen: "On or directly facing a busy road / motorway; scales down with distance" },
  { id: "pen_flightpath", label: "Under / near flight path", maxDeduction: 45, appliesWhen: "Within an airport noise contour / under a flight path" },
  { id: "pen_rail", label: "Rail line adjacent", maxDeduction: 38, appliesWhen: "Adjacent or very close to an active rail line" },
  { id: "pen_industrial", label: "Industrial / heavy-commercial neighbour", maxDeduction: 38, appliesWhen: "Directly neighbouring industrial or heavy-commercial land" },
  { id: "pen_pylons", label: "High-voltage lines / pylons overhead", maxDeduction: 30, appliesWhen: "High-voltage transmission lines / pylons over or beside the site" },
  { id: "pen_nosun", label: "No sun / permanently shaded site", maxDeduction: 23, appliesWhen: "South-facing / shaded site with poor sun, especially in winter" },
];

export const PENALTY_CAP = 150; // max total location deduction
export const BONUS_CAP = 60; // max total on-site value-add bonus
export const POOL_BONUS_MAX = 12; // pool / spa bonus at perfect condition
