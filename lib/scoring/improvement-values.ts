// ============================================================
// Tectara — ITEMISED IMPROVEMENT VALUATION (v5)
//
// Turns the Improvements scores into a dollar value, one line per component,
// using the Depreciated Replacement Cost (cost approach) method:
//
//   item value = cost to replace it new × share of its life left
//                (base $ × size × spec)    (valueItem / valueRoof)
//
// The two axes are exactly the two we already score:
//   • spec TIER      → sets what it costs to build NEW (SPEC_MULTIPLIER).
//     Never a discount on the value — an ungraded item is the 1.0 reference.
//   • CONDITION 1–10 → moves the item's effective AGE, and the life left does
//     the depreciating (lib/scoring/depreciation.ts). It is the same
//     valueItem() every item card shows, so the cards add up to this.
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
import { effectiveAge, shellLifeRemaining, SHELL_LIFE_YEARS, SHELL_RESIDUAL, type EffectiveAge } from "./depreciation.ts";
import { valueItem, isItemWithheld } from "./item-value.ts";
import { valueRoof, roofMaterialFromText, isWithheld as isRoofWithheld } from "./roof-value.ts";
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
  // Real installs with real replacement costs. They were missing, so they fell
  // through to "intrinsic quality, priced by the market" — which is true of a
  // room's proportions and plainly false of a set of solar panels.
  ext_solar: { baseRCN: 13000, scale: "fixed", note: "Rooftop PV array and inverter" },
  gar_power: { baseRCN: 2200, scale: "fixed", note: "Subcircuit, board and outlets to a garage" },
  gar_construction: { baseRCN: 14000, scale: "fixed" },
  gar_door: { baseRCN: 2500, scale: "fixed" },
  gar_floor: { baseRCN: 2500, scale: "fixed" },

  // Outdoor & grounds
  out_drainage: { baseRCN: 3500, scale: "fixed" },
  out_driveway: { baseRCN: 7000, scale: "fixed" },
  out_fencing: { baseRCN: 4500, scale: "fixed" },
  out_retaining: { baseRCN: 9000, scale: "fixed" },
};

const ITEM_META = new Map(SCORING_MODEL.map((i) => [i.id, i]));

/**
 * An item that has no replacement cost, and never will.
 *
 * A room's proportions, where the light falls, how the kitchen flows, whether
 * the garage is attached — these are real things a buyer cares about and they
 * are worth money, but they are worth it through the LAND and the market, not
 * as a component you could price a tradesman to rebuild. There is no line item
 * for "north-facing".
 *
 * They used to carry points, which is how they said anything at all. With the
 * score gone they are reported as STATED FACTS with no number against them —
 * the same rule Location has always followed. Inventing a dollar value for them
 * would be the invented-staircase habit in a new place, and rounding them to
 * zero would say they don't matter.
 *
 * Derived rather than listed, so adding a cost line is all it takes to stop an
 * item being a fact. Improvements only: a title finding or a hazard is not an
 * "intrinsic quality", it is a risk with a source, and those items report
 * themselves.
 */
export function isFactOnly(id: string): boolean {
  return ITEM_META.get(id)?.inspection === "improvements" && !(id in IMPROVEMENT_BASE_COSTS);
}

export interface ItemValue {
  id: string;
  label: string;
  category: string;
  /** Null when the analysis didn't grade it — priced at the 1.0 reference. */
  tier: SpecTier | null;
  condition: number;
  rcnNew: number; // replacement cost new at THIS property's size and spec
  /** rcnNew plus scaffold, disposal and regional labour — what the card calls the cost to replace. */
  replacementTotal: number;
  valueNow: number; // replacementTotal × life remaining (valueItem)
  /** The age it was depreciated by, so the card's Age chip states the same one. */
  ageYears: number;
  valuePotential: number; // value at modern spec, as-new (the reno ceiling)
  valueGap: number; // max(0, potential − now) — the renovation upside
}

