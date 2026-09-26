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
import { effectiveAge, shellLifeRemaining, actionFor, SHELL_LIFE_YEARS, SHELL_RESIDUAL, type EffectiveAge, type Action } from "./depreciation.ts";
import { valueItem, isItemWithheld } from "./item-value.ts";
import { valueRoof, roofMaterialFromText, isWithheld as isRoofWithheld } from "./roof-value.ts";
import type { SpecTier, SubItem, ShowerType, FloorType } from "@/lib/property-tab/types";

/** How a component's base cost scales to THIS property. */
export type ScaleBasis =
  | "fixed" // one per house, size-independent (e.g. a kitchen, a hot-water cylinder)
  | "floorM2" // scales with floor area (structure, roof, cladding, insulation)
  | "bathroom" // scales with the number of bathrooms (shower, vanity, toilet…)
  | "bedroom"; // scales with the number of bedrooms (wardrobes, heating, carpet)

export interface ItemCostSpec {
  baseRCN: number; // replacement cost NEW at the 1.0 reference spec, per the scale unit
  scale: ScaleBasis;
  note?: string;
}

/**
 * The base rate of the house: only what is HIDDEN behind the linings.
 *
 * Framing, the electrical pre-wire (cable to the boxes, not the switches and
 * fittings — those are liv_fixtures), consents, preliminaries and the
 * builder's margin. Linings used to be in here too, but they are visible in
 * every interior photo, so walls (liv_walls) and ceilings are graded items now.
 *
 * $755 is the old all-in $1,100 less linings (~$275/floor m²) and the plumbing
 * rough-in's share on the 150 m², one-bathroom reference house (~$70) — so the
 * reference house costs the same $165,000 to build as before, just itemised.
 */
export const BASE_SHELL_RATE = 755;

/**
 * Plumbing rough-in: the supply and waste pipework run through the frame and
 * floor, ending at capped stub-outs and signed off at the pre-line inspection
 * before the linings go on. Fit-off (taps, toilets, basins, showers, the
 * cylinder) happens after the linings and is on those items' own cards.
 *
 * It scales with the bathrooms, not the floor: a 200 m² house with one
 * bathroom has far less pipe in its walls than a 150 m² one with three.
 */
export const ROUGH_IN_BASE = 5000; // water in, kitchen, laundry, cylinder feed
export const ROUGH_IN_PER_BATHROOM = 5500;

/** The spec ceiling used for the "value gap" (uplift if renovated to modern). */
const RENO_TARGET_MULT = SPEC_MULTIPLIER.modern; // modern, as-new

// ── Per-item base replacement cost (NEW, at the 1.0 reference spec) ────────────
// Reference home ≈ 150 m², 1 bathroom, 3 bedrooms. `floorM2`/`bathroom`/`bedroom` items scale from here.
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
  // Linings are priced per floor m², out of the old all-in shell rate. Walls
  // present about 2.5× the floor area in surface, ceilings about 1×, at roughly
  // $70/m² of surface to supply, fix and stop plasterboard. The ceiling line
  // here covers every room but the bedrooms; bed_ceiling covers those.
  liv_walls: { baseRCN: 175, scale: "floorM2", note: "Supply, fix and stop plasterboard to every wall" },
  liv_ceiling: { baseRCN: 60, scale: "floorM2", note: "Ceilings to living, kitchen, hall and wet areas" },

  // Bedrooms (across all)
  // Per bedroom now, so a five-bedroom house has more wardrobes than a
  // two-bedroom one. The old whole-house figures ($1,500 / $2,500 / $3,000)
  // were for three bedrooms, so the reference house moves only by the $50 the
  // wardrobe figure was rounded up.
  bed_heating: { baseRCN: 500, scale: "bedroom", note: "Panel heater or equivalent, per bedroom" },
  bed_storage: { baseRCN: 850, scale: "bedroom", note: "Built-in wardrobe, per bedroom" },
  bed_flooring: { baseRCN: 1000, scale: "bedroom", note: "Carpet, per bedroom" },
  bed_ceiling: { baseRCN: 40, scale: "floorM2", note: "Bedroom ceilings" },

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

