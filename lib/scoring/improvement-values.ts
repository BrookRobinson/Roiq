// ============================================================
// RoiQ — ITEMISED IMPROVEMENT VALUATION (v5)
//
// Turns the Improvements scores into a dollar value, one line per component,
// using the Depreciated Replacement Cost (cost approach) method:
//
//   item value = Replacement-Cost-New × spec multiplier × condition factor
//                    (base $ per item)    (tier = quality)   (depreciation)
//
// The two axes are exactly the two we already score:
//   • spec TIER      → sets what it costs to build NEW (SPEC_MULTIPLIER).
//   • CONDITION 1–10 → depreciates it (conditionFactor: new→1.0, poor→0.37).
//
// Building value = a base structure/services SHELL (framing, linings, wiring,
// plumbing rough-in, prelims & margin — real cost, but NOT individually visible
// so it isn't scored) PLUS the sum of the scored components below.
//
// Only COST-BEARING physical components carry a dollar value. Intrinsic qualities
// (sun/aspect, size, flow, layout, natural light) are scored but priced by the
// market/land, not as a build component — they carry no $ here (by design).
//
// Base costs are calibrated to lib/materials-db.ts + lib/reno-costing + typical
// NZ 2026 costs. They are deliberately explicit and tunable.
// ============================================================

import { SCORING_MODEL } from "./model";
import { SPEC_MULTIPLIER, conditionFactor } from "./valuation";
import type { SpecTier, SubItem } from "@/lib/property-tab/types";

/** How a component's base cost scales to THIS property. */
export type ScaleBasis =
  | "fixed" // one per house, size-independent (e.g. a kitchen, a hot-water cylinder)
  | "floorM2" // scales with floor area (structure, roof, cladding, insulation)
  | "bathroom"; // scales with the number of bathrooms (shower, vanity, toilet…)

export interface ItemCostSpec {
  baseRCN: number; // replacement cost NEW at the 1.0 reference spec, per the scale unit
  scale: ScaleBasis;
  note?: string;
}

/** $/floor-m² for the base structure & services shell — the real build cost that
 * ISN'T individually scored (framing, gib, ceilings, wiring, plumbing rough-in,
 * consents, prelims, builder's margin). Depreciated by the blended condition. */
export const BASE_SHELL_RATE = 1100;

/** The spec ceiling used for the "value gap" (uplift if renovated to modern). */
const RENO_TARGET_MULT = SPEC_MULTIPLIER.modern; // modern, as-new

// ── Per-item base replacement cost (NEW, at the 1.0 reference spec) ────────────
// Reference home ≈ 150 m², 1 bathroom. `floorM2`/`bathroom` items scale from here.
export const IMPROVEMENT_BASE_COSTS: Record<string, ItemCostSpec> = {
  // Exterior
  ext_foundation: { baseRCN: 200, scale: "floorM2", note: "Slab/piles equivalent per floor m²" },
  ext_roof: { baseRCN: 170, scale: "floorM2", note: "Reroof, roof area ≈ floor area" },
  ext_cladding: { baseRCN: 150, scale: "floorM2", note: "Recladding, wall area approximated via floor" },
  ext_windows: { baseRCN: 16000, scale: "fixed", note: "Full joinery replacement, standard home" },
  ext_decking: { baseRCN: 9000, scale: "fixed" },
  ext_gutters: { baseRCN: 5000, scale: "fixed" },
  ext_soffits: { baseRCN: 4500, scale: "fixed" },
  ext_doors: { baseRCN: 4000, scale: "fixed", note: "Exterior doors & external joinery" },
  ext_paint: { baseRCN: 60, scale: "floorM2", note: "Full exterior repaint per floor m²" },
  ext_chimney: { baseRCN: 6000, scale: "fixed" },

  // Kitchen (one per house)
  kit_cabinetry: { baseRCN: 10000, scale: "fixed" },
  kit_appliances: { baseRCN: 7000, scale: "fixed" },
  kit_benchtop: { baseRCN: 3500, scale: "fixed" },
  kit_flooring: { baseRCN: 2500, scale: "fixed" },
  kit_sink: { baseRCN: 900, scale: "fixed" },
  kit_splashback: { baseRCN: 1300, scale: "fixed" },

  // Bathroom (per bathroom, except the whole-house hot-water system)
  bath_shower: { baseRCN: 4500, scale: "bathroom" },
  bath_waterproof: { baseRCN: 2500, scale: "bathroom" },
  bath_hotwater: { baseRCN: 2800, scale: "fixed", note: "Cylinder / califont — whole house" },
  bath_vanity: { baseRCN: 1600, scale: "bathroom" },
  bath_toilet: { baseRCN: 800, scale: "bathroom" },
  bath_ventilation: { baseRCN: 650, scale: "bathroom" },
  bath_flooring: { baseRCN: 1200, scale: "bathroom" },

  // Living areas
  liv_heating: { baseRCN: 5000, scale: "fixed", note: "Heat pump(s) / primary heat source" },
  liv_fixtures: { baseRCN: 3000, scale: "fixed", note: "Light fittings, downlights, switches" },
  liv_insulation: { baseRCN: 35, scale: "floorM2", note: "Ceiling + underfloor per floor m²" },
  liv_flooring: { baseRCN: 30, scale: "floorM2" },
  liv_ceiling: { baseRCN: 2500, scale: "fixed" },

  // Bedrooms (across all)
  bed_heating: { baseRCN: 1500, scale: "fixed" },
  bed_storage: { baseRCN: 2500, scale: "fixed", note: "Wardrobes across bedrooms" },
  bed_flooring: { baseRCN: 3000, scale: "fixed" },
  bed_ceiling: { baseRCN: 1200, scale: "fixed" },

  // Garage (skipped automatically if not present / not assessed)
  gar_construction: { baseRCN: 14000, scale: "fixed" },
  gar_door: { baseRCN: 2500, scale: "fixed" },
  gar_floor: { baseRCN: 2500, scale: "fixed" },

  // Outdoor & grounds
  out_drainage: { baseRCN: 3500, scale: "fixed" },
  out_driveway: { baseRCN: 7000, scale: "fixed" },
  out_fencing: { baseRCN: 4500, scale: "fixed" },
  out_retaining: { baseRCN: 9000, scale: "fixed" },
  out_pool: { baseRCN: 45000, scale: "fixed" },
};