/** The base structure & services, step by step — the house before its fittings. */
export interface ShellWorkings {
  ratePerSqm: number;
  floorAreaSqm: number;
  /** rate × floor area: what the shell costs to build today. */
  costNew: number;
  /** Null when no build year is known — the shell is then treated as new. */
  buildYear: number | null;
  age: EffectiveAge;
  /** The 1–10 read the components present at, RCN-weighted, which moves the age. */
  blendedCondition: number | null;
  lifeYears: number;
  residual: number;
  /** Share of the cost-new still there, 0–1, after the residual floor. */
  remainingFraction: number;
  /** True when the residual floor, not the straight line, set the value. */
  atResidual: boolean;
  value: number;
}

export interface ImprovementValueResult {
  items: ItemValue[];
  componentsValue: number; // Σ valueNow across scored components
  shellValue: number; // base structure & services (depreciated)
  /** How the shell got there, for the base-rate card on the Improvements tab. */
  shell: ShellWorkings;
  buildingValue: number; // shell + components
  totalValueGap: number; // Σ component value gaps (reno upside)
  ratePerSqm: number | null; // buildingValue / floor area
  floorAreaSqm: number;
  /**
   * How much of the building this valuation actually rests on.
   *
   * Unassessed components are skipped outright above — no phantom value — which
   * is right, and invisible. A reader shown a figure built from nine of
   * seventeen components has no way of knowing that unless it is stated, and a
   * valuation is the number they will act on. Weighted by replacement cost
   * rather than counted, because missing the roof is not the same as missing
   * the letterbox.
   */
  coverage: {
    /** Components with a condition score, so genuinely valued. */
    valued: number;
    /** Components this property could have had valued. */
    possible: number;
    /** Share of the building's replacement cost that was assessed, 0–1. */
    byCost: number;
  };
  /** Shell + components somebody actually looked at. */
  confirmedValue: number;
  /**
   * Components nobody could see, valued at the condition the REST of this
   * building presents.
   *
   * Leaving them at zero was its own distortion. A roof that isn't in the
   * photographs is still up there, and on a house finished last year it is
   * almost certainly a new roof — dropping it understated the property by the
   * price of a reroof, and on the map that reads as a worse deal than it is.
   *
   * The estimator is the building itself, not a table of assumptions: the
   * RCN-weighted condition of every component that WAS assessed. Same house,
   * same age, same owner, same maintenance — if thirty-five components present
   * at 8/10, the four nobody photographed are most likely near 8/10 too. A
   * tired house estimates its unseen parts as tired, which is equally right.
   *
   * Capped at the "modern" spec tier however well the rest presents, because
   * top marks require evidence that premium materials were used and an
   * unphotographed component cannot supply it.
   *
   * Zero when nothing at all was assessed — there is no building to reason
   * from, and that is a guess rather than an estimate.
   */
  estimatedValue: number;
  /** Components behind `estimatedValue`, for the report to name. */
  estimatedItems: { id: string; label: string; category: string; rcnNew: number; valueNow: number }[];
}

export interface RoofInputs {
  footprintM2?: number | null;
  pitchDegrees?: number | null;
  roofForm?: string | null;
  /** Material text, when something better than the sub-item's own is known. */
  material?: string | null;
}

