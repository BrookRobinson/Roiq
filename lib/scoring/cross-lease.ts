// ============================================================
// What a cross lease is actually worth against the freehold next door.
//
// A cross lease is not an apartment and it is not a freehold section, and until
// now this codebase treated it as the first and valued it like neither. It went
// down the apartment road — floor area × suburb $/m², NO condition multiplier —
// so a cross-lease house scoring 250/1000 and one scoring 850/1000 came out at
// the same number if they had the same floor area in the same suburb. The whole
// product stopped touching the money the moment the title said cross lease.
//
// It is a house. It sits on the ground, it wears out like a house, it has its
// own roof and its own kitchen, and it sells like a house — at a discount. So
// it is valued like a house, on the share of land its owner actually holds, and
// then discounted for the tenure.
//
// ── The discount is sourced, and the band is held ────────────────────────────
//
//   Trade Me Property        cross lease sells 5–10% below equivalent freehold
//   Property Institute NZ    the discount runs up to 7.5%
//   "The land governance cost on co-ownership: A study of the cross-lease in
//    New Zealand" (Land Use Policy, via ScienceDirect) — the discount GROWS
//    with the number of owners sharing the land.
//
// So 5–10% is the band, and nothing this module returns leaves it. What varies
// inside it is how entangled this particular arrangement is — which is the
// thing a buyer actually feels, and the thing the photographs can show.
//
// ── Why entanglement, and not a flat number ─────────────────────────────────
//
// Two flats side by side, each with its own driveway off the street, its own
// fenced yard and no shared wall, is a different property from two flats up a
// shared right-of-way where the rear one drives past the front one's lounge
// window. Both are "cross lease, 1/2". Only one of them has neighbours whose
// consent is a daily fact rather than a paperwork step. A single discount for
// both prices neither.
//
// The factors below are the ones a listing can actually show. Each is
// tri-state: true, false, or absent. ABSENT CONTRIBUTES NOTHING — the rule set
// for Tier 3 improvements applies here too, and a driveway nobody photographed
// must not be read as a shared one just because shared is the safer guess.
// ============================================================

/** The published band. Nothing leaves it, in either direction. */
export const MIN_DISCOUNT_PCT = 5;
export const MAX_DISCOUNT_PCT = 10;

/** How far the observed arrangement may move the figure off its base. */
const MAX_ENTANGLEMENT_SWING = 2;

/**
 * What the analysis could see about how the site is shared.
 *
 * Every field is optional and tri-state. `undefined` means the listing did not
 * show it, which is not the same as `false`.
 */
export interface CrossLeaseSharing {
  /** Each flat reaches the street on its own, rather than up a shared right-of-way. */
  separateDriveway?: boolean;
  /** This flat is a standalone building, not joined to the next one. */
  detached?: boolean;
  /** A defined outdoor area — fenced, walled or hedged — that is this flat's alone. */
  exclusiveYard?: boolean;
  /** A garage block, laundry or similar structure serving more than one flat. */
  sharedStructures?: boolean;
  /** This flat sits behind another and is reached past it. */
  rearFlat?: boolean;
}

/**
 * One factor's contribution, in percentage points, and how it reads to a buyer.
 *
 * Negative is better for the owner: less entangled, smaller discount. The
 * driveway carries the most weight because it is the one that shows up daily —
 * access, parking, and who pays to reseal it — and because a shared right-of-way
 * is the most common source of cross-lease friction.
 */
interface Factor {
  points: number;
  label: string;
}

function factorsFor(sharing: CrossLeaseSharing): Factor[] {
  const out: Factor[] = [];
  const add = (points: number, label: string) => out.push({ points, label });

  if (sharing.separateDriveway === true) add(-1, "Its own driveway to the street");
  if (sharing.separateDriveway === false) add(1, "Shares a driveway or right-of-way");

  if (sharing.detached === true) add(-0.5, "A standalone building, no shared wall");
  if (sharing.detached === false) add(0.5, "Joined to the neighbouring flat");

  if (sharing.exclusiveYard === true) add(-0.5, "A defined outdoor area of its own");
  if (sharing.exclusiveYard === false) add(0.5, "Grounds are shared or undefined");

  if (sharing.sharedStructures === true) add(0.5, "A shared garage, laundry or outbuilding");

  if (sharing.rearFlat === true) add(1, "The rear flat — access runs past another");

  return out;
}

