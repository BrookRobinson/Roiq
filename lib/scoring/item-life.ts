// ============================================================
// How long each component lasts, and how its replacement cost splits.
//
// This is the data the roof model needed and every other item was missing. The
// costs were already calibrated in IMPROVEMENT_BASE_COSTS; what was absent was
// the other half of a depreciated replacement cost — how much of that life has
// gone.
//
// ── On the numbers ──────────────────────────────────────────────────────────
// Service lives are the ranges the New Zealand building industry works to for
// a component installed properly and maintained normally. They are NOT
// warranties and they are NOT quotes. Nothing fetched them. Like the roof
// rates, they live in one place so a real cost source replaces them wholesale.
//
// Ranges are deliberately WIDE where the material varies more than the item
// does — "flooring" is carpet at eight years and native timber at eighty, so
// its range spans both and the midpoint means less than it does for a hot
// water cylinder. Where a range is wide, the report leans harder on what the
// photographs showed than on the arithmetic.
//
// `scaffold` marks the items you cannot reach from a ladder. It is the single
// biggest hidden cost on exterior work and it is why a $12,000 reclad quote
// comes back at $19,000.
// ============================================================

export interface ItemLife {
  /** Service life in years, low and high, done properly. */
  lifeLow: number;
  lifeHigh: number;
  /** Share of the replacement cost that is material rather than labour. */
  materialShare: number;
  /** Strip-and-dispose, as a share of the replacement cost. */
  disposalShare: number;
  /** True when replacing it needs scaffold. */
  scaffold?: boolean;
  /**
   * A residual the item may never fall below, 0–1.
   *
   * Zero for anything that wears out and goes in a skip. Above zero only for
   * the structural elements a house keeps standing on — the same reason the
   * shell floors at 25%.
   */
  residual?: number;
  /** Said on the card when it changes what a reader should do. */
  note?: string;
}

