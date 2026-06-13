// ============================================================
// RoiQ — three-tier renovation costing (v3.7)
// Every flagged reno item gets three options:
//   Patch Up        — cheap short-term fix (bespoke repair materials)
//   Replace Budget  — full replacement using the `budget` MATERIALS_DB option
//   Replace High End— full replacement using the `premium` MATERIALS_DB option
// Each tier is itemised (materials with source + line totals) and has a
// DIY (materials only) vs Pay-someone (adds labour at trade rates) mode.
// All prices come from lib/materials-db.ts. Deterministic + pure.
// ============================================================

import { MATERIALS_DB } from "@/lib/materials-db";

export type Tier = "patch" | "budget" | "premium";
export type LabourMode = "diy" | "tradie";

export const TIER_ORDER: Tier[] = ["patch", "budget", "premium"];
export const TIER_META: Record<Tier, { label: string; icon: string; defaultLabour: LabourMode }> = {
  patch: { label: "Patch Up", icon: "🩹", defaultLabour: "diy" },
  budget: { label: "Replace Budget", icon: "🔨", defaultLabour: "tradie" },
  premium: { label: "Replace High End", icon: "✨", defaultLabour: "tradie" },
};

// Labour rates by trade ($/hr) — per spec.
export type Trade =
  | "painter" | "carpenter" | "plasterer" | "tiler" | "roofer" | "plumber" | "electrician" | "landscaper";
export const TRADE_RATE: Record<Trade, number> = {
  painter: 75, carpenter: 95, plasterer: 85, tiler: 85, roofer: 95, plumber: 120, electrician: 115, landscaper: 70,
};
export const TRADE_LABEL: Record<Trade, string> = {
  painter: "Painter", carpenter: "Carpenter/builder", plasterer: "Plasterer", tiler: "Tiler",
  roofer: "Roofer", plumber: "Plumber", electrician: "Electrician", landscaper: "Landscaper/fencer",
};

export interface MatLine {
  name: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  lineCost: number;
  source: string;
}
export interface LabourLine {
  trade: Trade;
  hours: number;
  rate: number;
  cost: number;
  working: string; // "Carpenter 16hrs @ $95/hr"
}
export interface TierCost {
  tier: Tier;
  label: string;
  icon: string;
  scope: string; // exactly what's done
  materials: MatLine[];
  materialsCost: number;
  labour: LabourLine[];
  labourCost: number;
  diyTotal: number; // materials only
  tradieTotal: number; // materials + labour
  defaultLabour: LabourMode;
  itemised: boolean; // false = allowance fallback (no BOM recipe)
}
export interface ThreeTierCost {
  kind: RenoKind;
  quantity: number;
  quantityUnit: string;
  quantityNote: string;
  patch: TierCost;
  budget: TierCost;
  premium: TierCost;
}

// ── DB lookup ────────────────────────────────────────────────────────────────
const DB_INDEX = new Map(MATERIALS_DB.map((m) => [m.name, m]));
const round = (n: number) => Math.round(n);
const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

function dbLine(name: string, level: "budget" | "premium", qty: number): MatLine | null {
  const m = DB_INDEX.get(name);
  if (!m) return null;
  const o = level === "premium" ? m.premium : m.budget;
  const q = Math.max(1, round(qty));
  return { name, description: o.description, qty: q, unit: o.unit, unitPrice: o.price, lineCost: round(o.price * q), source: o.source };
}

// ── Reno kinds + mapping ─────────────────────────────────────────────────────
export type RenoKind =
  | "cladding" | "exterior_paint" | "roof" | "gutters" | "soffits" | "windows" | "foundation"
  | "decking" | "insulation" | "flooring_vinyl" | "flooring_carpet" | "flooring_tile"
  | "kitchen" | "bathroom" | "heating" | "hotwater" | "ventilation" | "driveway" | "fencing" | "generic";

