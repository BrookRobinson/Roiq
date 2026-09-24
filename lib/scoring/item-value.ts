// ============================================================
// The seven-step valuation, for every costed item that isn't the roof.
//
// Same shape the roof produces, so one panel renders both and a reader gets
// the same seven questions answered on every card:
//
//   1 MATERIAL  2 CONCERNS  3 AGE  4 LIFE  5 SIZE  6 COST  7 VALUE
//
// The roof keeps its own module because its SIZE step is real geometry —
// footprint ÷ cos(pitch) plus an eaves band. Everything else scales off a
// figure the report already holds (floor area, bathroom count, or a fixed cost
// for a standard home), so step 5 here shows that scaling rather than a
// measurement, and says which it is.
//
// The COST side is not re-derived. IMPROVEMENT_BASE_COSTS was already
// calibrated per item and `rcnNew` already applies this property's size and
// spec tier — re-pricing it here would be a second cost model disagreeing with
// the first, which is the mistake this codebase keeps having to undo. What is
// added is the split (materials / labour / scaffold / disposal) and the life.
//
// Dependency-free so verify:item-value can load it with plain node.
// ============================================================

import { componentAge, lifeRemaining, type EffectiveAge } from "./depreciation.ts";
import { ITEM_LIFE, expectedLife, type ItemLife } from "./item-life.ts";

export interface ItemValuationLife {
  lowYears: number;
  highYears: number;
  expectedYears: number;
  usedYears: number;
  yearsRemaining: number;
  dueYear: number | null;
  usedFraction: number;
  label: string;
}

export interface ItemCostBreakdown {
  materialsNZD: number;
  labourNZD: number;
  scaffoldNZD: number;
  disposalNZD: number;
  totalNZD: number;
  workings: string[];
}

export interface ItemSize {
  workings: string[];
  summary: string;
}

export interface GenericItemValuation {
  id: string;
  material: { id: string; label: string; note?: string };
  concerns: string[];
  age: EffectiveAge;
  life: ItemValuationLife;
  size: ItemSize;
  cost: ItemCostBreakdown;
  remainingFraction: number;
  valueNZD: number;
  liabilityNZD: number;
  summary: string;
}

export interface ItemWithheldResult {
  withheld: "no_life_data" | "no_cost" | "no_age";
  reason: string;
}

export const isItemWithheld = (
  r: GenericItemValuation | ItemWithheldResult
): r is ItemWithheldResult => "withheld" in r;

/**
 * Scaffold, as a share of the job.
 *
 * Priced as a fraction rather than off a measured face, because unlike the roof
 * these items have no geometry to measure against — and a fraction that is
 * honestly labelled beats a number that looks measured and isn't. It is the
 * single biggest hidden cost on exterior work: it is why a $12,000 reclad quote
 * comes back at $19,000.
 */
const SCAFFOLD_SHARE = 0.18;
const SCAFFOLD_MINIMUM = 3200;

