// ============================================================
// RoiQ — curated NZ retail price catalog (v3.6)
// Real shelf products from Mitre 10, Bunnings & PlaceMakers, used by the
// renovation costing engine (lib/reno-costing/engine.ts) to build Patch / Full
// options with transparent material + labour workings.
//
// HONESTY: these are INDICATIVE retail prices captured at RETAIL_CAPTURED — they
// are NOT live quotes. `exact: true` means the price was read from the live
// product page at capture; `exact: false` is a representative NZ shelf price for
// that item class. Every entry links to a real product or category page so the
// buyer can check the current price. All prices include GST.
// ============================================================

export type Retailer = "Mitre 10" | "Bunnings" | "PlaceMakers";

export const RETAIL_CAPTURED = "June 2026";

export interface RetailProduct {
  id: string;
  name: string;
  retailer: Retailer;
  price: number; // NZD incl GST
  unit: string; // "each" | "m²" | "lin m" | "20kg bag" | "10L"
  url: string;
  exact: boolean; // true = verified from the live product page at capture
}

// Helper keeps the literal table terse while enforcing the shape.
const p = (
  id: string,
  name: string,
  retailer: Retailer,
  price: number,
  unit: string,
  url: string,
  exact = false
): RetailProduct => ({ id, name, retailer, price, unit, url, exact });

