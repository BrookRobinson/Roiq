// ============================================================
// What the roof is worth, and the working that got there.
//
// Depreciated Replacement Cost, done the way a quantity surveyor does it rather
// than the way a rubric does it:
//
//   value = cost to replace it new  ×  (life left ÷ total life)
//
// Seven steps, and every one of them is reported so a reader can disagree with
// a specific number instead of disbelieving the total:
//
//   1  MATERIAL      what it is. Everything below depends on this one.
//   2  CONCERNS      what is visibly wrong with it.
//   3  AGE           how old, and why we think so.
//   4  LIFE          how long that material lasts.
//   5  AREA          how big it actually is, measured not assumed.
//   6  COST          materials, labour, scaffold, disposal.
//   7  VALUE         cost × life remaining.
//
// Pure and dependency-free so `npm run verify:roof` can load it with plain node.
//
// ── On the numbers ──────────────────────────────────────────────────────────
// The rates below are INDUSTRY-TYPICAL RANGES for New Zealand, 2026. They are
// not quotes, nothing fetched them from a supplier, and no line here may ever
// claim otherwise — this codebase has printed invented retailer citations to
// buyers once already and it is not doing it again. Every output carries the
// basis so the report can say what it is. When a real cost source lands
// (Rawlinsons, a QV cost guide, a trade account feed) it replaces RATES and
// nothing else has to move.
// ============================================================

import { componentAge, effectiveAge, lifeRemaining, damageDeduction, type EffectiveAge, type Damage } from "./depreciation.ts";

export type RoofMaterialId =
  | "longrun_colorsteel"
  | "longrun_zincalume"
  | "longrun_galv"
  | "tile_concrete"
  | "tile_clay"
  | "pressed_metal"
  | "asphalt_shingle"
  | "membrane"
  | "slate"
  | "asbestos_cement";

export interface RoofMaterial {
  label: string;
  /** Total economic life in years, low and high for the material done well. */
  lifeLow: number;
  lifeHigh: number;
  /** Supply + install, $/m² of ROOF area. Includes underlay and fixings, which
   *  is how a New Zealand roofer quotes it. Excludes scaffold and disposal. */
  rateLow: number;
  rateHigh: number;
  /** Roughly what share of the rate is material rather than labour. Roofing
   *  tiles are material-heavy; long-run steel is labour-heavy. */
  materialShare: number;
  /** $/m² to strip and dispose of the OLD roof of this type. */
  disposalRate: number;
  /** Said out loud on the card when it matters. */
  note?: string;
}

export const ROOF_MATERIALS: Record<RoofMaterialId, RoofMaterial> = {
  longrun_colorsteel: {
    label: "Long-run pre-painted steel (Colorsteel or similar)",
    lifeLow: 30, lifeHigh: 45, rateLow: 120, rateHigh: 180,
    materialShare: 0.4, disposalRate: 12,
    note: "Life depends heavily on the coating and how close it is to the sea.",
  },
  longrun_zincalume: {
    label: "Long-run unpainted Zincalume",
    lifeLow: 25, lifeHigh: 40, rateLow: 105, rateHigh: 155,
    materialShare: 0.38, disposalRate: 12,
  },
  longrun_galv: {
    label: "Corrugated galvanised steel",
    lifeLow: 15, lifeHigh: 30, rateLow: 100, rateHigh: 145,
    materialShare: 0.35, disposalRate: 12,
    note: "Older galvanised iron. Rusts from the fixings and the laps outward.",
  },
  tile_concrete: {
    label: "Concrete tile",
    lifeLow: 40, lifeHigh: 60, rateLow: 130, rateHigh: 200,
    materialShare: 0.5, disposalRate: 20,
    note: "The tiles outlast their surface coating, which usually fails at 20–25 years.",
  },
  tile_clay: {
    label: "Clay tile",
    lifeLow: 60, lifeHigh: 100, rateLow: 200, rateHigh: 320,
    materialShare: 0.55, disposalRate: 22,
  },
  pressed_metal: {
    label: "Pressed metal tile (Decramastic or similar)",
    lifeLow: 25, lifeHigh: 40, rateLow: 140, rateHigh: 200,
    materialShare: 0.45, disposalRate: 14,
    note: "1960s–80s. The stone chip sheds and the steel beneath then rusts.",
  },
  asphalt_shingle: {
    label: "Asphalt shingle",
    lifeLow: 20, lifeHigh: 30, rateLow: 130, rateHigh: 200,
    materialShare: 0.45, disposalRate: 16,
  },
  membrane: {
    label: "Membrane (butynol, TPO or torch-on)",
    lifeLow: 15, lifeHigh: 25, rateLow: 180, rateHigh: 280,
    materialShare: 0.4, disposalRate: 18,
    note: "A flat or near-flat roof. Life is short and failure is sudden.",
  },
  slate: {
    label: "Slate",
    lifeLow: 80, lifeHigh: 120, rateLow: 350, rateHigh: 600,
    materialShare: 0.6, disposalRate: 25,
  },
  asbestos_cement: {
    label: "Asbestos-cement sheet (“Super Six”)",
    lifeLow: 30, lifeHigh: 50, rateLow: 120, rateHigh: 180,
    materialShare: 0.4,
    // Not a rounding difference. Licensed removal, containment and disposal of
    // asbestos roofing runs several times an ordinary strip, and it is the
    // single most expensive surprise on a pre-1990 roof.
    disposalRate: 70,
    note: "Pre-1990. Removal is licensed work and disposal is the dominant cost.",
  },
};

