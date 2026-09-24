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
