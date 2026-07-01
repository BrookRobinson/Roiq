// Interactive material-picker catalogue — powers the visualiser's "Customise
// materials" studio. Per swappable SURFACE, a set of material TYPES; each type has a
// curated colour/finish palette, an indicative NZ $/m² (aligned to lib/materials-db.ts
// so the live estimate matches the reno costing), a typical installed labour rate, and
// a retailer "shop this look" search link (the hybrid product source — reliable curated
// prices now, real retailer links, with a clean seam to add live prices later).
//
// v1 populates FLOOR end-to-end; the other surfaces slot into CATALOGUE the same way.

import type { RenoKind } from "@/lib/reno-costing/three-tier";

export type Surface =
  | "floor" | "wall" | "benchtop" | "splashback" | "cladding" | "roof" | "deck" | "fence";

export interface ColourOption {
  id: string;
  label: string;  // e.g. "Natural Oak"
  swatch: string; // hex for the UI chip
  render: string; // phrase injected into the gpt-image-1 prompt, e.g. "a warm natural oak tone"
}

export interface MaterialType {
  id: string;            // "engineered_timber"
  label: string;         // "Engineered timber"
  render: string;        // base look phrase for the prompt, e.g. "wide-plank engineered timber flooring"
  pricePerSqm: number;   // indicative material-only NZ $/m² (ex install)
  installPerSqm: number; // typical installed labour $/m² when paying someone
  lifespan?: string;     // "25+ yrs"
  note?: string;         // one-line buyer note
  colours: ColourOption[];
  /** "Shop this look" — a retailer product search for this material + chosen colour. */
  shop?: { retailer: string; url: (colourLabel: string) => string };
}

export const SURFACE_LABEL: Record<Surface, string> = {
  floor: "floor", wall: "walls", benchtop: "benchtop", splashback: "splashback",
  cladding: "exterior cladding", roof: "roof", deck: "deck", fence: "fence",
};

/** Map a reno-costing kind to a swappable surface (null = no material studio). */
export function surfaceForKind(kind: RenoKind): Surface | null {
  switch (kind) {
    case "flooring_carpet":
    case "flooring_vinyl":
    case "flooring_tile":
      return "floor";
    case "cladding":
    case "exterior_paint":
      return "cladding";
    case "roof":
      return "roof";
    case "decking":
      return "deck";
    case "fencing":
      return "fence";
    default:
      return null;
  }
}

// ── Retailer search-link builders ──────────────────────────────────────────
const mitre10 = (q: string) => `https://www.mitre10.co.nz/shop/search?q=${encodeURIComponent(q)}`;
const bunnings = (q: string) => `https://www.bunnings.co.nz/search/products?q=${encodeURIComponent(q)}`;
const carpetCourt = (q: string) => `https://www.carpetcourt.co.nz/catalogsearch/result/?q=${encodeURIComponent(q)}`;
const flooringXtra = (q: string) => `https://www.flooringxtra.co.nz/?s=${encodeURIComponent(q)}`;
const tileWarehouse = (q: string) => `https://www.tilewarehouse.co.nz/catalogsearch/result/?q=${encodeURIComponent(q)}`;