/**
 * The analysis writes the material in its own words — "Long-run corrugated
 * steel", "Decramastic tile, stone chip shedding". This maps that to something
 * we can price.
 *
 * It returns NULL rather than the nearest match on purpose. The whole valuation
 * hangs off this one field: pricing a clay-tile roof as concrete is a $20,000
 * error that looks exactly like a correct number, and "we could not identify
 * the material" is a finding a reader can act on. Order matters — the more
 * specific patterns are tested first, because "pressed metal tile" contains
 * "metal" and "concrete tile" contains "tile".
 */
const MATERIAL_PATTERNS: [RegExp, RoofMaterialId][] = [
  [/asbestos|super\s*six|fibrolite|fibre[- ]?cement\s+(sheet|roof)/i, "asbestos_cement"],
  [/decramastic|pressed\s*metal|metal\s*tile|stone[- ]?chip/i, "pressed_metal"],
  [/slate/i, "slate"],
  [/clay\s*tile|terracotta|marseille/i, "tile_clay"],
  [/concrete\s*tile|cement\s*tile/i, "tile_concrete"],
  [/butynol|membrane|torch[- ]?on|tpo|epdm|malthoid/i, "membrane"],
  [/shingle|asphalt/i, "asphalt_shingle"],
  [/colou?rsteel|coloursteel|pre[- ]?painted|coated\s+steel|colorbond/i, "longrun_colorsteel"],
  [/zincalume|zinc[- ]?alume/i, "longrun_zincalume"],
  // Last of the steels: an unqualified "corrugated iron" or "long-run steel"
  // with no coating named is the old galvanised stuff more often than not, and
  // it is the shorter-lived read — which errs toward flagging a roof that has
  // life left rather than missing one that hasn't.
  [/galvanis|corrugated|long[- ]?run|profiled\s+steel|\biron\b/i, "longrun_galv"],
];

export function roofMaterialFromText(text: string | null | undefined): RoofMaterialId | null {
  if (!text) return null;
  for (const [re, id] of MATERIAL_PATTERNS) if (re.test(text)) return id;
  return null;
}

/** Typical pitch by roof form, for when the photographs don't establish one. */
export const TYPICAL_PITCH: Record<string, number> = {
  flat: 3,
  skillion: 8,
  gable: 25,
  hip: 25,
  gambrel: 35,
  unknown: 22,
};

// ── 5 · Area ─────────────────────────────────────────────────────────────────

export interface RoofArea {
  footprintM2: number;
  pitchDegrees: number;
  /** 1/cos(pitch) — how much a slope adds over the plan area. */
  pitchFactor: number;
  eavesOverhangM: number;
  perimeterM: number;
  roofM2: number;
  workings: string[];
}

/**
 * Perimeter of a rectangle of this area at a 1.5:1 aspect.
 *
 * An approximation, and it is used only for the eaves band and the scaffold
 * face. A real outline would be better and LINZ publishes one — but its
 * polygons are 3.2m-accurate, so the perimeter it gives is noisier than this
 * estimate on a small house. Stated as an estimate wherever it is used.
 */
export const estimatePerimeter = (footprintM2: number): number =>
  Math.round(5 * Math.sqrt(footprintM2 / 1.5) * 10) / 10;