/**
 * The waterproof membrane behind a TILED shower, per shower.
 *
 * Tiles and grout aren't waterproof; the membrane under them is. It can't be
 * photographed, so it is never assessed — a shower done under a consent was
 * inspected for it — but it is part of what a tiled shower costs to replace,
 * so it is assumed present and priced in. A moulded liner and tray is its own
 * waterproof layer and carries none. This is the old waterproofing item's
 * figure, now attached to the one kind of shower that has one.
 */
export const SHOWER_MEMBRANE = 2500;

/**
 * Tiled or liner, from the analysis's own words when it didn't say. Any tile
 * wins — a liner tray with tiled walls still has tiles to waterproof behind.
 * Null rather than a guess: an unknown shower is priced as the plain one.
 */
export function showerTypeFromText(text: string | null | undefined): ShowerType | null {
  if (!text) return null;
  if (/\btil(e|ed|es|ing)\b/i.test(text)) return "tiled";
  if (/acrylic|liner|fibreglass|fiberglass|moulded|molded|one[- ]piece|\bpanels?\b|cubicle/i.test(text)) return "liner";
  return null;
}

export const showerTypeOf = (x: { showerType?: ShowerType; material?: string | null }): ShowerType | null =>
  x.showerType ?? showerTypeFromText(x.material);

/**
 * The membrane under a TILED bathroom floor, per bathroom — the same reasoning
 * as the shower's: grout isn't waterproof, the membrane under it is, nobody can
 * see it, so it is assumed and priced. Smaller than the shower's: a floor is
 * a flat few square metres with upturns, not three walls and a tray.
 */
export const FLOOR_MEMBRANE = 800;

/** Tiled or vinyl, from the analysis's own words when it didn't say. */
export function floorTypeFromText(text: string | null | undefined): FloorType | null {
  if (!text) return null;
  if (/\btil(e|ed|es|ing)\b/i.test(text)) return "tiled";
  if (/vinyl|\blino|linoleum|\bsheet\b/i.test(text)) return "vinyl";
  return null;
}

export const floorTypeOf = (x: { floorType?: FloorType; material?: string | null }): FloorType | null =>
  x.floorType ?? floorTypeFromText(x.material);

type WetAreaRead = { showerType?: ShowerType; floorType?: FloorType; material?: string | null };

/** The membrane an item carries, if it is tiled wet-area work. */
export function membraneFor(id: string, x: WetAreaRead): number {
  if (id === "bath_shower" && showerTypeOf(x) === "tiled") return SHOWER_MEMBRANE;
  if (id === "bath_flooring" && floorTypeOf(x) === "tiled") return FLOOR_MEMBRANE;
  return 0;
}

/** Items whose cost depends on their own read (tiled or not), room by room. */
const HAS_MEMBRANE = new Set(["bath_shower", "bath_flooring"]);

/** One unit's cost new before spec: tiled wet-area work carries its membrane. */
function unitBase(id: string, spec: ItemCostSpec, x: WetAreaRead): number {
  return spec.baseRCN + membraneFor(id, x);
}

export type RoomKind = "bathroom" | "bedroom";

/**
 * Which rooms an item is spread across, when it is read room by room. The
 * bedroom ceilings are priced by floor area but are still one ceiling per
 * bedroom, so they are read that way too — each room's share of the item's
 * cost is the item's cost over the room count.
 */
export function roomKindOf(id: string): RoomKind | null {
  const spec = IMPROVEMENT_BASE_COSTS[id];
  if (!spec) return null;
  if (spec.scale === "bathroom") return "bathroom";
  if (spec.scale === "bedroom" || id === "bed_ceiling") return "bedroom";
  return null;
}

