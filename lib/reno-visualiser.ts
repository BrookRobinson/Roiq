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

// Scope-based pricing: a fixed component cost + a per-m² rate. A "Basic" 1–2
// element swap stays cheap (barely scales with size) while "Mid" / "High" scale
// with the room. Calibrated: 5m² bathroom → ~$1,500 / $12,000 / $24,000;
// 12m² kitchen → ~$5,500 / $18,000 / $35,500.
const RATE: Record<RoomType, Record<RenoTier, { fixed: number; perSqm: number }>> = {
  bathroom: {
    basic: { fixed: 1000, perSqm: 100 },
    mid: { fixed: 3000, perSqm: 1800 },
    high: { fixed: 6000, perSqm: 3600 },
  },
  kitchen: {
    basic: { fixed: 3500, perSqm: 150 },
    mid: { fixed: 6000, perSqm: 1000 },
    high: { fixed: 9000, perSqm: 2200 },
  },
};

const MIN_SQM: Record<RoomType, number> = { bathroom: 3, kitchen: 6 };
export const DEFAULT_SQM: Record<RoomType, number> = { bathroom: 5, kitchen: 12 };

/** Tier price for a room of the given size (m²), rounded to the nearest $500. */
export function tierPrice(room: RoomType, tier: RenoTier, sqm: number): number {
  const m2 = Math.max(Number.isFinite(sqm) && sqm > 0 ? sqm : DEFAULT_SQM[room], MIN_SQM[room]);
  const r = RATE[room][tier];
  return Math.round((r.fixed + r.perSqm * m2) / 500) * 500;
}

// What changes at each tier. Basic = 1–2 elements (everything else identical),
// Mid = 3–4 elements, High = full redesign.
export const TIER_SCOPE: Record<RoomType, Record<RenoTier, string[]>> = {
  bathroom: {
    basic: ["Swap the vanity + tapware only", "Keep existing tiles, mirror, toilet, shower & layout"],
    mid: ["New vanity, tapware & toilet", "Re-tile the floor", "New mirror + lighting", "Keep the existing layout"],
    high: ["Full strip-out redesign", "New layout, tiling, glass shower & fixtures", "Premium finishes throughout"],
  },
  kitchen: {
    basic: ["New benchtop + sink/tapware only", "Keep existing cabinets, splashback & layout"],
    mid: ["Reface cabinetry + new benchtop", "New sink, tapware & appliances", "Keep the existing layout"],
    high: ["Full custom redesign", "New cabinetry, stone benchtop & island", "Integrated appliances + new layout"],
  },
};

/**
 * Per-tier image-edit guidance, used to build the gpt-image-1 prompt so the
 * renders are HONEST about scope. Basic changes only 1–2 elements and keeps
 * everything else identical; Mid changes 3–4; High is a full redesign. Each
 * `change` clause is written to be followed by "<style> style".
 */
export const TIER_EDIT: Record<RoomType, Record<RenoTier, { change: string; keep: string }>> = {
  bathroom: {
    basic: {
      change: "ONLY replace the vanity unit and the basin tapware with new ones in a",
      keep: "Every other element MUST stay exactly the same as the original — the existing wall tiles, floor tiles, mirror, toilet, shower, bath, towel rail, window and lighting are unchanged, and the layout is identical.",
    },
    mid: {
      change: "Replace the vanity, tapware and toilet, re-tile the floor, and fit a new mirror and lighting, all in a",
      keep: "Keep the existing room layout, window and door positions, and shower/bath location the same as the original.",
    },
    high: {
      change: "Fully redesign the whole bathroom — new wall and floor tiling, new vanity, toilet, walk-in glass shower, tapware, lighting and finishes throughout, in a",
      keep: "Preserve only the room's footprint, the window and door positions, and the camera viewpoint.",
    },
  },
  kitchen: {
    basic: {
      change: "ONLY replace the benchtop and the sink/tapware with new ones in a",
      keep: "Every other element MUST stay exactly the same as the original — the existing cabinetry, cabinet doors, splashback, appliances, flooring and lighting are unchanged, and the layout is identical.",
    },
    mid: {
      change: "Reface the cabinetry, fit a new benchtop, new sink and tapware, and update the appliances, all in a",
      keep: "Keep the existing kitchen layout, cabinet positions and window positions the same as the original.",
    },
    high: {
      change: "Fully redesign the whole kitchen — new cabinetry, stone benchtop, island, integrated appliances, splashback and lighting, in a",
      keep: "Preserve only the room's footprint, the window and door positions, and the camera viewpoint.",
    },
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