/**
 * How much roof there actually is.
 *
 * NOT the floor area, which is what this used to use. A two-storey house has
 * roughly half the roof its floor area implies, and every roof is bigger than
 * its own footprint because it slopes and it overhangs. Both errors were live:
 * `ext_roof` was priced at `roof area ≈ floor area`.
 */
export function roofArea(args: {
  footprintM2: number;
  pitchDegrees: number;
  eavesOverhangM?: number;
  perimeterM?: number;
}): RoofArea {
  const pitch = Math.max(0, Math.min(60, args.pitchDegrees));
  const pitchFactor = 1 / Math.cos((pitch * Math.PI) / 180);
  const eaves = args.eavesOverhangM ?? 0.5;
  const perimeter = args.perimeterM ?? estimatePerimeter(args.footprintM2);

  const sloped = args.footprintM2 * pitchFactor;
  const eavesBand = perimeter * eaves * pitchFactor;
  const roofM2 = Math.round(sloped + eavesBand);

  return {
    footprintM2: args.footprintM2,
    pitchDegrees: pitch,
    pitchFactor: Math.round(pitchFactor * 1000) / 1000,
    eavesOverhangM: eaves,
    perimeterM: perimeter,
    roofM2,
    workings: [
      `Footprint ${args.footprintM2} m² — the ground the building covers, from the LINZ building outline.`,
      `Pitch ${pitch}° adds ${Math.round((pitchFactor - 1) * 100)}% over the plan area (1 ÷ cos ${pitch}° = ${(Math.round(pitchFactor * 1000) / 1000).toFixed(3)}).`,
      `${args.footprintM2} × ${(Math.round(pitchFactor * 1000) / 1000).toFixed(3)} = ${Math.round(sloped)} m² of sloped roof.`,
      `Eaves overhang ${eaves} m around roughly ${perimeter} m of perimeter adds ${Math.round(eavesBand)} m².`,
      `Roof area ≈ ${roofM2} m².`,
    ],
  };
}

// ── 3 · Age, adjusted by what can be seen ────────────────────────────────────
//
// The rule lives in ./depreciation so that every priced item shares one. A roof
// carries NO residual: at the end of its life it is scrap and the house needs a
// new one. That is the difference between a component and a structure.

export type RoofAge = EffectiveAge;

export const effectiveRoofAge = (args: {
  chronologicalYears: number;
  conditionScore?: number | null;
  concerns?: string[];
}): RoofAge => effectiveAge({ ...args, noun: "roof" });

// ── 6 · Cost to replace ──────────────────────────────────────────────────────

export interface RoofCost {
  roofM2: number;
  ratePerM2: number;
  rateLowPerM2: number;
  rateHighPerM2: number;
  materialsNZD: number;
  labourNZD: number;
  scaffoldNZD: number;
  disposalNZD: number;
  totalNZD: number;
  workings: string[];
}

/** Scaffold is priced on the face it wraps, not on the roof it serves. */
const SCAFFOLD_RATE_PER_M2 = 28;
const SCAFFOLD_MINIMUM = 3200;
const STOREY_HEIGHT_M = 2.7;

export function roofReplacementCost(args: {
  area: RoofArea;
  material: RoofMaterialId;
  storeys?: number;
  /** Regional labour multiplier, 1.0 = national median. */
  labourMultiplier?: number;
}): RoofCost {
  const m = ROOF_MATERIALS[args.material];
  const storeys = Math.max(1, args.storeys ?? 1);
  const labourMult = args.labourMultiplier ?? 1;

  const rate = (m.rateLow + m.rateHigh) / 2;
  const supplyInstall = args.area.roofM2 * rate;
  const materials = Math.round(supplyInstall * m.materialShare);
  // Only the labour half carries the regional multiplier. Steel costs the same
  // in Gore as in Remuera; the crew laying it does not.
  const labour = Math.round(supplyInstall * (1 - m.materialShare) * labourMult);

  const scaffoldFace = args.area.perimeterM * (storeys * STOREY_HEIGHT_M + 1.2);
  const scaffold = Math.max(SCAFFOLD_MINIMUM, Math.round(scaffoldFace * SCAFFOLD_RATE_PER_M2 * labourMult));
  const disposal = Math.round(args.area.roofM2 * m.disposalRate);

  return {
    roofM2: args.area.roofM2,
    ratePerM2: Math.round(rate),
    rateLowPerM2: m.rateLow,
    rateHighPerM2: m.rateHigh,
    materialsNZD: materials,
    labourNZD: labour,
    scaffoldNZD: scaffold,
    disposalNZD: disposal,
    totalNZD: materials + labour + scaffold + disposal,
    workings: [
      `${m.label} runs $${m.rateLow}–$${m.rateHigh}/m² supplied and laid; we use the midpoint, $${Math.round(rate)}/m².`,
      `${args.area.roofM2} m² × $${Math.round(rate)} = $${Math.round(supplyInstall).toLocaleString("en-NZ")}, split roughly ${Math.round(m.materialShare * 100)}% material / ${Math.round((1 - m.materialShare) * 100)}% labour.`,
      `Scaffold on about ${Math.round(scaffoldFace)} m² of face (${storeys} ${storeys === 1 ? "storey" : "storeys"} × ${STOREY_HEIGHT_M} m + 1.2 m edge) at $${SCAFFOLD_RATE_PER_M2}/m².`,
      `Stripping and disposing of the old roof at $${m.disposalRate}/m².`,
    ],
  };
}