export function kindForItem(id: string, category?: string, name?: string): RenoKind {
  const hay = `${id} ${name ?? ""}`.toLowerCase();
  if (/driveway|paving/.test(hay)) return "driveway";
  if (/fenc/.test(hay)) return "fencing";
  if (/\broof/.test(hay)) return "roof";
  if (/gutter|spout|downpipe/.test(hay)) return "gutters";
  if (/soffit|fascia/.test(hay)) return "soffits";
  if (/window|glaz|joinery/.test(hay)) return "windows";
  if (/foundation|pile|subfloor/.test(hay)) return "foundation";
  if (/deck/.test(hay)) return "decking";
  if (/insulat/.test(hay)) return "insulation";
  if (/hot.?water|cylinder|califont/.test(hay)) return "hotwater";
  if (/ventilat|extract/.test(hay)) return "ventilation";
  if (/heating|heat pump/.test(hay)) return "heating";
  if (/cladding|weatherboard/.test(hay)) return "cladding";
  if (/repaint|exterior paint|\bpaint\b/.test(hay)) return "exterior_paint";
  if (category === "Kitchen") return "kitchen";
  if (category === "Bathroom") {
    if (/floor/.test(hay)) return "flooring_tile";
    return "bathroom";
  }
  if (/carpet/.test(hay) || (/floor/.test(hay) && /bed/.test(id))) return "flooring_carpet";
  if (/tile/.test(hay)) return "flooring_tile";
  if (/floor/.test(hay)) return "flooring_vinyl";
  return "generic";
}

// ── Quantity context ─────────────────────────────────────────────────────────
interface Ctx { area: number; count: number; floorSqm: number; }

function primaryQty(kind: RenoKind, floorSqm: number, bedrooms: number): { area: number; count: number; unit: string; note: string } {
  const floor = floorSqm > 0 ? floorSqm : 120;
  const perim = round(4 * Math.sqrt(floor) * 1.05);
  const wall = round(perim * 2.4 * 0.85);
  switch (kind) {
    case "cladding": case "exterior_paint":
      return { area: wall, count: 0, unit: "m²", note: `≈${perim}lm perimeter × 2.4m − openings = ${wall}m² wall` };
    case "roof":
      return { area: round(floor * 1.15), count: 0, unit: "m²", note: `${floor}m² floor × 1.15 pitch = ${round(floor * 1.15)}m²` };
    case "gutters": case "soffits": case "foundation":
      return { area: perim, count: 0, unit: "lin m", note: `≈${perim}lm building perimeter` };
    case "windows":
      return { area: 0, count: Math.max(6, bedrooms * 2 + 4), unit: "units", note: `est. ${Math.max(6, bedrooms * 2 + 4)} windows from ${bedrooms} bed` };
    case "decking":
      return { area: 20, count: 0, unit: "m²", note: "≈20m² deck (typical)" };
    case "insulation":
      return { area: floor, count: 0, unit: "m²", note: `${floor}m² ceiling area` };
    case "flooring_vinyl": case "flooring_carpet":
      return { area: Math.min(floor, 60), count: 0, unit: "m²", note: `≈${Math.min(floor, 60)}m² floor area` };
    case "flooring_tile":
      return { area: 8, count: 0, unit: "m²", note: "≈8m² wet-area floor" };
    case "kitchen":
      return { area: 3, count: 0, unit: "lm run", note: "3 lineal-metre kitchen run" };
    case "bathroom":
      return { area: 6, count: 0, unit: "m²", note: "≈6m² bathroom" };
    case "driveway":
      return { area: 40, count: 0, unit: "m²", note: "≈40m² driveway" };
    case "fencing":
      return { area: 20, count: 0, unit: "lin m", note: "≈20 lin m boundary fence" };
    default:
      return { area: 1, count: 1, unit: "job", note: "" };
  }
}

// ── Recipe definitions ───────────────────────────────────────────────────────
interface BomEntry { db: string; qty: (c: Ctx) => number; }
interface InlineMat { name: string; description: string; qty: (c: Ctx) => number; unit: string; unitPrice: number; source: string; }
interface LabEntry { trade: Trade; hours: (c: Ctx) => number; }
interface Recipe {
  scopeBudget: string;
  scopePremium: string;
  scopePatch: string;
  bom: BomEntry[];
  labour: LabEntry[];
  patchInline: InlineMat[];
  patchDb: BomEntry[];
  patchLabour: LabEntry[];
}

const a = (c: Ctx) => c.area; // shorthand