// ── FLOOR ───────────────────────────────────────────────────────────────────
const FLOOR: MaterialType[] = [
  {
    id: "carpet_wool", label: "Wool carpet", render: "plush wool loop-pile carpet",
    pricePerSqm: 130, installPerSqm: 18, lifespan: "15+ yrs", note: "Warm, hypoallergenic, premium feel.",
    colours: [
      { id: "charcoal", label: "Charcoal", swatch: "#3a3a3d", render: "a deep charcoal grey" },
      { id: "stone", label: "Stone", swatch: "#b8afa2", render: "a warm stone beige" },
      { id: "oatmeal", label: "Oatmeal", swatch: "#dbcfba", render: "a soft oatmeal cream" },
      { id: "slate", label: "Slate blue", swatch: "#5b6b78", render: "a muted slate blue-grey" },
    ],
    shop: { retailer: "Carpet Court", url: (c) => carpetCourt(`wool carpet ${c}`) },
  },
  {
    id: "carpet_synthetic", label: "Synthetic carpet", render: "hard-wearing nylon cut-pile carpet",
    pricePerSqm: 45, installPerSqm: 15, lifespan: "7–10 yrs", note: "Budget-friendly, stain-resistant.",
    colours: [
      { id: "smoke", label: "Smoke grey", swatch: "#6d6f72", render: "a mid smoke grey" },
      { id: "biscuit", label: "Biscuit", swatch: "#c7b299", render: "a warm biscuit beige" },
      { id: "graphite", label: "Graphite", swatch: "#44464a", render: "a dark graphite grey" },
    ],
    shop: { retailer: "Carpet Court", url: (c) => carpetCourt(`nylon carpet ${c}`) },
  },
  {
    id: "vinyl_plank", label: "Vinyl plank (SPC)", render: "click-lock vinyl plank flooring with a realistic timber grain",
    pricePerSqm: 48, installPerSqm: 22, lifespan: "10–15 yrs", note: "Waterproof, warm underfoot, DIY-friendly.",
    colours: [
      { id: "light_oak", label: "Light oak", swatch: "#c9a87c", render: "a light natural oak tone" },
      { id: "honey", label: "Honey oak", swatch: "#b07d43", render: "a warm honey-toned timber" },
      { id: "walnut", label: "Walnut", swatch: "#5a3b28", render: "a rich dark walnut tone" },
      { id: "grey_wash", label: "Grey wash", swatch: "#9a9187", render: "a washed grey timber tone" },
    ],
    shop: { retailer: "Mitre 10", url: (c) => mitre10(`vinyl plank flooring ${c}`) },
  },
  {
    id: "laminate", label: "Laminate", render: "timber-look laminate plank flooring",
    pricePerSqm: 35, installPerSqm: 20, lifespan: "10–15 yrs", note: "Scratch-resistant, affordable timber look.",
    colours: [
      { id: "natural_oak", label: "Natural oak", swatch: "#caa470", render: "a natural oak tone" },
      { id: "smoked", label: "Smoked oak", swatch: "#7a5a3c", render: "a smoked oak tone" },
      { id: "ash_grey", label: "Ash grey", swatch: "#a7a099", render: "a light ash grey tone" },
    ],
    shop: { retailer: "Bunnings", url: (c) => bunnings(`laminate flooring ${c}`) },
  },
  {
    id: "engineered_timber", label: "Engineered timber", render: "wide-plank engineered timber flooring with a real wood veneer",
    pricePerSqm: 145, installPerSqm: 35, lifespan: "25+ yrs", note: "Real timber face, sandable, premium.",
    colours: [
      { id: "european_oak", label: "European oak", swatch: "#cdaa78", render: "a light European oak tone" },
      { id: "smoked_oak", label: "Smoked oak", swatch: "#6f5136", render: "a smoked oak tone" },
      { id: "natural", label: "Natural", swatch: "#b98d5c", render: "a warm natural timber tone" },
      { id: "charcoal_oak", label: "Charcoal oak", swatch: "#3f342b", render: "a near-black charcoal oak" },
    ],
    shop: { retailer: "Flooring Xtra", url: (c) => flooringXtra(`engineered oak ${c}`) },
  },
  {
    id: "porcelain_tile", label: "Porcelain tile", render: "large-format porcelain floor tiles with fine grout lines",
    pricePerSqm: 95, installPerSqm: 65, lifespan: "30+ yrs", note: "Durable, contemporary; cool underfoot.",
    colours: [
      { id: "concrete_grey", label: "Concrete grey", swatch: "#9b9a97", render: "a concrete-look mid grey" },
      { id: "marble_white", label: "Marble white", swatch: "#e6e3dc", render: "a white marble-look" },
      { id: "charcoal", label: "Charcoal", swatch: "#464646", render: "a charcoal stone-look" },
      { id: "sand", label: "Sand", swatch: "#cbb89a", render: "a warm sand stone-look" },
    ],
    shop: { retailer: "Tile Warehouse", url: (c) => tileWarehouse(`porcelain floor tile ${c}`) },
  },
  {
    id: "polished_concrete", label: "Polished concrete", render: "a polished concrete floor with a smooth matte sheen",
    pricePerSqm: 120, installPerSqm: 80, lifespan: "40+ yrs", note: "Industrial-modern; pairs well with underfloor heating.",
    colours: [
      { id: "natural_grey", label: "Natural grey", swatch: "#adaca8", render: "a natural mid-grey concrete" },
      { id: "charcoal", label: "Charcoal", swatch: "#54545a", render: "a dark charcoal concrete" },
      { id: "warm_sand", label: "Warm sand", swatch: "#c3b49a", render: "a warm sand-toned concrete" },
    ],
  },
];

/** Surface → material types. Only surfaces with entries show a material studio. */
export const CATALOGUE: Partial<Record<Surface, MaterialType[]>> = {
  floor: FLOOR,
  // wall, benchtop, splashback, cladding, roof, deck, fence — added as the pattern rolls out.
};

export function materialsFor(surface: Surface): MaterialType[] {
  return CATALOGUE[surface] ?? [];
}

export interface MaterialEstimate {
  material: number;
  install: number;
  total: number;
}

/** Live estimate: material $/m² × area, plus install labour when paying someone. */
export function estimateMaterial(mat: MaterialType, areaSqm: number, paySomeone: boolean): MaterialEstimate {
  const area = areaSqm > 0 ? areaSqm : 0;
  const material = Math.round(mat.pricePerSqm * area);
  const install = paySomeone ? Math.round(mat.installPerSqm * area) : 0;
  return { material, install, total: material + install };
}