const ITEM_META = new Map(SCORING_MODEL.map((i) => [i.id, i]));

export interface ItemValue {
  id: string;
  label: string;
  category: string;
  tier: SpecTier;
  condition: number;
  rcnNew: number; // replacement cost new at THIS property's size, 1.0 reference spec
  valueNow: number; // depreciated current value (tier × condition)
  valuePotential: number; // value at modern spec, as-new (the reno ceiling)
  valueGap: number; // max(0, potential − now) — the renovation upside
}

export interface ImprovementValueResult {
  items: ItemValue[];
  componentsValue: number; // Σ valueNow across scored components
  shellValue: number; // base structure & services (depreciated)
  buildingValue: number; // shell + components
  totalValueGap: number; // Σ component value gaps (reno upside)
  ratePerSqm: number | null; // buildingValue / floor area
  floorAreaSqm: number;
}

function sizeFor(scale: ScaleBasis, floor: number, baths: number): number {
  if (scale === "floorM2") return floor;
  if (scale === "bathroom") return baths;
  return 1;
}

/**
 * Value every scored, cost-bearing improvement as a depreciated replacement cost,
 * plus a base structure/services shell, summing to a building value. Persona-neutral
 * (a house is worth what it's worth regardless of buyer vs investor).
 */
export function valueImprovementItems(args: {
  subItems: SubItem[];
  floorAreaSqm: number | null;
  bathrooms?: number | null;
}): ImprovementValueResult {
  const floor = args.floorAreaSqm && args.floorAreaSqm > 0 ? args.floorAreaSqm : 0;
  const baths = Math.max(1, Math.round(args.bathrooms ?? 1));
  const byId = new Map(args.subItems.map((s) => [s.id, s]));

  const items: ItemValue[] = [];
  let componentsValue = 0;
  let totalValueGap = 0;
  let wRcn = 0; // Σ rcnNew (for the blended shell depreciation)
  let wRcnCond = 0; // Σ rcnNew × conditionFactor

  for (const [id, spec] of Object.entries(IMPROVEMENT_BASE_COSTS)) {
    const meta = ITEM_META.get(id);
    if (!meta) continue;
    const s = byId.get(id);
    if (!s || s.score == null) continue; // not present / not assessed → no phantom value

    const tier: SpecTier = s.specTier ?? "dated";
    const condition = s.score;
    const rcnNew = Math.round(spec.baseRCN * sizeFor(spec.scale, floor, baths));
    if (rcnNew <= 0) continue;

    const valueNow = Math.round(rcnNew * SPEC_MULTIPLIER[tier] * conditionFactor(condition));
    const valuePotential = Math.round(rcnNew * RENO_TARGET_MULT * conditionFactor(10));
    const valueGap = Math.max(0, valuePotential - valueNow);

    items.push({ id, label: meta.label, category: meta.category, tier, condition, rcnNew, valueNow, valuePotential, valueGap });
    componentsValue += valueNow;
    totalValueGap += valueGap;
    wRcn += rcnNew;
    wRcnCond += rcnNew * conditionFactor(condition);
  }

  // Base shell depreciates by the components' blended (RCN-weighted) condition.
  const shellCondFactor = wRcn > 0 ? wRcnCond / wRcn : conditionFactor(6);
  const shellValue = floor > 0 ? Math.round(BASE_SHELL_RATE * floor * shellCondFactor) : 0;

  const buildingValue = shellValue + componentsValue;
  return {
    items,
    componentsValue,
    shellValue,
    buildingValue,
    totalValueGap,
    ratePerSqm: floor > 0 ? Math.round(buildingValue / floor) : null,
    floorAreaSqm: floor,
  };
}
