// ============================================================
// RoiQ Renovation Visualiser — pricing, styles, scope (v3.5)
// Pure + deterministic so prices recompute instantly when the buyer enters
// real room dimensions. Image generation lives in app/api/visualise.
// ============================================================

export type RoomType = "bathroom" | "kitchen";
export type RenoTier = "basic" | "mid" | "high";
export type RenoStyle = "Modern" | "Coastal" | "Hamptons" | "Scandi" | "Industrial" | "Classic NZ";

export const RENO_STYLES: RenoStyle[] = ["Modern", "Coastal", "Hamptons", "Scandi", "Industrial", "Classic NZ"];

export const TIER_ORDER: RenoTier[] = ["basic", "mid", "high"];

export const TIER_META: Record<RenoTier, { label: string; icon: string }> = {
  basic: { label: "Basic", icon: "🪣" },
  mid: { label: "Mid-range", icon: "🔧" },
  high: { label: "High-end", icon: "✨" },
};

// $/m² rates, calibrated so a 4m² bathroom → $9,500 / $16,000 / $24,000 (spec).
const RATE: Record<RoomType, Record<RenoTier, number>> = {
  bathroom: { basic: 2375, mid: 4000, high: 6000 },
  kitchen: { basic: 2100, mid: 3600, high: 5600 },
};

const MIN_SQM: Record<RoomType, number> = { bathroom: 3, kitchen: 6 };
export const DEFAULT_SQM: Record<RoomType, number> = { bathroom: 5, kitchen: 12 };

/** Tier price for a room of the given size (m²), rounded to the nearest $500. */
export function tierPrice(room: RoomType, tier: RenoTier, sqm: number): number {
  const m2 = Math.max(Number.isFinite(sqm) && sqm > 0 ? sqm : DEFAULT_SQM[room], MIN_SQM[room]);
  return Math.round((RATE[room][tier] * m2) / 500) * 500;
}

/** What's included at each tier — 3–4 bullets the buyer can scan. */
export const TIER_SCOPE: Record<RoomType, Record<RenoTier, string[]>> = {
  bathroom: {
    basic: ["Retile floor & walls", "Vanity & tapware swap", "New toilet", "Repaint + accessories"],
    mid: ["Full refit", "New shower + glass screen", "Quality fixtures & tapware", "New vanity + lighting"],
    high: ["Full strip-out renovation", "Freestanding bath + walk-in shower", "Premium tiles & stone", "Underfloor heating + heated towel rail"],
  },
  kitchen: {
    basic: ["Reface cabinetry + repaint", "New laminate benchtop", "New sink & tapware", "Appliance refresh"],
    mid: ["New cabinetry", "Stone benchtop", "New appliances", "Tiled splashback + lighting"],
    high: ["Full custom kitchen", "Premium stone benchtop + island", "Integrated high-end appliances", "Scullery / butler's pantry"],
  },
};

export function roomTypeForCategory(category: string | undefined): RoomType | null {
  if (category === "Bathroom") return "bathroom";
  if (category === "Kitchen") return "kitchen";
  return null;
}

/** Short style descriptors used to ground the image-generation prompt. */
export const STYLE_CUE: Record<RenoStyle, string> = {
  Modern: "clean lines, matte black tapware, large-format tiles, minimal handleless cabinetry",
  Coastal: "white and soft blue palette, natural timber, woven textures, relaxed beach-house feel",
  Hamptons: "shaker cabinetry, marble or quartz, brushed nickel, elegant classic American style",
  Scandi: "pale timber, white walls, simple functional fixtures, bright and airy Scandinavian style",
  Industrial: "exposed materials, concrete and steel accents, dark tapware, warehouse-loft feel",
  "Classic NZ": "subway tiles, timber vanity, practical Kiwi villa/bungalow character finishes",
};
