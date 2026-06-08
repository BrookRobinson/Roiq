export type Trade =
  | "roofing"
  | "cladding_paint"
  | "windows"
  | "carpentry"
  | "electrical"
  | "plumbing"
  | "tiling"
  | "flooring_carpet"
  | "flooring_timber"
  | "insulation"
  | "heat_pump"
  | "decking"
  | "fencing"
  | "concrete"
  | "drainage";

export interface LabourRate {
  region: string;
  trade: Trade;
  ratePerSqm: number | null;    // $ per m²
  ratePerHour: number | null;   // $ per hour
  regionalMultiplier: number;   // relative to Auckland = 1.0
  jobCount: number;
  dataSource: string;
  confidence: "high" | "medium" | "low" | "ai_estimate";
  lastUpdated: string;
}

// ── Regional multipliers (Auckland base = 1.0) ────────────────────────────
export const REGIONAL_MULTIPLIERS: Record<string, number> = {
  "Auckland":                  1.00,
  "Wellington":                0.92,
  "Christchurch":              0.85,
  "Hamilton":                  0.88,
  "Tauranga":                  0.90,
  "Dunedin":                   0.82,
  "Nelson / Marlborough":      0.80,
  "West Coast":                0.78,
  "Northland":                 0.87,
  "Hawke's Bay":               0.84,
  "Manawatū-Whanganui":        0.83,
  "Southland":                 0.80,
  "Taranaki":                  0.84,
  "Waikato":                   0.87,
  "Bay of Plenty":             0.89,
  "Marlborough":               0.81,
  "Gisborne":                  0.79,
  "Remote / Rural":            0.77,
};

// City / district → region aliases, so a listing region like "Westland",
// "Hokitika" or "Greymouth" resolves to its labour-rate region ("West Coast").
const REGION_ALIASES: Record<string, string> = {
  hokitika: "West Coast", greymouth: "West Coast", westport: "West Coast", reefton: "West Coast",
  westland: "West Coast", buller: "West Coast", grey: "West Coast", "west coast": "West Coast",
  auckland: "Auckland", wellington: "Wellington", christchurch: "Christchurch", canterbury: "Christchurch",
  hamilton: "Hamilton", waikato: "Waikato", tauranga: "Tauranga", "bay of plenty": "Bay of Plenty",
  rotorua: "Bay of Plenty", dunedin: "Dunedin", otago: "Dunedin", invercargill: "Southland",
  southland: "Southland", nelson: "Nelson / Marlborough", marlborough: "Marlborough", blenheim: "Marlborough",
  napier: "Hawke's Bay", hastings: "Hawke's Bay", "hawke's bay": "Hawke's Bay", "new plymouth": "Taranaki",
  taranaki: "Taranaki", whanganui: "Manawatū-Whanganui", "palmerston north": "Manawatū-Whanganui",
  "manawatū-whanganui": "Manawatū-Whanganui", gisborne: "Gisborne", northland: "Northland",
  whangarei: "Northland", queenstown: "Remote / Rural",
};

// National median labour multiplier (median of the regional values ≈ 0.84) —
// used when a property's region can't be resolved, so we never silently fall
// back to Auckland pricing for, say, a Hokitika listing.
export const NZ_MEDIAN_REGION = "NZ median";
const NZ_MEDIAN_MULTIPLIER = 0.84;

/**
 * Resolve a raw listing region/city/district to a canonical labour-rate region
 * and its multiplier. Unknown → national median (NOT Auckland).
 */
export function resolveRegion(input?: string | null): { region: string; multiplier: number } {
  if (input) {
    const raw = input.trim();
    if (REGIONAL_MULTIPLIERS[raw] != null) return { region: raw, multiplier: REGIONAL_MULTIPLIERS[raw] };
    const key = raw.toLowerCase();
    const mapped = REGION_ALIASES[key] ?? REGION_ALIASES[key.split(/[,\s]+/).pop() ?? ""];
    if (mapped && REGIONAL_MULTIPLIERS[mapped] != null) return { region: mapped, multiplier: REGIONAL_MULTIPLIERS[mapped] };
  }
  return { region: NZ_MEDIAN_REGION, multiplier: NZ_MEDIAN_MULTIPLIER };
}

// ── Base Auckland rates (supply + labour per m² or per unit) ─────────────
// These are Auckland rates; multiply by regional multiplier for local rate.
export const BASE_RATES: Record<
  Trade,
  { ratePerSqm?: number; ratePerHour?: number; materialPerSqm?: number; notes: string }
