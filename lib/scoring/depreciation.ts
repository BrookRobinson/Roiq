// ============================================================
// How anything on this property loses value with age.
//
// One rule, used by every priced item, because two rules would eventually
// disagree about the same house. It is the valuation profession's, not ours:
//
//   value = replacement cost new × (life left ÷ total life)
//
// Two things in here are the whole reason it is a shared module.
//
// CONDITION MOVES THE AGE. It does not multiply the value. A 1–10 read maps to
// an EFFECTIVE age either side of the chronological one — a roof kept well is
// younger than its years, a neglected one older — and the life fraction then
// does the depreciating. Applying a condition factor AND a life fraction
// discounts the same wear twice, which halves a value silently and looks
// exactly like a correct number.
//
// STRUCTURE DOESN'T DEPRECIATE TO NOTHING. A component wears out and is worth
// zero at the end of its life; a building's frame does not, because the house
// is still standing on it. Long-lived elements carry a residual floor, which is
// what a valuer does and what stops a 1920s villa reading as worth nothing.
//
// Dependency-free so the verify scripts can load it with plain node.
// ============================================================

export interface EffectiveAge {
  chronologicalYears: number;
  /** The age it PRESENTS as — what actually depreciates it. */
  effectiveYears: number;
  basis: string;
}

/**
 * Condition, expressed as an age.
 *
 * 10 → presents 25% younger. 5.5 → unchanged, because "average for its age"
 * means exactly that and should move nothing. 1 → presents 50% older.
 */
export function effectiveAge(args: {
  chronologicalYears: number;
  conditionScore?: number | null;
  /** What was actually seen, quoted into the reason. */
  concerns?: string[];
  /** What the thing is, for the sentence. "roof", "building". */
  noun?: string;
}): EffectiveAge {
  const chron = Math.max(0, args.chronologicalYears);
  const noun = args.noun ?? "item";
  const score = args.conditionScore;

  if (score == null) {
    return {
      chronologicalYears: chron,
      effectiveYears: chron,
      basis: `No condition read, so the ${noun} is depreciated on its age alone.`,
    };
  }

  const s = Math.max(1, Math.min(10, score));
  const factor = s >= 5.5 ? 1 - ((s - 5.5) / 4.5) * 0.25 : 1 + ((5.5 - s) / 4.5) * 0.5;
  const effective = Math.round(chron * factor * 10) / 10;

  const direction =
    factor < 1 ? "better than its age" : factor > 1 ? "worse than its age" : "about right for its age";
  // The analysis writes its findings as sentences, so they already end in a
  // full stop. Appending another gave every card "…beneath it..".
  const joined = args.concerns?.length ? args.concerns.join(" ").trim() : "";
  const seen = joined ? ` Seen: ${joined.replace(/\.+$/, "")}.` : "";

  return {
    chronologicalYears: chron,
    effectiveYears: effective,
    basis: `About ${chron} years old and presenting ${direction} (condition ${s}/10), so it is depreciated as though it were ${effective} years old.${seen}`,
  };
}

/**
 * How old a COMPONENT is, when what we usually know is how old the HOUSE is.
 *
 * The build year is not the component's age. It is only the oldest the
 * component could be. A kitchen in a 1975 house that presents as fair is not a
 * 51-year-old kitchen, because a 51-year-old kitchen would not present as fair.
 * The condition shows it has been replaced since. Reading its age off the build
 * year put every kitchen, bathroom and window in every pre-2000 house at $0.
 *
 * So when the component's own date is unknown, there are two readings, and the
 * younger one is taken only as far as the condition PROVES a replacement
 * (fully from 7/10 up, not at all from 4/10 down — see REPLACED_FROM):
 *   • the build year, moved by condition (the effectiveAge rule), which
 *     is right for anything that is plausibly original, and
 *   • the condition alone, read as a share of the component's life:
 *     10 → just installed, 5.5 → half way, 1 → at the end of it.
 * Taking the younger means a new house's components are never aged past the
 * house, and an old house's replaced components are never aged to the house.
 * The two readings meet, so there is no jump the year a house outlives a
 * kitchen.
 *
 * A known replacement date is a fact and beats both.
 */