export const ITEM_LIFE: Record<string, ItemLife> = {
  // ── Exterior ───────────────────────────────────────────────────────────────
  ext_foundation: {
    lifeLow: 80, lifeHigh: 120, materialShare: 0.45, disposalShare: 0.05, residual: 0.3,
    note: "A foundation is replaced almost never; it is repaired, re-piled or re-levelled.",
  },
  ext_cladding: {
    lifeLow: 40, lifeHigh: 60, materialShare: 0.4, disposalShare: 0.08, scaffold: true,
    note: "Weatherboard at the long end, monolithic plaster at the short.",
  },
  ext_windows: { lifeLow: 35, lifeHigh: 50, materialShare: 0.6, disposalShare: 0.05, scaffold: true },
  ext_decking: { lifeLow: 15, lifeHigh: 25, materialShare: 0.45, disposalShare: 0.07 },
  ext_gutters: { lifeLow: 20, lifeHigh: 35, materialShare: 0.4, disposalShare: 0.05, scaffold: true },
  ext_soffits: { lifeLow: 30, lifeHigh: 45, materialShare: 0.35, disposalShare: 0.06, scaffold: true },
  ext_doors: { lifeLow: 25, lifeHigh: 40, materialShare: 0.6, disposalShare: 0.04 },
  ext_paint: {
    lifeLow: 7, lifeHigh: 12, materialShare: 0.2, disposalShare: 0.02, scaffold: true,
    note: "Paint is protection, not decoration. The clock starts the day it goes on.",
  },
  ext_chimney: { lifeLow: 50, lifeHigh: 80, materialShare: 0.4, disposalShare: 0.1, scaffold: true },
  ext_solar: {
    lifeLow: 20, lifeHigh: 28, materialShare: 0.7, disposalShare: 0.03, scaffold: true,
    note: "Panels outlast the inverter, which is usually replaced once at 10–15 years.",
  },

  // ── Kitchen ────────────────────────────────────────────────────────────────
  kit_cabinetry: { lifeLow: 15, lifeHigh: 30, materialShare: 0.55, disposalShare: 0.05 },
  kit_appliances: {
    lifeLow: 10, lifeHigh: 15, materialShare: 0.85, disposalShare: 0.02,
    note: "Chattels. What stays is whatever the sale and purchase agreement lists.",
  },
  kit_benchtop: { lifeLow: 15, lifeHigh: 30, materialShare: 0.6, disposalShare: 0.05 },
  kit_flooring: { lifeLow: 12, lifeHigh: 25, materialShare: 0.5, disposalShare: 0.06 },
  kit_sink: { lifeLow: 15, lifeHigh: 25, materialShare: 0.6, disposalShare: 0.03 },
  kit_splashback: { lifeLow: 15, lifeHigh: 30, materialShare: 0.45, disposalShare: 0.05 },

  // ── Bathroom ───────────────────────────────────────────────────────────────
  bath_shower: { lifeLow: 15, lifeHigh: 25, materialShare: 0.5, disposalShare: 0.06 },
  bath_waterproof: {
    lifeLow: 15, lifeHigh: 25, materialShare: 0.25, disposalShare: 0.1,
    note: "Behind the tiles. Replacing it means taking the wet area apart, which is most of the cost.",
  },
  bath_hotwater: {
    lifeLow: 15, lifeHigh: 20, materialShare: 0.6, disposalShare: 0.04,
    note: "A cylinder at the long end, a gas califont at the short.",
  },
  bath_vanity: { lifeLow: 12, lifeHigh: 20, materialShare: 0.65, disposalShare: 0.04 },
  bath_toilet: { lifeLow: 15, lifeHigh: 25, materialShare: 0.6, disposalShare: 0.04 },
  bath_ventilation: { lifeLow: 8, lifeHigh: 15, materialShare: 0.5, disposalShare: 0.03 },
  bath_flooring: { lifeLow: 12, lifeHigh: 22, materialShare: 0.45, disposalShare: 0.06 },

  // ── Living ─────────────────────────────────────────────────────────────────
  liv_heating: {
    lifeLow: 12, lifeHigh: 20, materialShare: 0.6, disposalShare: 0.03,
    note: "A heat pump at the short end, a woodburner at the long.",
  },
  liv_fixtures: {
    lifeLow: 40, lifeHigh: 60, materialShare: 0.35, disposalShare: 0.03,
    note: "Wiring. Pre-1960s cloth or rubber cable is at the end of its life whatever it looks like.",
  },
  liv_insulation: {
    lifeLow: 30, lifeHigh: 50, materialShare: 0.55, disposalShare: 0.04,
    note: "Settles and thins rather than failing outright, so the date it was installed matters more than how it looks.",
  },
  liv_flooring: {
    lifeLow: 12, lifeHigh: 35, materialShare: 0.5, disposalShare: 0.06,
    note: "Carpet at the short end, native timber at the long. A wide range on purpose.",
  },
  liv_ceiling: { lifeLow: 40, lifeHigh: 60, materialShare: 0.35, disposalShare: 0.07 },

  // ── Bedrooms ───────────────────────────────────────────────────────────────
  bed_heating: { lifeLow: 12, lifeHigh: 20, materialShare: 0.6, disposalShare: 0.03 },
  bed_storage: { lifeLow: 20, lifeHigh: 35, materialShare: 0.55, disposalShare: 0.04 },
  bed_flooring: { lifeLow: 12, lifeHigh: 30, materialShare: 0.5, disposalShare: 0.06 },
  bed_ceiling: { lifeLow: 40, lifeHigh: 60, materialShare: 0.35, disposalShare: 0.07 },

  // ── Garage ─────────────────────────────────────────────────────────────────
  gar_construction: { lifeLow: 40, lifeHigh: 60, materialShare: 0.45, disposalShare: 0.08, residual: 0.2 },
  gar_door: { lifeLow: 15, lifeHigh: 25, materialShare: 0.65, disposalShare: 0.04 },
  gar_floor: { lifeLow: 50, lifeHigh: 80, materialShare: 0.5, disposalShare: 0.1, residual: 0.2 },
  gar_power: { lifeLow: 30, lifeHigh: 45, materialShare: 0.4, disposalShare: 0.02 },

  // ── Outdoors ───────────────────────────────────────────────────────────────
  out_drainage: {
    lifeLow: 40, lifeHigh: 70, materialShare: 0.35, disposalShare: 0.05, residual: 0.15,
    note: "Underground and out of sight, so its age is the build date unless something says otherwise.",
  },
  out_driveway: {
    lifeLow: 25, lifeHigh: 45, materialShare: 0.45, disposalShare: 0.1,
    note: "Concrete at the long end, chip seal and asphalt at the short.",
  },
  out_fencing: { lifeLow: 15, lifeHigh: 25, materialShare: 0.5, disposalShare: 0.06 },
  out_retaining: {
    lifeLow: 20, lifeHigh: 40, materialShare: 0.45, disposalShare: 0.08,
    note: "Treated timber at the short end, concrete or block at the long.",
  },
};

export const lifeFor = (id: string): ItemLife | null => ITEM_LIFE[id] ?? null;

/** Midpoint of the range — what the depreciation actually runs against. */
export const expectedLife = (l: ItemLife): number => Math.round((l.lifeLow + l.lifeHigh) / 2);