const specMult = (tier: SpecTier | null | undefined): number => (tier ? SPEC_MULTIPLIER[tier] : 1);

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
  /** Drives the shell's depreciation. Without it the shell reads as new. */
  buildYear?: number | null;
  /** The region's labour multiplier (resolveRegion). Only labour moves with it. */
  labourMultiplier?: number;
  /**
   * What the roof card measures the roof from. With a material and a footprint
   * the roof is valued exactly as its card values it; without them it falls
   * back to the floor-scaled figure rather than dropping out of the building.
   */
  roof?: RoofInputs;
  now?: Date;
}): ImprovementValueResult {
  const floor = args.floorAreaSqm && args.floorAreaSqm > 0 ? args.floorAreaSqm : 0;
  const baths = Math.max(1, Math.round(args.bathrooms ?? 1));
  const byId = new Map(args.subItems.map((s) => [s.id, s]));
  const now = args.now ?? new Date();

  // THE per-item value — the same seven-step valueItem() every card shows, so
  // the cards add up to the headline. It used to be rcn × spec × a condition
  // factor here and cost-to-replace × life-left on the card: on a fair 1975
  // house the cards summed to a quarter of what the headline counted.
  const depreciate = (id: string, rcnNew: number, conditionScore: number, asNew = false) => {
    const r = valueItem({
      id,
      rcnNew,
      sizeWorkings: [],
      sizeSummary: "",
      conditionScore,
      buildYear: args.buildYear,
      installedYear: asNew ? now.getFullYear() : null,
      labourMultiplier: args.labourMultiplier,
      now,
    });
    return isItemWithheld(r) ? null : r;
  };

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

    // Spec sets what it costs to build NEW; it is never a discount on the
    // value. Applied to the value it let a modern kitchen be "worth" more than
    // it costs to replace. An unread spec is the 1.0 reference — not "dated",
    // which silently took 10% off anything the model didn't grade.
    const tier: SpecTier | null = s.specTier ?? null;
    const condition = s.score;
    const sized = spec.baseRCN * sizeFor(spec.scale, floor, baths);
    const rcnNew = Math.round(sized * specMult(tier));
    if (rcnNew <= 0) continue;

    if (id === "ext_roof") {
      const r = valueRoof({
        material: roofMaterialFromText(args.roof?.material ?? s.material),
        footprintM2: args.roof?.footprintM2 ?? null,
        pitchDegrees: args.roof?.pitchDegrees ?? null,
        roofForm: args.roof?.roofForm ?? null,
        storeys: 1, // same conservative read as the card
        buildYear: args.buildYear,
        conditionScore: condition,
        labourMultiplier: args.labourMultiplier,
        now,
      });
      if (!isRoofWithheld(r)) {
        const rcn = r.cost.materialsNZD + r.cost.labourNZD;
        items.push({ id, label: meta.label, category: meta.category, tier, condition, rcnNew: rcn, replacementTotal: r.cost.totalNZD, valueNow: r.valueNZD, ageYears: r.age.effectiveYears, valuePotential: r.cost.totalNZD, valueGap: r.cost.totalNZD - r.valueNZD });
        componentsValue += r.valueNZD;
        totalValueGap += r.cost.totalNZD - r.valueNZD;
        wRcn += rcn;
        wRcnCond += rcn * conditionFactor(condition);
        continue;
      }
    }

    const v = depreciate(id, rcnNew, condition);
    if (!v) continue;
    const potential = depreciate(id, Math.round(sized * RENO_TARGET_MULT), 10, true);
    const valueNow = v.valueNZD;
    const valuePotential = potential ? potential.valueNZD : valueNow;
    const valueGap = Math.max(0, valuePotential - valueNow);

    items.push({ id, label: meta.label, category: meta.category, tier, condition, rcnNew, replacementTotal: v.cost.totalNZD, valueNow, ageYears: v.age.effectiveYears, valuePotential, valueGap });
    componentsValue += valueNow;
    totalValueGap += valueGap;
    wRcn += rcnNew;
    wRcnCond += rcnNew * conditionFactor(condition);
  }

  // What the valuation is standing on. Counted here rather than inferred later:
  // a second pass over IMPROVEMENT_BASE_COSTS is the only way to know what this
  // property COULD have had valued, and only this function knows its sizing.
  let possible = 0;
  let rcnPossible = 0;
  for (const [id, spec] of Object.entries(IMPROVEMENT_BASE_COSTS)) {
    if (!ITEM_META.get(id)) continue;
    const rcn = Math.round(spec.baseRCN * sizeFor(spec.scale, floor, baths));
    if (rcn <= 0) continue;
    possible++;
    rcnPossible += rcn;
  }

  // ── The shell, depreciated by its AGE rather than by a condition factor ───
  //
  // It costs the same to build a shell today whatever year the house went up —
  // what differs is how much of its life is left. So the age does the work, and
  // the components' blended condition only shifts the EFFECTIVE age: a house
  // whose visible parts are all shot has probably not had its wiring done
  // either. Applying both a condition factor and a life fraction would discount
  // the same wear twice.
  //
  // It floors at SHELL_RESIDUAL. A 1925 villa's frame is a hundred years old
  // and holding a house up; straight-lining it to zero would say the structure
  // of every pre-war house in New Zealand is worth nothing.
  const blendedCond = wRcn > 0 ? wRcnCond / wRcn : conditionFactor(6);
  // conditionFactor maps 1→0.37 and 10→1.0; invert it back to a 1–10 read so
  // the shared effectiveAge() rule sees the same scale every other item does.
  const blendedScore = Math.max(1, Math.min(10, (blendedCond - 0.3) / 0.07));
  const year = (args.now ?? new Date()).getFullYear();
  const shellChronYears = args.buildYear ? Math.max(0, year - args.buildYear) : 0;
  const shellAge = effectiveAge({
    chronologicalYears: shellChronYears,
    conditionScore: args.buildYear ? blendedScore : null,
    noun: "structure",
  });
  const shellLifeFactor = args.buildYear ? shellLifeRemaining(shellAge.effectiveYears) : 1;
  const shellValue = floor > 0 ? Math.round(BASE_SHELL_RATE * floor * shellLifeFactor) : 0;
  const shell: ShellWorkings = {
    ratePerSqm: BASE_SHELL_RATE,
    floorAreaSqm: floor,
    costNew: Math.round(BASE_SHELL_RATE * floor),
    buildYear: args.buildYear ?? null,
    age: shellAge,
    blendedCondition: args.buildYear && wRcn > 0 ? Math.round(blendedScore * 10) / 10 : null,
    lifeYears: SHELL_LIFE_YEARS,
    residual: SHELL_RESIDUAL,
    remainingFraction: shellLifeFactor,
    atResidual: !!args.buildYear && 1 - shellAge.effectiveYears / SHELL_LIFE_YEARS <= SHELL_RESIDUAL,
    value: shellValue,
  };

  // ── What we could not see, estimated from what we could ──────────────────
  // Only ever from a building that was actually assessed. With nothing to
  // reason from, nothing is estimated.
  const estimatedItems: ImprovementValueResult["estimatedItems"] = [];
  let estimatedValue = 0;
  if (wRcn > 0 && items.length > 0) {
    const blendedSpec = Math.min(
      items.reduce((sum, i) => sum + specMult(i.tier) * i.rcnNew, 0) / wRcn,
      SPEC_MULTIPLIER.modern // never luxury without evidence
    );
    for (const [id, spec] of Object.entries(IMPROVEMENT_BASE_COSTS)) {
      const meta = ITEM_META.get(id);
      if (!meta) continue;
      const seen = byId.get(id);
      if (seen && seen.score != null) continue; // already valued for real
      const rcnNew = Math.round(spec.baseRCN * sizeFor(spec.scale, floor, baths) * blendedSpec);
      if (rcnNew <= 0) continue;
      const valueNow = depreciate(id, rcnNew, blendedScore)?.valueNZD ?? 0;
      estimatedItems.push({ id, label: meta.label, category: meta.category, rcnNew, valueNow });
      estimatedValue += valueNow;
    }
  }

  const confirmedValue = shellValue + componentsValue;
  const buildingValue = confirmedValue + estimatedValue;
  return {
    items,
    componentsValue,
    shellValue,
    shell,
    buildingValue,
    totalValueGap,
    confirmedValue,
    estimatedValue,
    estimatedItems,
    coverage: {
      valued: items.length,
      possible,
      byCost: rcnPossible > 0 ? wRcn / rcnPossible : 0,
    },
    ratePerSqm: floor > 0 ? Math.round(buildingValue / floor) : null,
    floorAreaSqm: floor,
  };
}