/**
 * The base discount, before anything is observed: how many owners share the
 * land. Every extra owner is another consent to obtain and another party to a
 * flats-plan variation, which is the effect the research measures.
 *
 * Two flats sit at the bottom of the band, six or more at the top.
 */
function baseFor(coOwners: number): number {
  return Math.min(MAX_DISCOUNT_PCT, MIN_DISCOUNT_PCT + 1 + (coOwners - 2));
}

export interface CrossLeaseDiscount {
  /** The discount actually applied, as a percentage of the total value. */
  pct: number;
  /** Where it started, from the co-owner count alone. */
  basePct: number;
  /** How many flats share the land — the denominator of the LINZ share. */
  coOwners: number;
  /** What was observed, and what each observation was worth, worst first. */
  factors: Factor[];
  /** True when nothing about the sharing could be observed. */
  unobserved: boolean;
  /**
   * The discount in dollars, filled in by the valuation once there is a total
   * to take it off. Shown as its own line: `landValue` and `buildingValue` stay
   * gross precisely so this number has to be read rather than absorbed.
   */
  deduction?: number;
}

/**
 * Size the discount for THIS cross lease.
 *
 * `coOwners` comes from the LINZ share denominator — the "2" in "Fee Simple,
 * 1/2". It is a fact off the register, not an estimate, and this function is
 * never called without it: a cross lease whose share we cannot read is one
 * whose land we cannot divide either, and that property does not reach here.
 */
export function crossLeaseDiscount(
  coOwners: number,
  sharing?: CrossLeaseSharing | null
): CrossLeaseDiscount {
  const n = Math.max(2, Math.round(coOwners));
  const basePct = baseFor(n);

  const factors = factorsFor(sharing ?? {}).sort((a, b) => b.points - a.points);
  const rawSwing = factors.reduce((sum, f) => sum + f.points, 0);
  const swing = Math.max(-MAX_ENTANGLEMENT_SWING, Math.min(MAX_ENTANGLEMENT_SWING, rawSwing));

  const pct = Math.max(MIN_DISCOUNT_PCT, Math.min(MAX_DISCOUNT_PCT, basePct + swing));

  return {
    pct: Math.round(pct * 10) / 10,
    basePct,
    coOwners: n,
    factors,
    unobserved: factors.length === 0,
  };
}

/**
 * One line saying what the discount is and where it came from, for the report.
 *
 * The reader is told the tenure cost them money and why — a figure that quietly
 * shaved 8% off with no explanation is a figure they cannot argue with, and an
 * unarguable number is the thing this app exists to replace.
 */
export function explainCrossLeaseDiscount(d: CrossLeaseDiscount): string {
  const flats = d.coOwners === 2 ? "two flats" : `${d.coOwners} flats`;
  const base = `Cross lease — the land is shared between ${flats}, so the value carries a ${d.pct}% discount against the equivalent freehold.`;
  if (d.unobserved) {
    return `${base} The listing didn't show enough of the site to tell how separate the flats really are, so this sits at what ${flats} sharing a title costs on average.`;
  }
  const worst = d.factors[0];
  const best = d.factors[d.factors.length - 1];
  if (worst.points > 0 && best.points < 0) {
    return `${base} ${worst.label.toLowerCase()} counts against it; ${best.label.toLowerCase()} counts for it.`;
  }
  if (worst.points > 0) return `${base} What pushes it up: ${d.factors.map((f) => f.label.toLowerCase()).join(", ")}.`;
  return `${base} It sits at the bottom of the range because the flats are unusually separate: ${d.factors.map((f) => f.label.toLowerCase()).join(", ")}.`;
}