export function componentAge(args: {
  /** When the component itself went in, if anything says so. */
  installedYear?: number | null;
  buildYear?: number | null;
  conditionScore?: number | null;
  expectedLifeYears: number;
  concerns?: string[];
  noun?: string;
  now?: Date;
}): EffectiveAge {
  const year = (args.now ?? new Date()).getFullYear();
  const noun = args.noun ?? "item";

  if (args.installedYear) {
    return effectiveAge({
      chronologicalYears: Math.max(0, year - args.installedYear),
      conditionScore: args.conditionScore,
      concerns: args.concerns,
      noun,
    });
  }

  const score = args.conditionScore;
  const fromCondition =
    score == null
      ? null
      : Math.round(args.expectedLifeYears * Math.max(0, Math.min(1, (10 - Math.max(1, Math.min(10, score))) / 9)) * 10) / 10;

  if (!args.buildYear) {
    if (fromCondition == null) {
      return {
        chronologicalYears: 0,
        effectiveYears: 0,
        basis: `Neither a build year, a replacement date nor a condition read is known, so the ${noun} is treated as new — which will overstate it. Treat the figure as a ceiling.`,
      };
    }
    return {
      chronologicalYears: 0,
      effectiveYears: fromCondition,
      basis: `No build year or replacement date is known, so its age is read from its condition (${score}/10): about ${fromCondition} of a ${args.expectedLifeYears}-year life used.`,
    };
  }

  const fromHouse = effectiveAge({
    chronologicalYears: Math.max(0, year - args.buildYear),
    conditionScore: score,
    concerns: args.concerns,
    noun,
  });
  if (fromCondition == null || fromCondition >= fromHouse.effectiveYears) return fromHouse;

  // Only GOOD condition proves a replacement. A 9/10 kitchen in a 1975 house
  // can't be the 1975 kitchen; a 4/10 roof with rust through the flashing
  // looks exactly like the original, so crediting it as a newer replacement
  // flattered the one item a buyer is about to pay for. The credit phases in
  // between REPLACED_FROM and REPLACED_BY rather than switching at one score,
  // so a 5 and a 6 don't land thousands of dollars apart.
  const s = Math.max(1, Math.min(10, score as number));
  const credit = Math.max(0, Math.min(1, (s - REPLACED_FROM) / (REPLACED_BY - REPLACED_FROM)));
  if (credit === 0) {
    return {
      ...fromHouse,
      basis: `${fromHouse.basis} At ${s}/10 it looks as worn as an original would, so nothing suggests it has been replaced and it is aged with the house.`,
    };
  }
  // Blended as LIFE LEFT, not as years. On an old house the house reading is
  // decades past the component's life, so averaging the years lands past it
  // too and a fair kitchen went back to $0. Blending the share of life left
  // moves the value evenly from one reading to the other.
  const life = args.expectedLifeYears;
  const leftHouse = Math.max(0, Math.min(1, 1 - fromHouse.effectiveYears / life));
  const leftCond = Math.max(0, Math.min(1, 1 - fromCondition / life));
  const left = leftHouse + credit * (leftCond - leftHouse);
  const effective = Math.round(life * (1 - left) * 10) / 10;

  const seen = fromHouse.basis.match(/ Seen: .*$/)?.[0] ?? "";
  return {
    chronologicalYears: fromHouse.chronologicalYears,
    effectiveYears: effective,
    basis:
      credit === 1
        ? `The house is about ${fromHouse.chronologicalYears} years old, but a ${noun} in this condition (${s}/10) has not been there that long, so it has been replaced since. With no date for that, its age is read from its condition: about ${effective} of a ${args.expectedLifeYears}-year life used.${seen}`
        : `The house is about ${fromHouse.chronologicalYears} years old. At ${s}/10 this ${noun} may have been replaced since, but its condition doesn't prove it, so it is aged part-way between the house (${fromHouse.effectiveYears} years) and its condition (${fromCondition}): about ${effective} years.${seen}`,
  };
}