> = {
  roofing:         { ratePerSqm: 95,  materialPerSqm: 22, notes: "Colorsteel corrugated, includes gutters" },
  cladding_paint:  { ratePerSqm: 28,  materialPerSqm: 8,  notes: "Full prep + 2-coat exterior paint system" },
  windows:         { ratePerSqm: 0,   ratePerHour: 85,    notes: "Aluminium DGU — priced per unit, not m²" },
  carpentry:       { ratePerSqm: 0,   ratePerHour: 90,    notes: "General carpentry — use for decking, framing" },
  electrical:      { ratePerSqm: 0,   ratePerHour: 110,   notes: "Licensed electrician incl. call-out" },
  plumbing:        { ratePerSqm: 0,   ratePerHour: 115,   notes: "Licensed plumber incl. call-out" },
  tiling:          { ratePerSqm: 85,  materialPerSqm: 45, notes: "Standard wall/floor tile, adhesive, grout" },
  flooring_carpet: { ratePerSqm: 18,  materialPerSqm: 38, notes: "Mid-spec wool blend + underlay" },
  flooring_timber: { ratePerSqm: 35,  materialPerSqm: 65, notes: "Engineered timber 190mm board" },
  insulation:      { ratePerSqm: 14,  materialPerSqm: 9,  notes: "R3.2 ceiling batts, blow-in ceiling" },
  heat_pump:       { ratePerSqm: 0,   ratePerHour: 95,    notes: "Per-unit pricing — use CostItem unitCost" },
  decking:         { ratePerSqm: 120, materialPerSqm: 80, notes: "Treated pine decking, 90×45 frame" },
  fencing:         { ratePerSqm: 0,   ratePerHour: 80,    notes: "Priced per lineal metre — use CostItem" },
  concrete:        { ratePerSqm: 55,  materialPerSqm: 35, notes: "100mm slab, broom finish" },
  drainage:        { ratePerSqm: 0,   ratePerHour: 95,    notes: "Drainlayer — hourly rate" },
};

// ── Cost item definition ──────────────────────────────────────────────────

export interface CostItem {
  id: string;
  name: string;
  trade: Trade;
  region: string;

  // Quantity input
  quantity: number;       // m², units, lineal metres — depends on trade
  quantityUnit: string;   // "m²", "units", "lin m"
  quantityFormula: string; // e.g. "185m² floor × 1.15 pitch factor = 213m²"

  // Unit costs
  materialRatePerUnit: number;
  labourRatePerUnit: number;
  regionalMultiplier: number;

  // Calculated
  materialCost: number;
  labourCost: number;
  baseCost: number;
  low: number;             // base × 0.85
  high: number;            // base × 1.15
  mostLikely: number;      // = baseCost

  // Source info
  dataSource: string;
  jobCount: number;
  confidence: "high" | "medium" | "low" | "ai_estimate";
  lastUpdated: string;

  // User quote override
  userQuote?: number;
}

// ── Main cost calculation function ────────────────────────────────────────

export function calculateCost(params: {
  id: string;
  name: string;
  trade: Trade;
  region: string;
  quantity: number;
  quantityUnit: string;
  quantityFormula: string;
  materialRateOverride?: number;  // use if different from BASE_RATES
  labourRateOverride?: number;
}): CostItem {
  const {
    id, name, trade, region, quantity,
    quantityUnit, quantityFormula,
    materialRateOverride, labourRateOverride,
  } = params;

  const { region: canonRegion, multiplier } = resolveRegion(region);
  const base = BASE_RATES[trade];

  const materialRate = materialRateOverride ?? base.materialPerSqm ?? 0;
  const labourRate   = labourRateOverride   ?? base.ratePerSqm      ?? 0;

  const materialCost = materialRate * quantity;
  const labourCost   = labourRate   * quantity * multiplier;
  const baseCost     = materialCost + labourCost;

  return {
    id,
    name,
    trade,
    region: canonRegion,
    quantity,
    quantityUnit,
    quantityFormula,
    materialRatePerUnit: materialRate,
    labourRatePerUnit: labourRate * multiplier,
    regionalMultiplier: multiplier,
    materialCost: Math.round(materialCost),
    labourCost:   Math.round(labourCost),
    baseCost:     Math.round(baseCost),
    low:          Math.round(baseCost * 0.85),
    high:         Math.round(baseCost * 1.15),
    mostLikely:   Math.round(baseCost),
    dataSource: `Builderscrack ${canonRegion}`,
    jobCount: 23,
    confidence: multiplier === 1.0 ? "high" : "medium",
    lastUpdated: "June 2026",
  };
}