const RECIPES: Partial<Record<RenoKind, Recipe>> = {
  cladding: {
    scopeBudget: "Strip the old cladding and re-clad in treated pine weatherboard over a drained cavity, new wrap, then prime and paint.",
    scopePremium: "Re-clad in clear cedar bevel-back weatherboard over a cavity, premium wall underlay, natural-oil finish.",
    scopePatch: "Fill splits and nail holes with exterior filler, sand back, spot-prime and repaint the existing boards.",
    bom: [
      { db: "Primary cladding", qty: a },
      { db: "Cavity batten", qty: (c) => round(c.area * 1.1) },
      { db: "Wall underlay", qty: (c) => Math.ceil(c.area / 55) },
      { db: "Cladding nails and screws", qty: (c) => Math.ceil(c.area / 25) },
      { db: "Exterior paint", qty: (c) => Math.ceil(c.area / 40) },
      { db: "Primer", qty: (c) => Math.ceil(c.area / 60) },
    ],
    labour: [{ trade: "carpenter", hours: (c) => round(c.area * 0.5) }, { trade: "painter", hours: (c) => round(c.area * 0.25) }],
    patchInline: [
      { name: "Exterior filler", description: "Selleys No More Gaps exterior 475g", qty: (c) => Math.max(2, round(c.area / 25)), unit: "per tube", unitPrice: 12.5, source: "Bunnings" },
      { name: "Sandpaper pack", description: "Assorted grit sanding pack", qty: () => 1, unit: "per pack", unitPrice: 18, source: "Bunnings" },
    ],
    patchDb: [{ db: "Exterior paint", qty: (c) => Math.ceil(c.area / 45) }],
    patchLabour: [{ trade: "painter", hours: (c) => round(c.area * 0.15) }],
  },
  exterior_paint: {
    scopeBudget: "Wash, scrape, prep and two-coat exterior repaint in Dulux Weathershield.",
    scopePremium: "Full prep and two coats of Resene X-200 premium exterior membrane (15yr).",
    scopePatch: "Spot-fill and repaint only the weathered elevations; wash the rest.",
    bom: [
      { db: "Exterior paint", qty: (c) => Math.ceil(c.area / 40) },
      { db: "Primer", qty: (c) => Math.ceil(c.area / 60) },
    ],
    labour: [{ trade: "painter", hours: (c) => round(c.area * 0.25) }],
    patchInline: [{ name: "Exterior filler", description: "Selleys No More Gaps exterior 475g", qty: () => 2, unit: "per tube", unitPrice: 12.5, source: "Bunnings" }],
    patchDb: [{ db: "Exterior paint", qty: (c) => Math.ceil(c.area / 80) }],
    patchLabour: [{ trade: "painter", hours: (c) => round(c.area * 0.12) }],
  },
  roof: {
    scopeBudget: "Strip the old roof, new underlay, re-roof in 0.40mm corrugate with new ridge and fixings.",
    scopePremium: "Re-roof in Colorsteel Endura 0.55mm long-run with reflective underlay, ventilated ridge.",
    scopePatch: "Replace failed sheets/flashings, re-seal fixings and recoat the existing iron.",
    bom: [
      { db: "Main roofing iron", qty: a },
      { db: "Roofing underlay", qty: (c) => Math.ceil(c.area / 30) },
      { db: "Roof fixings", qty: (c) => Math.ceil(c.area / 30) },
      { db: "Ridge capping", qty: (c) => round(Math.sqrt(c.area) * 1.2) },
    ],
    labour: [{ trade: "roofer", hours: (c) => round(c.area * 0.4) }],
    patchInline: [],
    patchDb: [{ db: "Roof paint existing roof", qty: (c) => Math.ceil(c.area / 60) }, { db: "Butyl tape", qty: () => 2 }],
    patchLabour: [{ trade: "roofer", hours: (c) => round(c.area * 0.12) }],
  },
  gutters: {
    scopeBudget: "Replace all spouting and downpipes with new PVC.",
    scopePremium: "Replace with colour-matched Colorsteel seamless spouting and steel downpipes.",
    scopePatch: "Re-secure brackets, seal leaking joints and replace the worst runs.",
    bom: [
      { db: "Guttering", qty: a },
      { db: "Downpipes", qty: (c) => round(c.area * 0.3) },
    ],
    labour: [{ trade: "roofer", hours: (c) => round(c.area * 0.25) }],
    patchInline: [{ name: "Gutter sealant", description: "Selleys gutter & flashing silicone", qty: () => 2, unit: "per tube", unitPrice: 16, source: "Bunnings" }],
    patchDb: [{ db: "Guttering", qty: (c) => round(c.area * 0.3) }],
    patchLabour: [{ trade: "roofer", hours: (c) => round(c.area * 0.12) }],
  },
  soffits: {
    scopeBudget: "Replace rotten soffit/fascia with treated ply soffit and timber fascia, then paint.",
    scopePremium: "Replace with Hardisoffit fibre cement and pre-primed finger-jointed fascia.",
    scopePatch: "Cut out rot, patch with ply, fill and repaint.",
    bom: [
      { db: "Soffit lining", qty: (c) => Math.ceil(c.area / 8) },
      { db: "Fascia board", qty: a },
      { db: "Exterior paint", qty: (c) => Math.ceil(c.area / 30) },
    ],
    labour: [{ trade: "carpenter", hours: (c) => round(c.area * 0.2) }, { trade: "painter", hours: (c) => round(c.area * 0.1) }],
    patchInline: [{ name: "Exterior filler", description: "Builders bog exterior 1L", qty: () => 1, unit: "per tin", unitPrice: 28, source: "Bunnings" }],
    patchDb: [{ db: "Exterior paint", qty: () => 1 }],
    patchLabour: [{ trade: "carpenter", hours: (c) => round(c.area * 0.08) }],
  },
  windows: {
    scopeBudget: "Replace single-glazed units with standard aluminium double-glazed windows.",
    scopePremium: "Replace with thermally-broken aluminium double-glazed joinery.",
    scopePatch: "Re-putty, re-seal and draught-strip the existing joinery; replace the worst unit.",
    bom: [{ db: "Standard window 1200x900", qty: (c) => c.count }],
    labour: [{ trade: "carpenter", hours: (c) => c.count * 3 }],
    patchInline: [{ name: "Glazing putty + seals", description: "Putty, draught seal & sealant kit", qty: (c) => c.count, unit: "per window", unitPrice: 22, source: "Mitre 10" }],
    patchDb: [{ db: "Standard window 1200x900", qty: () => 1 }],
    patchLabour: [{ trade: "carpenter", hours: (c) => round(c.count * 0.8) }],
  },
  foundation: {
    scopeBudget: "Re-pile the perimeter on new H5 timber piles with new bearers and connectors.",
    scopePremium: "Re-pile on concrete-encased steel post piles — no rot, 100yr life.",
    scopePatch: "Re-level and pack the worst piles, replace a few, improve subfloor ventilation.",
    bom: [
      { db: "Foundation type — piles", qty: a },
      { db: "Bearers", qty: a },
      { db: "Pile cap and bearer connector", qty: (c) => round(c.area / 1.5) },
    ],
    labour: [{ trade: "carpenter", hours: (c) => round(c.area * 1.0) }],
    patchInline: [{ name: "Pile packers + DPC", description: "Hardwood packers and DPC offcuts", qty: () => 1, unit: "per lot", unitPrice: 90, source: "Mitre 10" }],
    patchDb: [{ db: "Foundation type — piles", qty: (c) => round(c.area * 0.2) }],
    patchLabour: [{ trade: "carpenter", hours: (c) => round(c.area * 0.3) }],
  },
  decking: {
    scopeBudget: "Rebuild the deck with H3.2 pine boards on a treated subframe, then oil.",
    scopePremium: "Rebuild in Kwila hardwood decking on an H4 subframe, natural oil finish.",
    scopePatch: "Replace rotten boards, refix loose ones and re-oil the whole deck.",
    bom: [
      { db: "Deck boards", qty: (c) => round(c.area * 7.4) },
      { db: "Deck framing", qty: (c) => round(c.area * 2.5) },
      { db: "Deck screws", qty: (c) => Math.ceil(c.area / 6) },
      { db: "Deck stain and oil", qty: (c) => Math.ceil(c.area / 12) },
    ],
    labour: [{ trade: "carpenter", hours: (c) => round(c.area * 1.2) }],
    patchInline: [],
    patchDb: [{ db: "Deck boards", qty: (c) => round(c.area * 7.4 * 0.4) }, { db: "Deck stain and oil", qty: (c) => Math.ceil(c.area / 12) }],
    patchLabour: [{ trade: "carpenter", hours: (c) => round(c.area * 0.4) }],
  },
  insulation: {
    scopeBudget: "Install Pink Batts R2.8 ceiling insulation throughout.",
    scopePremium: "Install Bradford Gold R6.6 high-performance ceiling insulation.",
    scopePatch: "Top up thin/missing areas of the existing ceiling insulation.",
    bom: [{ db: "Ceiling insulation", qty: (c) => Math.ceil(c.area / 8.14) }],
    labour: [{ trade: "carpenter", hours: (c) => round(c.area * 0.08) }],
    patchInline: [],
    patchDb: [{ db: "Ceiling insulation", qty: (c) => Math.ceil((c.area * 0.4) / 8.14) }],
    patchLabour: [{ trade: "carpenter", hours: (c) => round(c.area * 0.03) }],
  },
  flooring_vinyl: {
    scopeBudget: "Uplift old covering, prep, and lay click-lock vinyl plank.",
    scopePremium: "Lay engineered hardwood flooring over a prepped subfloor.",
    scopePatch: "Replace the worst boards and re-lay sound sections; fill and level.",
    bom: [
      { db: "Main living flooring", qty: a },
      { db: "Floor levelling compound", qty: (c) => Math.ceil(c.area / 15) },
    ],
    labour: [{ trade: "carpenter", hours: (c) => round(c.area * 0.35) }],
    patchInline: [],
    patchDb: [{ db: "Main living flooring", qty: (c) => round(c.area * 0.3) }],
    patchLabour: [{ trade: "carpenter", hours: (c) => round(c.area * 0.15) }],
  },
  flooring_carpet: {
    scopeBudget: "New flatweave nylon carpet and foam underlay throughout.",
    scopePremium: "New 100% NZ wool plush carpet with acoustic memory-foam underlay.",
    scopePatch: "Professional clean and re-stretch the existing carpet; patch worn areas.",
    bom: [
      { db: "Bedroom carpet", qty: a },
      { db: "Carpet underlay", qty: a },
    ],
    labour: [{ trade: "carpenter", hours: (c) => round(c.area * 0.2) }],
    patchInline: [{ name: "Carpet clean + restretch", description: "Hire clean + re-stretch consumables", qty: () => 1, unit: "per room", unitPrice: 120, source: "Market rate" }],
    patchDb: [],
    patchLabour: [{ trade: "carpenter", hours: (c) => round(c.area * 0.08) }],
  },
  flooring_tile: {
    scopeBudget: "Lay ceramic floor tiles over a waterproofed, levelled substrate.",
    scopePremium: "Lay large-format rectified porcelain with epoxy grout.",
    scopePatch: "Replace cracked tiles, re-grout and re-seal the existing floor.",
    bom: [
      { db: "Wet area floor tiles", qty: a },
      { db: "Tile adhesive", qty: (c) => Math.ceil(c.area / 5) },
      { db: "Grout", qty: (c) => Math.ceil(c.area / 8) },
      { db: "Waterproof membrane", qty: (c) => Math.ceil(c.area / 8) },
    ],
    labour: [{ trade: "tiler", hours: (c) => round(c.area * 1.5) }],
    patchInline: [],
    patchDb: [{ db: "Wet area floor tiles", qty: (c) => Math.max(1, round(c.area * 0.2)) }, { db: "Grout", qty: () => 1 }],
    patchLabour: [{ trade: "tiler", hours: (c) => round(c.area * 0.4) }],
  },
  kitchen: {
    scopeBudget: "New flat-pack melamine kitchen, laminate benchtop, sink, mixer and dishwasher.",
    scopePremium: "Custom painted kitchen, stone benchtop, premium sink/tap and integrated appliances.",
    scopePatch: "Re-paint doors, replace handles, new tap and a benchtop resurface.",
    bom: [
      { db: "Kitchen cabinetry 3m run", qty: a },
      { db: "Benchtop", qty: (c) => round(c.area * 1.2) },
      { db: "Kitchen sink", qty: () => 1 },
      { db: "Kitchen tap", qty: () => 1 },
      { db: "Dishwasher", qty: () => 1 },
      { db: "Splashback", qty: () => 3 },
    ],
    labour: [{ trade: "carpenter", hours: () => 16 }, { trade: "plumber", hours: () => 4 }, { trade: "electrician", hours: () => 4 }],
    patchInline: [{ name: "Cabinet repaint kit", description: "2-pack cabinet primer + enamel", qty: () => 1, unit: "per kit", unitPrice: 180, source: "Mitre 10" }],
    patchDb: [{ db: "Kitchen tap", qty: () => 1 }, { db: "Kitchen handles", qty: () => 12 }],
    patchLabour: [{ trade: "carpenter", hours: () => 8 }],
  },
  bathroom: {
    scopeBudget: "Full budget refit — acrylic shower, new toilet, vanity, tapware and tiled floor.",
    scopePremium: "Premium refit — tiled walk-in shower, wall-hung toilet, stone vanity, designer tapware.",
    scopePatch: "Re-seal, re-grout, replace tap and vanity; deep-clean and repaint.",
    bom: [
      { db: "Shower", qty: () => 1 },
      { db: "Toilet suite", qty: () => 1 },
      { db: "Vanity unit", qty: () => 1 },
      { db: "Shower mixer", qty: () => 1 },
      { db: "Basin tap", qty: () => 1 },
      { db: "Wet area floor tiles", qty: a },
      { db: "Waterproof membrane", qty: (c) => Math.ceil(c.area / 8) },
    ],
    labour: [{ trade: "plumber", hours: () => 12 }, { trade: "tiler", hours: (c) => round(c.area * 1.5) }, { trade: "carpenter", hours: () => 6 }],
    patchInline: [{ name: "Re-grout + silicone kit", description: "Grout, mould-resistant silicone, sealer", qty: () => 1, unit: "per kit", unitPrice: 95, source: "Bunnings" }],
    patchDb: [{ db: "Vanity unit", qty: () => 1 }, { db: "Basin tap", qty: () => 1 }],
    patchLabour: [{ trade: "plumber", hours: () => 4 }],
  },
  heating: {
    scopeBudget: "Supply and install a 2.5kW Mitsubishi wall-split heat pump.",
    scopePremium: "Install a cold-climate ducted heat-pump system.",
    scopePatch: "Service the existing heating; add a portable heater as a stopgap.",
    bom: [{ db: "Heat pump space heating", qty: () => 1 }],
    labour: [{ trade: "electrician", hours: () => 5 }],
    patchInline: [{ name: "Heat pump service", description: "Clean, regas check, filter", qty: () => 1, unit: "per service", unitPrice: 180, source: "Market rate" }],
    patchDb: [],
    patchLabour: [{ trade: "electrician", hours: () => 2 }],
  },
  hotwater: {
    scopeBudget: "Replace with a 180L mains-pressure electric cylinder.",
    scopePremium: "Install a 250L heat-pump water heater — 75% cheaper to run.",
    scopePatch: "Replace the element/thermostat and re-lag the existing cylinder.",
    bom: [{ db: "Hot water system", qty: () => 1 }],
    labour: [{ trade: "plumber", hours: () => 5 }],
    patchInline: [{ name: "Element + thermostat", description: "Cylinder element and thermostat kit", qty: () => 1, unit: "per kit", unitPrice: 140, source: "Mitre 10" }],
    patchDb: [],
    patchLabour: [{ trade: "plumber", hours: () => 2 }],
  },
  ventilation: {
    scopeBudget: "Install a standard 150mm bathroom extractor fan, ducted out.",
    scopePremium: "Install a Whisper-quiet DC fan with humidity sensor and timer.",
    scopePatch: "Clean/clear the existing fan and duct; reseal.",
    bom: [{ db: "Extractor fans", qty: () => 1 }],
    labour: [{ trade: "electrician", hours: () => 3 }],
    patchInline: [{ name: "Duct + grille", description: "Flexible duct and external grille", qty: () => 1, unit: "per kit", unitPrice: 45, source: "Bunnings" }],
    patchDb: [],
    patchLabour: [{ trade: "electrician", hours: () => 1 }],
  },
  driveway: {
    scopeBudget: "Lay a new chip-seal tarseal driveway over a prepped basecourse.",
    scopePremium: "Lay an exposed-aggregate concrete driveway — 30+ yr, zero maintenance.",
    scopePatch: "Cut out the worst sections, fill with ready-mix and grout the cracks.",
    bom: [{ db: "Driveway surface", qty: a }, { db: "Basecourse gravel", qty: (c) => round(c.area * 0.2) }],
    labour: [{ trade: "landscaper", hours: (c) => round(c.area * 0.5) }],
    patchInline: [{ name: "Ready-mix concrete", description: "Cemix 20kg Multicrete", qty: (c) => round(c.area * 0.2 * 11), unit: "per 20kg bag", unitPrice: 10.89, source: "Bunnings" }],
    patchDb: [],
    patchLabour: [{ trade: "landscaper", hours: (c) => round(c.area * 0.15) }],
  },
  fencing: {
    scopeBudget: "New timber paling fence on H4 pine posts.",
    scopePremium: "New powder-coated aluminium slat fence — zero maintenance.",
    scopePatch: "Replace broken palings and re-secure leaning posts.",
    bom: [
      { db: "Fence posts", qty: (c) => Math.ceil(c.area / 2.4) },
      { db: "Fence panels", qty: (c) => round(c.area * 6.7) },
      { db: "Gate hardware", qty: () => 1 },
    ],
    labour: [{ trade: "landscaper", hours: (c) => round(c.area * 0.6) }],
    patchInline: [],
    patchDb: [{ db: "Fence panels", qty: (c) => round(c.area * 6.7 * 0.2) }],
    patchLabour: [{ trade: "landscaper", hours: (c) => round(c.area * 0.2) }],
  },
};