export function valueItem(args: {
  id: string;
  /** Replacement cost new, already sized and spec-adjusted for THIS property. */
  rcnNew: number;
  /** How that figure was reached, for step 5. */
  sizeWorkings: string[];
  sizeSummary: string;
  /** What the analysis said it is made of. */
  material?: string | null;
  concerns?: string[];
  conditionScore?: number | null;
  buildYear?: number | null;
  /** When the component itself was replaced, if anything says so. */
  installedYear?: number | null;
  labourMultiplier?: number;
  label?: string;
  now?: Date;
}): GenericItemValuation | ItemWithheldResult {
  const life: ItemLife | undefined = ITEM_LIFE[args.id];
  if (!life) {
    return {
      withheld: "no_life_data",
      reason:
        "No service life is recorded for this component, so there is no way to say how much of it is used up. Nothing is claimed.",
    };
  }
  if (!args.rcnNew || args.rcnNew <= 0) {
    return {
      withheld: "no_cost",
      reason:
        "This component has no replacement cost on this property — nothing to depreciate, so nothing is claimed.",
    };
  }

  const year = (args.now ?? new Date()).getFullYear();
  const expected = expectedLife(life);
  const age = componentAge({
    installedYear: args.installedYear,
    buildYear: args.buildYear,
    conditionScore: args.conditionScore,
    expectedLifeYears: expected,
    concerns: args.concerns,
    noun: (args.label ?? "component").toLowerCase(),
    now: args.now,
  });

  const labourMult = args.labourMultiplier ?? 1;

  // Only labour and scaffold move with the region. Gib is Gib in Gore and in
  // Remuera; the crew hanging it is not.
  const materials = Math.round(args.rcnNew * life.materialShare);
  const labour = Math.round(args.rcnNew * (1 - life.materialShare) * labourMult);
  const scaffold = life.scaffold
    ? Math.max(SCAFFOLD_MINIMUM, Math.round(args.rcnNew * SCAFFOLD_SHARE * labourMult))
    : 0;
  const disposal = Math.round(args.rcnNew * life.disposalShare);

  const cost: ItemCostBreakdown = {
    materialsNZD: materials,
    labourNZD: labour,
    scaffoldNZD: scaffold,
    disposalNZD: disposal,
    totalNZD: materials + labour + scaffold + disposal,
    workings: [
      `Replacement cost of about $${args.rcnNew.toLocaleString("en-NZ")}, split roughly ${Math.round(life.materialShare * 100)}% material / ${Math.round((1 - life.materialShare) * 100)}% labour.`,
      ...(life.scaffold
        ? [`Scaffold is needed to reach it — allowed at about ${Math.round(SCAFFOLD_SHARE * 100)}% of the job, with a ${`$${SCAFFOLD_MINIMUM.toLocaleString("en-NZ")}`} minimum.`]
        : []),
      `Stripping and disposing of the old one at about ${Math.round(life.disposalShare * 100)}% of the job.`,
    ],
  };

  const rawRemaining = Math.round((expected - age.effectiveYears) * 10) / 10;
  const yearsRemaining = Math.max(0, rawRemaining);
  const overdueBy = rawRemaining < 0 ? Math.abs(rawRemaining) : 0;
  const remainingFraction = lifeRemaining(age.effectiveYears, expected, life.residual ?? 0);

  const lifeOut: ItemValuationLife = {
    lowYears: life.lifeLow,
    highYears: life.lifeHigh,
    expectedYears: expected,
    usedYears: age.effectiveYears,
    yearsRemaining,
    dueYear: yearsRemaining > 0 ? year + Math.round(yearsRemaining) : null,
    usedFraction: Math.min(1, Math.round((age.effectiveYears / expected) * 1000) / 1000),
    label:
      overdueBy > 0
        ? `Replacement overdue by about ${Math.round(overdueBy)} ${Math.round(overdueBy) === 1 ? "year" : "years"}`
        : yearsRemaining < 1
          ? "Due for replacement now"
          : `${Math.round(yearsRemaining)} ${Math.round(yearsRemaining) === 1 ? "year" : "years"} left till replacement — about ${year + Math.round(yearsRemaining)}`,
  };

  const valueNZD = Math.round(cost.totalNZD * remainingFraction);
  const liabilityNZD = cost.totalNZD - valueNZD;

  return {
    id: args.id,
    material: {
      id: args.material ?? "unknown",
      label: args.material?.trim() || "Not established from the photographs",
      note: life.note,
    },
    concerns: args.concerns ?? [],
    age,
    life: lifeOut,
    size: { workings: args.sizeWorkings, summary: args.sizeSummary },
    cost,
    remainingFraction: Math.round(remainingFraction * 1000) / 1000,
    valueNZD,
    liabilityNZD,
    summary:
      yearsRemaining <= 0
        ? `At or past the end of its life. It carries ${remainingFraction > 0 ? `only a residual $${valueNZD.toLocaleString("en-NZ")}` : "no remaining value"}, and replacing it is about $${cost.totalNZD.toLocaleString("en-NZ")}.`
        : `About ${Math.round(yearsRemaining)} of ${expected} years left, so it holds roughly ${Math.round(remainingFraction * 100)}% of its $${cost.totalNZD.toLocaleString("en-NZ")} replacement cost — $${valueNZD.toLocaleString("en-NZ")} of value, with $${liabilityNZD.toLocaleString("en-NZ")} of life already used up.`,
  };
}
