// Renovation Marketplace — reference data (hardcoded constants, no DB needed).

export interface TradeCategory {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  requiredBodies: string[];
  hasVisualiser: boolean;
}

export const TRADE_CATEGORIES: TradeCategory[] = [
  { id: "roofing",       name: "Roofing",         emoji: "🏠", blurb: "Re-roof, repairs, spouting",        requiredBodies: ["lbp", "master-builders"], hasVisualiser: true  },
  { id: "painting",      name: "Painting",        emoji: "🎨", blurb: "Interior & exterior repaints",      requiredBodies: ["master-painters"],        hasVisualiser: true  },
  { id: "kitchen",       name: "Kitchen reno",    emoji: "🍳", blurb: "Full or partial kitchen renovation", requiredBodies: ["lbp", "nzcb"],            hasVisualiser: false },
  { id: "bathroom",      name: "Bathroom reno",   emoji: "🛁", blurb: "Wet-area renovations & re-fits",     requiredBodies: ["lbp", "pgdb"],            hasVisualiser: false },
  { id: "plumbing",      name: "Plumbing",        emoji: "🔧", blurb: "Repairs, fit-outs, hot water",       requiredBodies: ["pgdb"],                   hasVisualiser: false },
  { id: "electrical",    name: "Electrical",      emoji: "⚡", blurb: "Wiring, switchboards, lighting",      requiredBodies: ["ewrb"],                   hasVisualiser: false },
  { id: "landscaping",   name: "Landscaping",     emoji: "🌿", blurb: "Gardens, paving, outdoor living",    requiredBodies: ["lianz"],                  hasVisualiser: false },
  { id: "fencing",       name: "Fencing",         emoji: "🪵", blurb: "New fences, gates, retaining",        requiredBodies: ["lbp"],                    hasVisualiser: false },
  { id: "decking",       name: "Decking & patios",emoji: "🪜", blurb: "Decks, patios, pergolas",            requiredBodies: ["lbp"],                    hasVisualiser: false },
  { id: "windows",       name: "Windows & doors", emoji: "🪟", blurb: "Joinery, glazing, replacements",      requiredBodies: ["lbp"],                    hasVisualiser: false },
  { id: "property-care", name: "Property care",   emoji: "🧹", blurb: "Cleaning, water-blast, maintenance", requiredBodies: [],                         hasVisualiser: false },
  { id: "other",         name: "Other",           emoji: "🛠️", blurb: "Anything else around the property",   requiredBodies: [],                         hasVisualiser: false },
];

export interface TradeBody {
  id: string;
  short: string;
  name: string;
}

export const TRADE_BODIES: TradeBody[] = [
  { id: "lbp",             short: "LBP",             name: "Licensed Building Practitioner" },
  { id: "nzcb",            short: "NZCB",            name: "NZ Certified Builders" },
  { id: "master-builders", short: "Master Builders", name: "Master Builders NZ" },
  { id: "ewrb",            short: "EWRB",            name: "Electrical Workers Registration Board" },
  { id: "pgdb",            short: "PGDB",            name: "Plumbers, Gasfitters & Drainlayers Bd" },
  { id: "lianz",           short: "LIANZ",           name: "Landscape Industry Association of NZ" },
  { id: "master-painters", short: "Master Painters", name: "Master Painters NZ" },
];

export interface RoofingMaterial {
  id: string;
  name: string;
}

export const ROOFING_MATERIALS: RoofingMaterial[] = [
  { id: "colorsteel", name: "Colorsteel" },
  { id: "longrun",    name: "Long run steel" },
  { id: "concrete",   name: "Concrete tile" },
  { id: "clay",       name: "Clay tile" },
  { id: "asphalt",    name: "Asphalt shingle" },
];

export interface RoofColour {
  id: string;
  name: string;
  hex: string;
}

export const ROOF_COLOURS: RoofColour[] = [
  { id: "ironsand",  name: "Ironsand",     hex: "#2D2D2D" },
  { id: "gull",      name: "Gull grey",    hex: "#8A8E93" },
  { id: "rivergum",  name: "Rivergum",     hex: "#4C5E47" },
  { id: "sandstone", name: "Sandstone",    hex: "#C4A578" },
  { id: "titania",   name: "Titania",      hex: "#D8D4CB" },
  { id: "thunder",   name: "Thunder grey", hex: "#545E67" },
  { id: "tussock",   name: "Tussock",      hex: "#8B7355" },
  { id: "nightsky",  name: "Night sky",    hex: "#1C2132" },
];

// ── Lookup helpers ─────────────────────────────────────────────────────────────
export const categoryById = (id: string): TradeCategory | undefined => TRADE_CATEGORIES.find((c) => c.id === id);
export const bodyById = (id: string): TradeBody | undefined => TRADE_BODIES.find((b) => b.id === id);
export const materialById = (id?: string | null): RoofingMaterial | undefined => (id ? ROOFING_MATERIALS.find((m) => m.id === id) : undefined);
export const colourById = (id?: string | null): RoofColour | undefined => (id ? ROOF_COLOURS.find((c) => c.id === id) : undefined);
export const categoryName = (id: string): string => categoryById(id)?.name ?? id;

/** A tradesman qualifies for a job if they hold EVERY trade body the category requires. */
export function isQualified(categoryId: string, heldBodies: string[] = []): boolean {
  const cat = categoryById(categoryId);
  if (!cat) return false;
  return cat.requiredBodies.every((b) => heldBodies.includes(b));
}

/** Auto-generated job title from category + the start of the description. */
export function jobTitle(categoryId: string, description: string): string {
  const cat = categoryName(categoryId);
  const brief = description.trim().split(/[.\n]/)[0]?.trim() ?? "";
  if (!brief) return cat;
  // Keep it short — "Roofing — Replace old iron roof, leaking…"
  const snippet = brief.length > 48 ? brief.slice(0, 48).trim() + "…" : brief;
  return `${cat} — ${snippet}`;
}
