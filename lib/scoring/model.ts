// ============================================================
// RoiQ SCORING MODEL — single source of truth (v3.1)
// Both buyerPoints and investorPoints columns sum to 1,000.
//
// Four inspections: Improvements, Location, Land, Legal.
// There is NO Services category. Hot water is scored under Bathroom.
// Replaces the earlier cost-weighted 8-category model in lib/property-tab/scoring.ts.
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
  // INSPECTION 1 — IMPROVEMENTS  (Buyer 500 / Investor 470)
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

  // --- Living areas (Buyer 55 / Investor 58) ---
  { id: "liv_heating", label: "Heating (primary source)", inspection: "improvements", category: "Living areas", buyerPoints: 15, investorPoints: 20, conditional: false, costBearing: true, affectsHealthyHomes: true },
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
  // INSPECTION 2 — LOCATION  (Buyer 220 / Investor 240)
  // ========================================================
  { id: "loc_schools", label: "School zones & quality", inspection: "location", category: "Demand & lifestyle", buyerPoints: 45, investorPoints: 28, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "loc_growth", label: "Suburb growth trend & demand", inspection: "location", category: "Demand & lifestyle", buyerPoints: 30, investorPoints: 42, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "loc_sun", label: "Sun / aspect (orientation)", inspection: "location", category: "Demand & lifestyle", buyerPoints: 25, investorPoints: 10, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "loc_amenities", label: "Proximity to amenities (shops, supermarket, cafés)", inspection: "location", category: "Demand & lifestyle", buyerPoints: 22, investorPoints: 22, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "loc_street", label: "Street quality & neighbouring properties", inspection: "location", category: "Demand & lifestyle", buyerPoints: 20, investorPoints: 16, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "loc_employment", label: "Distance to employment / CBD", inspection: "location", category: "Demand & lifestyle", buyerPoints: 12, investorPoints: 28, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "loc_transport", label: "Public transport access", inspection: "location", category: "Demand & lifestyle", buyerPoints: 11, investorPoints: 24, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "loc_walkability", label: "Walkability", inspection: "location", category: "Demand & lifestyle", buyerPoints: 15, investorPoints: 18, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "loc_parks", label: "Proximity to parks & recreation", inspection: "location", category: "Demand & lifestyle", buyerPoints: 13, investorPoints: 10, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "loc_views", label: "Views & outlook", inspection: "location", category: "Demand & lifestyle", buyerPoints: 11, investorPoints: 8, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "loc_noise", label: "Noise sources (motorway, rail, flight path, industry)", inspection: "location", category: "Demand & lifestyle", buyerPoints: 8, investorPoints: 8, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "loc_safety", label: "Crime / safety profile", inspection: "location", category: "Demand & lifestyle", buyerPoints: 5, investorPoints: 14, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "loc_future", label: "Future development / zoning changes nearby", inspection: "location", category: "Demand & lifestyle", buyerPoints: 3, investorPoints: 12, conditional: false, costBearing: false, affectsHealthyHomes: false },

  // ========================================================
  // INSPECTION 3 — LAND  (Buyer 170 / Investor 160)
  // ========================================================
  { id: "land_flood", label: "Flood risk", inspection: "land", category: "Hazard & site", buyerPoints: 30, investorPoints: 30, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_liquefaction", label: "Liquefaction risk (TC zoning)", inspection: "land", category: "Hazard & site", buyerPoints: 26, investorPoints: 24, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_coastal", label: "Coastal hazard / erosion risk", inspection: "land", category: "Hazard & site", buyerPoints: 22, investorPoints: 20, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_size", label: "Section size", inspection: "land", category: "Hazard & site", buyerPoints: 18, investorPoints: 14, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_topography", label: "Topography / contour (flat vs steep)", inspection: "land", category: "Hazard & site", buyerPoints: 14, investorPoints: 9, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_soil", label: "Soil & ground stability", inspection: "land", category: "Hazard & site", buyerPoints: 13, investorPoints: 12, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_fault", label: "Fault line proximity", inspection: "land", category: "Hazard & site", buyerPoints: 11, investorPoints: 10, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_aspect", label: "Aspect of land (north-facing slope etc.)", inspection: "land", category: "Hazard & site", buyerPoints: 10, investorPoints: 7, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_shape", label: "Shape & usability", inspection: "land", category: "Hazard & site", buyerPoints: 9, investorPoints: 6, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_subdivision", label: "Subdivision / development potential", inspection: "land", category: "Hazard & site", buyerPoints: 3, investorPoints: 14, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_frontage", label: "Frontage & access (ROW vs road frontage)", inspection: "land", category: "Hazard & site", buyerPoints: 5, investorPoints: 8, conditional: false, costBearing: false, affectsHealthyHomes: false },
  { id: "land_wind", label: "Wind / elements exposure", inspection: "land", category: "Hazard & site", buyerPoints: 6, investorPoints: 4, conditional: false, costBearing: false, affectsHealthyHomes: false },
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

/** Location/Land items that describe the TOWN, not this specific address — shown in the
 * City/Town tab and EXCLUDED from the 1000-point score (they're the same for any address
 * in the town). Everything else (site-specific Location/Land + all Legal) scores in the
 * Address tab. */
export const TOWN_CONTEXT_IDS = new Set<string>([
  "loc_schools", "loc_growth", "loc_amenities", "loc_employment", "loc_transport", "loc_safety", "loc_future",
  "land_flood", "land_liquefaction", "land_coastal", "land_fault", "land_soil", "land_wind",
]);

/** True when a sub-item is town-wide context (shown in City/Town, not scored). */
export const isTownContext = (id: string): boolean => TOWN_CONTEXT_IDS.has(id);