// ── Build tiers ──────────────────────────────────────────────────────────────
function labourLines(entries: LabEntry[], c: Ctx): LabourLine[] {
  return entries
    .map((e) => {
      const hours = Math.max(1, round(e.hours(c)));
      const rate = TRADE_RATE[e.trade];
      return { trade: e.trade, hours, rate, cost: hours * rate, working: `${TRADE_LABEL[e.trade]} ${hours}hrs @ $${rate}/hr` };
    })
    .filter((l) => l.hours > 0);
}

function tierFrom(tier: Tier, scope: string, materials: MatLine[], labour: LabourLine[], itemised: boolean): TierCost {
  const materialsCost = round(materials.reduce((s, m) => s + m.lineCost, 0));
  const labourCost = round(labour.reduce((s, l) => s + l.cost, 0));
  return {
    tier, label: TIER_META[tier].label, icon: TIER_META[tier].icon, scope,
    materials, materialsCost, labour, labourCost,
    diyTotal: materialsCost, tradieTotal: materialsCost + labourCost,
    defaultLabour: TIER_META[tier].defaultLabour, itemised,
  };
}

// Generic allowance fallback when there's no BOM recipe — anchored to the AI estimate.
function genericTiers(c: Ctx, fallback: { low: number; high: number } | null): { patch: TierCost; budget: TierCost; premium: TierCost } {
  const hi = fallback?.high ?? 6000;
  const lo = fallback?.low ?? round(hi * 0.7);
  const mk = (tier: Tier, total: number, scope: string): TierCost => {
    const materialsCost = round(total * 0.55);
    const labourCost = round(total * 0.45);
    const mat: MatLine = { name: "Materials allowance", description: "Indicative materials for this item", qty: 1, unit: "allowance", unitPrice: materialsCost, lineCost: materialsCost, source: "Estimate" };
    const lab: LabourLine = { trade: "carpenter", hours: round(labourCost / TRADE_RATE.carpenter), rate: TRADE_RATE.carpenter, cost: labourCost, working: `Allowance ≈ ${money(labourCost)} labour` };
    return { tier, label: TIER_META[tier].label, icon: TIER_META[tier].icon, scope, materials: [mat], materialsCost, labour: [lab], labourCost, diyTotal: materialsCost, tradieTotal: materialsCost + labourCost, defaultLabour: TIER_META[tier].defaultLabour, itemised: false };
  };
  return {
    patch: mk("patch", round(lo * 0.4), "Targeted repair of the worst areas — a temporary measure."),
    budget: mk("budget", hi, "Full replacement to a sound, compliant standard."),
    premium: mk("premium", round(hi * 1.8), "Full replacement using premium materials and finishes."),
  };
}