// ── 7 · The valuation ────────────────────────────────────────────────────────

/**
 * Step 4 on the card: the life bar and the date it falls due.
 *
 * `usedFraction` is what fills the bar, and it is driven by the EFFECTIVE age,
 * not the chronological one — a roof that presents badly should show as further
 * through its life, which is the whole point of reading the condition.
 */
export interface RoofLife {
  lowYears: number;
  highYears: number;
  expectedYears: number;
  /** Effective years consumed. Can exceed expectedYears on an overdue roof. */
  usedYears: number;
  yearsRemaining: number;
  /** Calendar year it falls due. Null once it already has. */
  dueYear: number | null;
  /** 0–1, clamped, for the bar. 1 means full and overdue. */
  usedFraction: number;
  /** "3 years left till replacement" / "Replacement overdue by 4 years". */
  label: string;
}

export interface RoofValuation {
  material: { id: RoofMaterialId; label: string; note?: string };
  concerns: string[];
  age: RoofAge;
  life: RoofLife;
  area: RoofArea;
  cost: RoofCost;
  /** Share of the material's life still ahead of it, 0–1. */
  remainingFraction: number;
  /** Damage taken off the value, when there is any. */
  damage: (Damage & { nzd: number }) | null;
  /** What the roof on this house is worth today. */
  valueNZD: number;
  /** What it will cost to put right — the number a buyer negotiates with. */
  liabilityNZD: number;
  yearsRemaining: number;
  summary: string;
}

/** Nothing may be valued without this. Each is a REFUSAL, not a default. */
export type RoofWithheld =
  | "no_material"
  | "no_footprint"
  | "unknown_material";

export interface RoofWithheldResult {
  withheld: RoofWithheld;
  reason: string;
}

export const isWithheld = (r: RoofValuation | RoofWithheldResult): r is RoofWithheldResult =>
  "withheld" in r;

/**
 * Value the roof, or refuse and say which input was missing.
 *
 * It refuses rather than defaulting, for the reason the rest of this codebase
 * refuses: a roof priced from a guessed material is a five-figure number with
 * nothing behind it, and it would look exactly like one with everything behind
 * it. "We could not identify the material" is a finding a reader can act on.
 */