/** The items read and valued room by room — each bathroom or bedroom on its own. */
export const ROOM_ITEM_IDS: ReadonlySet<string> = new Set(
  Object.keys(IMPROVEMENT_BASE_COSTS).filter((id) => roomKindOf(id) !== null)
);

/** A missing bedroom count is the reference house's three — what the old whole-house figures assumed. */
export const DEFAULT_BEDROOMS = 3;

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
  /** No life left: replacing it is the action, and any repair only a stop-gap. */
  pastLife: boolean;
  /**
   * Years until it needs replacing, on the same life the card shows (negative =
   * overdue). The renovation plan dates work from THIS, not from the condition
   * score: a 7/10 foundation has decades left, and "7/10 means due in about
   * seven years" put it in every ten-year plan.
   */
  yearsLeft: number;
  valuePotential: number; // value at modern spec, as-new (the reno ceiling)
  valueGap: number; // max(0, potential − now) — the renovation upside
  /**
   * What the urgent work costs. Set only where it isn't `share × replacementTotal`
   * — a per-bathroom item, where the work is in one bathroom and the
   * replacement total covers all of them.
   */
  actionCostNZD?: number;
  /** Per-bathroom items: each bathroom that was seen, valued on its own read. */
  byRoom?: RoomValue[];
  /** Bathrooms no photograph shows. Estimated from the rest of the house, not valued here. */
  unseenRooms?: string[];
}

export interface RoomValue {
  room: string;
  condition: number;
  tier: SpecTier | null;
  material?: string;
  showerType?: ShowerType;
  floorType?: FloorType;
  observedDefect?: string;
  photoReferences: number[];
  rcnNew: number;
  replacementTotal: number;
  valueNow: number;
  valuePotential: number;
  ageYears: number;
  pastLife: boolean;
  yearsLeft: number;
  actionCostNZD: number;
}

/** The base structure & services, step by step — the house before its fittings. */
export interface ShellWorkings {
  ratePerSqm: number;
  floorAreaSqm: number;
  /** rate × floor area. */
  structureCost: number;
  bathrooms: number;
  /** False when the listing gave no count and one was assumed. */
  bathroomsFromListing: boolean;
  roughInBase: number;
  roughInPerBathroom: number;
  /** base + per-bathroom × bathrooms. */
  roughIn: number;
  /** structure + rough-in: what the shell costs to build today. */
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
  /**
   * `id` is the item's id when nothing of it was seen, or `<id>:unseen` for the
   * rooms of an item whose other rooms were. `replacementTotal` is the cost to
   * replace on the same basis the cards use (labour, scaffold, disposal).
   */
  estimatedItems: { id: string; label: string; category: string; rcnNew: number; replacementTotal: number; valueNow: number }[];
}

export type EstimatedItem = ImprovementValueResult["estimatedItems"][number];

export interface RoofInputs {
  footprintM2?: number | null;
  pitchDegrees?: number | null;
  roofForm?: string | null;
  /** Material text, when something better than the sub-item's own is known. */
  material?: string | null;
}

const specMult = (tier: SpecTier | null | undefined): number => (tier ? SPEC_MULTIPLIER[tier] : 1);