/** At or below this condition, nothing suggests a component was replaced. */
export const REPLACED_FROM = 4;
/** At or above this, the condition alone proves it was. */
export const REPLACED_BY = 7;

/**
 * Share of an item's value still there, 0–1.
 *
 * `residual` is the floor it may never fall below. Zero for anything that wears
 * out and gets thrown in a skip — a roof, a carpet, a hot water cylinder. Above
 * zero for the parts of a building that keep working indefinitely while it
 * stands up.
 */
export function lifeRemaining(
  effectiveYears: number,
  expectedLifeYears: number,
  residual = 0
): number {
  if (expectedLifeYears <= 0) return residual;
  const straight = 1 - effectiveYears / expectedLifeYears;
  return Math.max(residual, Math.min(1, Math.round(straight * 1000) / 1000));
}

// ── The shell ────────────────────────────────────────────────────────────────

/**
 * Economic life of the base structure and services, in years.
 *
 * Framing, linings, wiring and plumbing rough-in on a New Zealand timber-framed
 * house. Long, because the thing routinely outlives it — which is why the
 * residual below matters more than this number does.
 */
export const SHELL_LIFE_YEARS = 70;

/**
 * What the shell may never fall below, however old it is.
 *
 * A 1925 villa's frame is 100 years old and holding a house up. Straight-lining
 * it to zero would say the structure of every pre-1956 house in the country is
 * worth nothing, which is both false and the sort of number that discredits
 * everything printed beside it.
 */
export const SHELL_RESIDUAL = 0.25;

export const shellLifeRemaining = (effectiveYears: number): number =>
  lifeRemaining(effectiveYears, SHELL_LIFE_YEARS, SHELL_RESIDUAL);

// ── Damage ───────────────────────────────────────────────────────────────────

/**
 * Damage is not wear, and age can't carry it.
 *
 * Condition moves an item's age, which is right for wear: a tired roof has
 * used more of its life. But a one-year-old front door smashed apart with a
 * crowbar has used one year of its life and is worth nothing. Moved by
 * condition, a year becomes a year and a half, and the door still read as 97%
 * of new. So damage is its own step: the share of the item that is broken and
 * must be fixed or replaced NOW, taken off the value at the item's own
 * replacement cost. Never below zero.
 */
export interface Damage {
  /** 0–1: how much of the item is broken. A smashed door is 1. */
  share: number;
  /** Where the share came from — recorded by the analysis, or read from a failed condition. */
  basis: "recorded" | "condition";
}

/**
 * The damage on an item, or null.
 *
 * The analysis records the share directly. Reports analysed before it did hold
 * a defect and a condition, and a defect on an item at 3/10 or worse is damage
 * in proportion to the reading — 1/10 destroyed, 2 two-thirds, 3 a third.
 * With no defect recorded there is nothing to say it is damage rather than
 * wear, so nothing is taken.
 */
export function damageFor(item: {
  damageShare?: number | null;
  observedDefect?: string | null;
  score?: number | null;
}): Damage | null {
  if (typeof item.damageShare === "number" && Number.isFinite(item.damageShare) && item.damageShare > 0) {
    return { share: Math.min(1, item.damageShare), basis: "recorded" };
  }
  if (item.observedDefect?.trim() && item.score != null && item.score <= 3) {
    return { share: Math.round(((4 - Math.max(1, item.score)) / 3) * 100) / 100, basis: "condition" };
  }
  return null;
}

/** What the damage takes off: share × cost to replace, capped at the value it had. */
export function damageDeduction(valueBefore: number, costToReplace: number, damage: Damage | null | undefined): number {
  if (!damage || damage.share <= 0) return 0;
  return Math.min(valueBefore, Math.round(damage.share * costToReplace));
}