export function costThreeTier(args: {
  id: string;
  name?: string;
  category?: string;
  floorSqm?: number | null;
  bedrooms?: number | null;
  fallback?: { low: number; high: number } | null;
}): ThreeTierCost {
  const kind = kindForItem(args.id, args.category, args.name);
  const q = primaryQty(kind, args.floorSqm ?? 0, args.bedrooms ?? 3);
  const c: Ctx = { area: q.area, count: q.count, floorSqm: args.floorSqm ?? 0 };
  const r = RECIPES[kind];

  if (!r) {
    const g = genericTiers(c, args.fallback ?? null);
    return { kind, quantity: q.area || q.count, quantityUnit: q.unit, quantityNote: q.note, ...g };
  }

  const budgetMats = r.bom.map((b) => dbLine(b.db, "budget", b.qty(c))).filter((m): m is MatLine => m !== null);
  const premiumMats = r.bom.map((b) => dbLine(b.db, "premium", b.qty(c))).filter((m): m is MatLine => m !== null);
  const patchMats: MatLine[] = [
    ...r.patchInline.map((m) => { const qty = Math.max(1, round(m.qty(c))); return { name: m.name, description: m.description, qty, unit: m.unit, unitPrice: m.unitPrice, lineCost: round(m.unitPrice * qty), source: m.source }; }),
    ...r.patchDb.map((b) => dbLine(b.db, "budget", b.qty(c))).filter((m): m is MatLine => m !== null),
  ];

  return {
    kind,
    quantity: q.area || q.count,
    quantityUnit: q.unit,
    quantityNote: q.note,
    patch: tierFrom("patch", r.scopePatch, patchMats, labourLines(r.patchLabour, c), true),
    budget: tierFrom("budget", r.scopeBudget, budgetMats, labourLines(r.labour, c), true),
    premium: tierFrom("premium", r.scopePremium, premiumMats, labourLines(r.labour, c), true),
  };
}