function sizeFor(scale: ScaleBasis, floor: number, baths: number, beds: number): number {
  if (scale === "floorM2") return floor;
  if (scale === "bathroom") return baths;
  if (scale === "bedroom") return beds;
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
  bedrooms?: number | null;
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
  const beds = args.bedrooms && args.bedrooms > 0 ? Math.round(args.bedrooms) : DEFAULT_BEDROOMS;
  const roomCount = (k: RoomKind) => (k === "bathroom" ? baths : beds);
  const byId = new Map(args.subItems.map((s) => [s.id, s]));
  const now = args.now ?? new Date();

  // THE per-item value — the same seven-step valueItem() every card shows, so
  // the cards add up to the headline. It used to be rcn × spec × a condition
  // factor here and cost-to-replace × life-left on the card: on a fair 1975
  // house the cards summed to a quarter of what the headline counted.
  const depreciate = (id: string, rcnNew: number, conditionScore: number, asNew = false, action: Action | null = null) => {
    const r = valueItem({
      id,
      rcnNew,
      sizeWorkings: [],
      sizeSummary: "",
      conditionScore,
      buildYear: args.buildYear,
      installedYear: asNew ? now.getFullYear() : null,
      labourMultiplier: args.labourMultiplier,
      action,
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
    const sized = unitBase(id, spec, s) * sizeFor(spec.scale, floor, baths, beds);
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
        action: actionFor(s),
        now,
      });
      if (!isRoofWithheld(r)) {
        const rcn = r.cost.materialsNZD + r.cost.labourNZD;
        items.push({ id, label: meta.label, category: meta.category, tier, condition, rcnNew: rcn, replacementTotal: r.cost.totalNZD, valueNow: r.valueNZD, ageYears: r.age.effectiveYears, pastLife: r.remainingFraction <= 0, yearsLeft: r.life.expectedYears - r.life.usedYears, valuePotential: r.cost.totalNZD, valueGap: r.cost.totalNZD - r.valueNZD });
        componentsValue += r.valueNZD;
        totalValueGap += r.cost.totalNZD - r.valueNZD;
        wRcn += rcn;
        wRcnCond += rcn * conditionFactor(condition);
        continue;
      }
    }

    // Several bathrooms or bedrooms, each read on its own: value them one by
    // one. Only the ones a photo shows — the rest are estimated below, from
    // the house.
    const kind = roomKindOf(id);
    const seenRooms = kind ? (s.byRoom ?? []).filter((b) => b.score != null) : [];
    if (kind && seenRooms.length > 0) {
      // One room's share of the item: the whole-house figure over the rooms.
      const perRoom = sized / roomCount(kind);
      // The item's own recorded action is for its worst room.
      const worst = seenRooms.reduce((a, b) => ((b.score as number) < (a.score as number) ? b : a));
      const parts: RoomValue[] = [];
      for (const b of seenRooms) {
        const t = b.specTier ?? tier;
        // A shower's cost is its own type's — the ensuite may be tiled and the
        // main bathroom a liner. Everything else is its share of the item.
        const base = HAS_MEMBRANE.has(id) ? unitBase(id, spec, b) : perRoom;
        const one = Math.round(base * specMult(t));
        const act = b === worst && s.urgentAction ? actionFor(s) : actionFor({ observedDefect: b.observedDefect, score: b.score });
        const bv = depreciate(id, one, b.score as number, false, act);
        if (!bv) continue;
        const pot = depreciate(id, Math.round(base * RENO_TARGET_MULT), 10, true);
        parts.push({
          room: b.room, condition: b.score as number, tier: t, material: b.material, showerType: b.showerType, floorType: b.floorType, observedDefect: b.observedDefect, photoReferences: b.photoReferences,
          rcnNew: one, replacementTotal: bv.cost.totalNZD, valueNow: bv.valueNZD, valuePotential: pot ? pot.valueNZD : bv.valueNZD,
          ageYears: bv.age.effectiveYears, pastLife: bv.remainingFraction <= 0, yearsLeft: bv.life.expectedYears - bv.life.usedYears, actionCostNZD: bv.action?.costNZD ?? 0,
        });
      }
      if (parts.length > 0) {
        const sum = (f: (p: RoomValue) => number) => parts.reduce((a, p) => a + f(p), 0);
        const worstPart = parts.reduce((a, p) => (p.condition < a.condition ? p : a));
        const unseenRooms = [
          ...(s.byRoom ?? []).filter((b) => b.score == null).map((b) => b.room),
        ];
        // The listing may count more rooms than the analysis named.
        const noun = kind === "bathroom" ? "Bathroom" : "Bedroom";
        for (let n = parts.length + unseenRooms.length; n < roomCount(kind); n++) unseenRooms.push(`${noun} ${n + 1}`);
        const rcnAll = sum((p) => p.rcnNew);
        const valueNow = sum((p) => p.valueNow);
        const valuePotential = sum((p) => p.valuePotential);
        items.push({
          id, label: meta.label, category: meta.category, tier, condition,
          rcnNew: rcnAll, replacementTotal: sum((p) => p.replacementTotal), valueNow,
          ageYears: worstPart.ageYears, pastLife: worstPart.pastLife,
          // The first room to come due decides when the item does.
          yearsLeft: Math.min(...parts.map((p) => p.yearsLeft)),
          valuePotential, valueGap: Math.max(0, valuePotential - valueNow),
          actionCostNZD: sum((p) => p.actionCostNZD), byRoom: parts, unseenRooms,
        });
        componentsValue += valueNow;
        totalValueGap += Math.max(0, valuePotential - valueNow);
        for (const p of parts) {
          wRcn += p.rcnNew;
          wRcnCond += p.rcnNew * conditionFactor(p.condition);
        }
        continue;
      }
    }

    const v = depreciate(id, rcnNew, condition, false, actionFor(s));
    if (!v) continue;
    const potential = depreciate(id, Math.round(sized * RENO_TARGET_MULT), 10, true);
    const valueNow = v.valueNZD;
    const valuePotential = potential ? potential.valueNZD : valueNow;
    const valueGap = Math.max(0, valuePotential - valueNow);

    items.push({ id, label: meta.label, category: meta.category, tier, condition, rcnNew, replacementTotal: v.cost.totalNZD, valueNow, ageYears: v.age.effectiveYears, pastLife: v.remainingFraction <= 0, yearsLeft: v.life.expectedYears - v.life.usedYears, valuePotential, valueGap });
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
    const rcn = Math.round(spec.baseRCN * sizeFor(spec.scale, floor, baths, beds));
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
  const structureCost = Math.round(BASE_SHELL_RATE * floor);
  const roughIn = floor > 0 ? ROUGH_IN_BASE + ROUGH_IN_PER_BATHROOM * baths : 0;
  const shellCostNew = structureCost + roughIn;
  const shellValue = floor > 0 ? Math.round(shellCostNew * shellLifeFactor) : 0;
  const shell: ShellWorkings = {
    ratePerSqm: BASE_SHELL_RATE,
    floorAreaSqm: floor,
    structureCost,
    bathrooms: baths,
    bathroomsFromListing: args.bathrooms != null && args.bathrooms > 0,
    roughInBase: ROUGH_IN_BASE,
    roughInPerBathroom: ROUGH_IN_PER_BATHROOM,
    roughIn,
    costNew: shellCostNew,
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
      const valued = items.find((i) => i.id === id);
      // Bathrooms no photo shows, on an item whose other bathrooms were seen.
      if (valued?.unseenRooms?.length) {
        const n = valued.unseenRooms.length;
        const kind = roomKindOf(id) as RoomKind;
        const rcn = Math.round((spec.baseRCN * sizeFor(spec.scale, floor, baths, beds)) / roomCount(kind) * n * blendedSpec);
        const e = depreciate(id, rcn, blendedScore);
        const valueNow = e?.valueNZD ?? 0;
        estimatedItems.push({
          id: `${id}:unseen`,
          label: `${meta.label} — ${valued.unseenRooms.join(", ")} (not photographed)`,
          category: meta.category,
          rcnNew: rcn,
          replacementTotal: e?.cost.totalNZD ?? rcn,
          valueNow,
        });
        estimatedValue += valueNow;
        continue;
      }
      if (seen && seen.score != null) continue; // already valued for real
      const rcnNew = Math.round(spec.baseRCN * sizeFor(spec.scale, floor, baths, beds) * blendedSpec);
      if (rcnNew <= 0) continue;
      const e = depreciate(id, rcnNew, blendedScore);
      const valueNow = e?.valueNZD ?? 0;
      estimatedItems.push({ id, label: meta.label, category: meta.category, rcnNew, replacementTotal: e?.cost.totalNZD ?? rcnNew, valueNow });
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