export function valueRoof(args: {
  material: RoofMaterialId | string | null | undefined;
  footprintM2: number | null | undefined;
  pitchDegrees?: number | null;
  roofForm?: string | null;
  eavesOverhangM?: number | null;
  perimeterM?: number | null;
  storeys?: number;
  buildYear?: number | null;
  roofLaidYear?: number | null;
  conditionScore?: number | null;
  concerns?: string[];
  labourMultiplier?: number;
  /** Broken now, whatever its age — see damageFor(). */
  damage?: Damage | null;
  now?: Date;
}): RoofValuation | RoofWithheldResult {
  if (!args.material) {
    return {
      withheld: "no_material",
      reason:
        "The photographs don't establish what the roof is made of. Everything else here is priced from that, so nothing is claimed.",
    };
  }
  if (!(args.material in ROOF_MATERIALS)) {
    return {
      withheld: "unknown_material",
      reason: `"${args.material}" isn't a roof material this model prices. Nothing is claimed rather than reaching for the nearest one.`,
    };
  }
  if (!args.footprintM2 || args.footprintM2 <= 0) {
    return {
      withheld: "no_footprint",
      reason:
        "No building footprint for this property, so there is no way to measure the roof. Floor area is not a substitute — a two-storey house has about half the roof its floor area implies.",
    };
  }

  const id = args.material as RoofMaterialId;
  const m = ROOF_MATERIALS[id];
  const year = (args.now ?? new Date()).getFullYear();

  const pitch =
    args.pitchDegrees ?? TYPICAL_PITCH[args.roofForm ?? "unknown"] ?? TYPICAL_PITCH.unknown;
  const area = roofArea({
    footprintM2: args.footprintM2,
    pitchDegrees: pitch,
    eavesOverhangM: args.eavesOverhangM ?? undefined,
    perimeterM: args.perimeterM ?? undefined,
  });
  if (args.pitchDegrees == null) {
    area.workings[1] += ` The pitch wasn't established from the photographs, so this is the typical ${args.roofForm ?? "roof"} pitch.`;
  }

  const expectedLife = Math.round((m.lifeLow + m.lifeHigh) / 2);
  const age: RoofAge = componentAge({
    installedYear: args.roofLaidYear,
    buildYear: args.buildYear,
    conditionScore: args.conditionScore,
    expectedLifeYears: expectedLife,
    concerns: args.concerns,
    noun: "roof",
    now: args.now,
  });
  const cost = roofReplacementCost({ area, material: id, storeys: args.storeys, labourMultiplier: args.labourMultiplier });

  const rawRemaining = Math.round((expectedLife - age.effectiveYears) * 10) / 10;
  const yearsRemaining = Math.max(0, rawRemaining);
  const remainingFraction = lifeRemaining(age.effectiveYears, expectedLife, 0);

  // Overdue is reported as a number, not rounded up to zero. "Overdue by four
  // years" is a different conversation with a vendor from "due now", and the
  // buyer is the one who has to have it.
  const overdueBy = rawRemaining < 0 ? Math.abs(rawRemaining) : 0;
  const life: RoofLife = {
    lowYears: m.lifeLow,
    highYears: m.lifeHigh,
    expectedYears: expectedLife,
    usedYears: age.effectiveYears,
    yearsRemaining,
    dueYear: yearsRemaining > 0 ? year + Math.round(yearsRemaining) : null,
    usedFraction: Math.min(1, Math.round((age.effectiveYears / expectedLife) * 1000) / 1000),
    label:
      overdueBy > 0
        ? `Replacement overdue by about ${Math.round(overdueBy)} ${Math.round(overdueBy) === 1 ? "year" : "years"}`
        : yearsRemaining < 1
          ? "Due for replacement now"
          : `${Math.round(yearsRemaining)} ${Math.round(yearsRemaining) === 1 ? "year" : "years"} left till replacement — about ${year + Math.round(yearsRemaining)}`,
  };

  // A roof at the end of its life is worth nothing AND costs the full
  // replacement. Those are two different numbers and the report shows both:
  // one is what you are buying, the other is what you will spend.
  const beforeDamage = Math.round(cost.totalNZD * remainingFraction);
  const damageNZD = damageDeduction(beforeDamage, cost.totalNZD, args.damage);
  const valueNZD = beforeDamage - damageNZD;
  const liabilityNZD = cost.totalNZD - valueNZD;

  return {
    material: { id, label: m.label, note: m.note },
    concerns: args.concerns ?? [],
    age,
    life,
    area,
    cost,
    remainingFraction: Math.round(remainingFraction * 1000) / 1000,
    damage: args.damage && damageNZD > 0 ? { ...args.damage, nzd: damageNZD } : null,
    valueNZD,
    liabilityNZD,
    yearsRemaining,
    summary: damageNZD > 0
      ? `Its age leaves ${Math.round(remainingFraction * 100)}% of the $${cost.totalNZD.toLocaleString("en-NZ")} replacement cost, $${beforeDamage.toLocaleString("en-NZ")}, but about ${Math.round((args.damage?.share ?? 0) * 100)}% of it is damaged and has to be fixed now: less $${damageNZD.toLocaleString("en-NZ")}, leaving $${valueNZD.toLocaleString("en-NZ")}.`
      : yearsRemaining <= 0
        ? `This roof is at or past the end of its life. It carries no remaining value, and replacing it is about $${cost.totalNZD.toLocaleString("en-NZ")}.`
        : `About ${yearsRemaining} of ${expectedLife} years left, so it holds roughly ${Math.round(remainingFraction * 100)}% of its $${cost.totalNZD.toLocaleString("en-NZ")} replacement cost — $${valueNZD.toLocaleString("en-NZ")} of value, with $${liabilityNZD.toLocaleString("en-NZ")} of life already used up.`,
  };
}