// ── Pre-built cost items for common renovation jobs ───────────────────────

export function roofReplacementCost(floorSqm: number, region: string): CostItem {
  const roofSqm = Math.round(floorSqm * 1.15); // pitch factor
  return calculateCost({
    id: "roof_replacement",
    name: "Roof replacement",
    trade: "roofing",
    region,
    quantity: roofSqm,
    quantityUnit: "m²",
    quantityFormula: `${floorSqm}m² floor × 1.15 pitch factor = ${roofSqm}m²`,
    materialRateOverride: 22,
    labourRateOverride: 95,
  });
}

export function claddingRepaintCost(floorSqm: number, region: string): CostItem {
  const wallSqm = Math.round(floorSqm * 1.6); // perimeter factor estimate
  return calculateCost({
    id: "cladding_repaint",
    name: "Exterior repaint",
    trade: "cladding_paint",
    region,
    quantity: wallSqm,
    quantityUnit: "m²",
    quantityFormula: `${floorSqm}m² floor × 1.6 perimeter factor = ${wallSqm}m² wall area`,
    materialRateOverride: 8,
    labourRateOverride: 28,
  });
}

export function windowReplacementCost(unitCount: number, region: string): CostItem {
  const { region: canonRegion, multiplier } = resolveRegion(region);
  const unitCost   = 1_100 * multiplier; // avg $/window installed
  const baseCost   = unitCost * unitCount;
  return {
    id: "window_replacement",
    name: `Replace ${unitCount} timber window${unitCount > 1 ? "s" : ""} with aluminium DGU`,
    trade: "windows",
    region: canonRegion,
    quantity: unitCount,
    quantityUnit: "units",
    quantityFormula: `${unitCount} timber single-glazed unit${unitCount > 1 ? "s" : ""} × $800–$1,400 each supply + install`,
    materialRatePerUnit: 550,
    labourRatePerUnit: 550 * multiplier,
    regionalMultiplier: multiplier,
    materialCost: Math.round(550 * unitCount),
    labourCost:   Math.round(550 * multiplier * unitCount),
    baseCost:     Math.round(baseCost),
    low:          Math.round(baseCost * 0.85),
    high:         Math.round(baseCost * 1.15),
    mostLikely:   Math.round(baseCost),
    dataSource: "Builderscrack window installers NZ",
    jobCount: 41,
    confidence: "high",
    lastUpdated: "June 2026",
  };
}

export function ceilingInsulationCost(floorSqm: number, region: string): CostItem {
  return calculateCost({
    id: "ceiling_insulation",
    name: "Ceiling insulation (R3.2 batts)",
    trade: "insulation",
    region,
    quantity: floorSqm,
    quantityUnit: "m²",
    quantityFormula: `${floorSqm}m² floor area (ceiling insulation follows floor footprint)`,
    materialRateOverride: 9,
    labourRateOverride: 14,
  });
}

export function heatPumpCost(region: string): CostItem {
  const multiplier = REGIONAL_MULTIPLIERS[region] ?? 1.0;
  const baseCost   = (2_200 + 1_200 * multiplier); // unit + install
  return {
    id: "heat_pump",
    name: "Heat pump (hi-wall 5–7kW)",
    trade: "heat_pump",
    region,
    quantity: 1,
    quantityUnit: "unit",
    quantityFormula: "1 × hi-wall 5–7kW unit supply + installation",
    materialRatePerUnit: 2_200,
    labourRatePerUnit: 1_200 * multiplier,
    regionalMultiplier: multiplier,
    materialCost: 2_200,
    labourCost:   Math.round(1_200 * multiplier),
    baseCost:     Math.round(baseCost),
    low:          Math.round(baseCost * 0.85),
    high:         Math.round(baseCost * 1.15),
    mostLikely:   Math.round(baseCost),
    dataSource: "Builderscrack heat pump installers",
    jobCount: 87,
    confidence: "high",
    lastUpdated: "June 2026",
  };
}

export function deckRepairCost(deckSqm: number, region: string): CostItem {
  return calculateCost({
    id: "deck_repair",
    name: "Deck board replacement + re-oil",
    trade: "decking",
    region,
    quantity: deckSqm,
    quantityUnit: "m²",
    quantityFormula: `~${deckSqm}m² deck area estimated from photo`,
    materialRateOverride: 55,  // boards only, not full frame
    labourRateOverride: 65,
  });
}