/** Effective cost of one tier given the labour mode. */
export function tierTotal(t: TierCost, labour: LabourMode): number {
  return labour === "tradie" ? t.tradieTotal : t.diyTotal;
}

// ── Percentage-of-property scaling (Change 3) ────────────────────────────────
// AREA / LINEAR items get a "% of property affected" slider — do the whole roof,
// or just 60% of it. Whole-unit items (a heat pump, a cylinder, a kitchen or
// bathroom refit, a count of windows) are all-or-nothing and get no slider.
const SCALABLE_KINDS: Set<RenoKind> = new Set<RenoKind>([
  "cladding", "exterior_paint", "roof", "gutters", "soffits", "foundation",
  "decking", "insulation", "flooring_vinyl", "flooring_carpet", "flooring_tile",
  "driveway", "fencing",
]);

export function isScalableKind(kind: RenoKind): boolean {
  return SCALABLE_KINDS.has(kind);
}

/**
 * Scale every quantity, material line and labour hour of a tier by `pct` (0–1)
 * — e.g. 0.6 = "60% of the house". pct ≥ 1 returns the tier unchanged, so the
 * 100% default is a no-op. Line costs are re-summed so the breakdown always adds
 * up to the displayed total.
 */
export function scaleTier(t: TierCost, pct: number): TierCost {
  if (pct >= 1) return t;
  const p = Math.max(0.05, pct);
  const r = (n: number) => Math.round(n);
  const materials = t.materials.map((m) => ({
    ...m,
    qty: Math.round(m.qty * p * 10) / 10,
    lineCost: r(m.lineCost * p),
  }));
  const labour = t.labour.map((l) => {
    const hours = Math.max(1, r(l.hours * p));
    return { ...l, hours, cost: r(hours * l.rate), working: `${TRADE_LABEL[l.trade]} ${hours}hrs @ $${l.rate}/hr` };
  });
  const materialsCost = r(materials.reduce((s, m) => s + m.lineCost, 0));
  const labourCost = r(labour.reduce((s, l) => s + l.cost, 0));
  return { ...t, materials, materialsCost, labour, labourCost, diyTotal: materialsCost, tradieTotal: materialsCost + labourCost };
}