export const CATALOG = {
  // ── Bathroom fixtures ────────────────────────────────────────────────────
  vanity_600: p("vanity_600", "Estilo 600mm Freestanding Vanity", "Bunnings", 248, "each",
    "https://www.bunnings.co.nz/estilo-600mm-freestanding-vanity_p0125989", true),
  vanity_900: p("vanity_900", "900mm Vanity with stone top", "Mitre 10", 549, "each",
    "https://www.mitre10.co.nz/shop/kitchen-bathroom/bathroom/basins-vanities/vanities/c/RF5022"),
  basin_mixer: p("basin_mixer", "Basin mixer tapware (chrome)", "Mitre 10", 129, "each",
    "https://www.mitre10.co.nz/search?text=basin%20mixer"),
  shower_mixer: p("shower_mixer", "Shower mixer + rail set", "Bunnings", 189, "each",
    "https://www.bunnings.co.nz/search/products?q=shower%20mixer"),
  toilet_suite: p("toilet_suite", "Back-to-wall toilet suite", "Bunnings", 349, "each",
    "https://www.bunnings.co.nz/search/products?q=toilet%20suite"),
  towel_rail: p("towel_rail", "Heated towel rail", "Mitre 10", 199, "each",
    "https://www.mitre10.co.nz/search?text=heated%20towel%20rail"),
  extractor_fan: p("extractor_fan", "Bathroom extractor fan", "Bunnings", 89, "each",
    "https://www.bunnings.co.nz/search/products?q=bathroom%20extractor%20fan"),

  // ── Tiling & wet-area ─────────────────────────────────────────────────────
  wall_tile_white: p("wall_tile_white", "Johnson 200×200 Ultra White Gloss Ceramic Wall Tile", "Bunnings", 27, "m²",
    "https://www.bunnings.co.nz/johnson-200-x-200mm-1-52m-ultra-white-gloss-ceramic-wall-tile-35-pack_p0385647", true),
  waterproofing_kit: p("waterproofing_kit", "Bathroom waterproofing kit", "Mitre 10", 145, "each",
    "https://www.mitre10.co.nz/search?text=waterproofing%20kit"),
  tile_adhesive_grout: p("tile_adhesive_grout", "Tile adhesive + grout (per m²)", "Bunnings", 14, "m²",
    "https://www.bunnings.co.nz/search/products?q=tile%20adhesive"),

  // ── Flooring ──────────────────────────────────────────────────────────────
  vinyl_plank: p("vinyl_plank", "Novocore Vinyl Gluedown Plank", "Mitre 10", 32.25, "m²",
    "https://www.mitre10.co.nz/shop/novocore-vinyl-gluedown-flooring-h-1219mm-w-184mm-d-2-5mm-desert-sand/p/396662", true),
  laminate_floor: p("laminate_floor", "Laminate floating floor", "Bunnings", 29.9, "m²",
    "https://www.bunnings.co.nz/products/flooring-tiles/laminate-flooring"),
  carpet_midspec: p("carpet_midspec", "Wool-blend carpet + underlay", "Mitre 10", 65, "m²",
    "https://www.mitre10.co.nz/shop/home-storage/flooring/carpet/c/RS4400"),

  // ── Kitchen ───────────────────────────────────────────────────────────────
  dishwasher_entry: p("dishwasher_entry", "Fisher & Paykel 60cm Dishwasher (entry)", "Mitre 10", 999, "each",
    "https://www.mitre10.co.nz/shop/kitchen-bathroom/kitchens/large-appliances/dishwashers/c/RF5218"),
  sink_double: p("sink_double", "Double-bowl stainless sink", "Bunnings", 199, "each",
    "https://www.bunnings.co.nz/search/products?q=kitchen%20sink"),
  kitchen_mixer: p("kitchen_mixer", "Pull-out kitchen mixer", "Mitre 10", 149, "each",
    "https://www.mitre10.co.nz/search?text=kitchen%20mixer"),
  benchtop_laminate: p("benchtop_laminate", "Laminate benchtop", "PlaceMakers", 120, "lin m",
    "https://www.placemakers.co.nz/online/search/?text=laminate%20benchtop"),
  oven_freestanding: p("oven_freestanding", "Freestanding oven 600mm", "Mitre 10", 899, "each",
    "https://www.mitre10.co.nz/shop/kitchen-bathroom/kitchens/large-appliances/c/RS2082"),
  rangehood: p("rangehood", "Canopy rangehood 600mm", "Bunnings", 279, "each",
    "https://www.bunnings.co.nz/search/products?q=rangehood"),

  // ── Paint ─────────────────────────────────────────────────────────────────
  exterior_paint_10L: p("exterior_paint_10L", "Resene Lumbersider Low Sheen 10L", "Mitre 10", 185, "10L",
    "https://www.mitre10.co.nz/shop/resene-lumbersider-low-sheen-waterborne-paint-10l-white/p/361149"),
  interior_paint_10L: p("interior_paint_10L", "Resene SpaceCote Low Sheen 10L", "Mitre 10", 165, "10L",
    "https://www.mitre10.co.nz/resene"),

  // ── Concrete ──────────────────────────────────────────────────────────────
  concrete_20kg: p("concrete_20kg", "Cemix 20kg Multicrete ready-mix", "Bunnings", 10.89, "20kg bag",
    "https://www.bunnings.co.nz/cemix-20kg-multicrete_p0232228", true),

  // ── Spouting / roofing ────────────────────────────────────────────────────
  pvc_spouting: p("pvc_spouting", "Marley PVC spouting + brackets", "Mitre 10", 18, "lin m",
    "https://www.mitre10.co.nz/search?text=marley%20spouting"),
  steel_spouting: p("steel_spouting", "Colorsteel metal spouting", "PlaceMakers", 28, "lin m",
    "https://www.placemakers.co.nz/online/search/?text=spouting"),
  colorsteel_roof: p("colorsteel_roof", "Colorsteel long-run roofing", "PlaceMakers", 26, "m²",
    "https://www.placemakers.co.nz/online/search/?text=colorsteel%20roofing"),

  // ── Insulation ────────────────────────────────────────────────────────────
  ceiling_batts: p("ceiling_batts", "Pink Batts R3.6 ceiling insulation", "Bunnings", 11, "m²",
    "https://www.bunnings.co.nz/products/building-hardware/insulation"),

  // ── Decking / timber ──────────────────────────────────────────────────────
  decking_timber: p("decking_timber", "Treated pine decking board", "PlaceMakers", 9.5, "lin m",
    "https://www.placemakers.co.nz/online/search/?text=decking"),
} as const satisfies Record<string, RetailProduct>;

export type CatalogId = keyof typeof CATALOG;

export const catalogItem = (id: CatalogId): RetailProduct => CATALOG[id];
