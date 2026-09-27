// ============================================================
// How wide the valuation's range is, and why.
//
// It used to be ±12% of the total on every property: a house photographed end
// to end in a suburb with forty recent sales got the same range as one half
// estimated from three. A width nobody measured is the invented-number habit
// again, and it hides the one thing a reader needs to know about the figure —
// what it is most unsure of.
//
// So the range is built from the property's own evidence, part by part:
//
//   LAND      the suburb rate is a median of N recent sales. Fewer sales, a
//             search widened past the suburb, and site facts nobody could
//             establish all widen it.
//   BUILDING  components read from photographs are the firmest; the structure
//             behind the linings less so; anything estimated from the rest of
//             the house least of all. No trade price has been verified yet, so
//             every building figure carries that on top.
//   EXTRAS    a sleepout or a pool, valued the same way the house is.
//
// The parts are combined the way independent errors combine — root-sum-of-
// squares — EXCEPT the building's parts, which are added straight: they share
// one cost basis, so if the prices are high they are high everywhere at once.
// Land and building have different sources and do not move together.
//
// Every rate below is a stated assumption, not a measurement, and the report
// says so. When the scoreboard has graded 25+ valuations against real sale
// prices, the range should come from THAT spread instead, and these go.
//
// Dependency-free so verify:valuation-range can load it with plain node.
// ============================================================

/** How much a single sale's $/m² strays from the suburb median, typically. */
export const SUBURB_SALE_SPREAD = 0.3;
/** Turning house sales into a land rate (sale − building) adds its own error. */
export const LAND_EXTRACTION = 0.05;
/** No sample size recorded: treat the land rate as poorly evidenced. */
export const LAND_UNKNOWN_SAMPLE = 0.25;
/** A rate from the wider district rather than the suburb. */
export const WIDENED_FACTOR = 1.5;
/** Each site fact (shape, slope, sun, access) that couldn't be established. */
export const UNESTABLISHED_FACT = 0.03;
export const LAND_MIN = 0.05;
export const LAND_MAX = 0.3;

/** Trade prices and material costs, until any of them is verified. */
export const UNVERIFIED_PRICES = 0.15;
/** A component read from photographs — condition and age are judgements. */
export const SEEN_READ = 0.05;
/** The frame and services behind the linings: rate × area × age. */
export const SHELL_READ = 0.08;
/** A component nobody photographed, estimated from the rest of the house. */
export const ESTIMATED_READ = 0.3;
/** A standalone structure: size and fit-out mostly unseen inside. */
export const EXTRA_READ = 0.15;
/** Floor-area comparables with no condition adjustment (apartments, units). */
export const TYPICAL_FOR_TYPE = 0.1;

const rss = (...xs: number[]) => Math.sqrt(xs.reduce((s, x) => s + x * x, 0));
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export interface RangePart {
  key: "land" | "seen" | "shell" | "estimated" | "extra" | "comparables";
  label: string;
  /** The value this part carries. */
  valueNZD: number;
  /** Its half-width as a share of its own value. */
  pct: number;
  /** Its half-width in dollars — what it adds to the range. */
  plusMinusNZD: number;
  /** Why it is that wide, in a buyer's words. */
  reason: string;
}

export interface ValuationRange {
  low: number;
  high: number;
  /** Half-width in dollars. */
  plusMinusNZD: number;
  /** Half-width as a share of the total. */
  pct: number;
  /** Widest first. */
  parts: RangePart[];
  /** One line for under the figure: what drives the width. */
  summary: string;
}

export interface LandEvidence {
  valueNZD: number;
  /** Recent sales behind the suburb rate. 0 or null when unrecorded. */
  sampleSize?: number | null;
  /** The search widened past the suburb to the district. */
  widened?: boolean;
  /** Site facts that couldn't be established (they moved nothing). */
  unestablishedFacts?: number;
  /** "Remuera" — for the reason line. */
  suburb?: string | null;
}

/** The land rate's half-width as a share of the land value. */
export function landPct(e: Omit<LandEvidence, "valueNZD">): number {
  const n = e.sampleSize ?? 0;
  const sampling = n > 0 ? SUBURB_SALE_SPREAD / Math.sqrt(n) : LAND_UNKNOWN_SAMPLE;
  const facts = Math.max(0, e.unestablishedFacts ?? 0);
  const base = rss(sampling * (e.widened ? WIDENED_FACTOR : 1), LAND_EXTRACTION, Math.sqrt(facts) * UNESTABLISHED_FACT);
  return clamp(base, LAND_MIN, LAND_MAX);
}

function landReason(e: LandEvidence): string {
  const n = e.sampleSize ?? 0;
  const where = e.suburb ? ` in ${e.suburb}` : "";
  const bits = [
    n > 0 ? `the land rate comes from ${n} recent ${n === 1 ? "sale" : "sales"}${where}` : "the number of sales behind the land rate wasn't recorded",
    e.widened ? "the search had to widen past the suburb" : null,
    e.unestablishedFacts ? `${e.unestablishedFacts} site ${e.unestablishedFacts === 1 ? "fact" : "facts"} couldn't be measured` : null,
  ].filter(Boolean);
  return bits.join("; ");
}

/**
 * The range for a house on its own land: land plus the building's parts plus
 * any standalone structures. `scale` applies a tenure discount (a cross lease)
 * to the whole range, the same way it applies to the total.
 */
export function houseRange(args: {
  total: number;
  land: LandEvidence;
  seenNZD: number;
  shellNZD: number;
  estimatedNZD: number;
  extraNZD: number;
  /** total ÷ (land + building + extras) — below 1 on a cross lease. */
  scale?: number;
  pricesVerified?: boolean;
}): ValuationRange {
  const price = args.pricesVerified ? 0 : UNVERIFIED_PRICES;
  const lp = landPct(args.land);
  const parts: RangePart[] = [
    {
      key: "land",
      label: "Land",
      valueNZD: args.land.valueNZD,
      pct: lp,
      plusMinusNZD: args.land.valueNZD * lp,
      reason: landReason(args.land),
    },
    {
      key: "seen",
      label: "What the photos showed",
      valueNZD: args.seenNZD,
      pct: rss(SEEN_READ, price),
      plusMinusNZD: args.seenNZD * rss(SEEN_READ, price),
      reason: args.pricesVerified ? "read from the photographs" : "read from the photographs, at trade prices not yet verified",
    },
    {
      key: "shell",
      label: "Structure & services",
      valueNZD: args.shellNZD,
      pct: rss(SHELL_READ, price),
      plusMinusNZD: args.shellNZD * rss(SHELL_READ, price),
      reason: "behind the linings, priced by floor area and depreciated by age",
    },
    {
      key: "estimated",
      label: "Not photographed (estimated)",
      valueNZD: args.estimatedNZD,
      pct: rss(ESTIMATED_READ, price),
      plusMinusNZD: args.estimatedNZD * rss(ESTIMATED_READ, price),
      reason: "estimated from the condition of the rest of the house",
    },
    {
      key: "extra",
      label: "Extra dwellings & structures",
      valueNZD: args.extraNZD,
      pct: rss(EXTRA_READ, price),
      plusMinusNZD: args.extraNZD * rss(EXTRA_READ, price),
      reason: "valued from the outside; the fit-out inside is mostly unseen",
    },
  ].filter((p) => p.valueNZD > 0) as RangePart[];

  const land = parts.find((p) => p.key === "land")?.plusMinusNZD ?? 0;
  // One cost basis under every building part: their errors add, not cancel.
  const building = parts.filter((p) => p.key !== "land").reduce((s, p) => s + p.plusMinusNZD, 0);
  const scale = args.scale ?? 1;
  return finish(args.total, rss(land, building) * scale, parts);
}

/**
 * The range for a property valued on floor-area comparables alone — an
 * apartment, a unit, a leasehold. The comparables are the whole figure, and
 * no condition adjustment has been applied, so it is wider for that.
 */
export function comparablesRange(args: { total: number; sampleSize?: number | null; widened?: boolean; suburb?: string | null }): ValuationRange {
  const n = args.sampleSize ?? 0;
  const sampling = n > 0 ? SUBURB_SALE_SPREAD / Math.sqrt(n) : LAND_UNKNOWN_SAMPLE;
  const pct = clamp(rss(sampling * (args.widened ? WIDENED_FACTOR : 1), TYPICAL_FOR_TYPE), LAND_MIN, LAND_MAX);
  const part: RangePart = {
    key: "comparables",
    label: "Comparable sales",
    valueNZD: args.total,
    pct,
    plusMinusNZD: args.total * pct,
    reason: `${n > 0 ? `${n} comparable ${n === 1 ? "sale" : "sales"}${args.suburb ? ` in ${args.suburb}` : ""}` : "the number of comparable sales wasn't recorded"}${args.widened ? ", widened past the suburb" : ""}, with no adjustment for this one's condition`,
  };
  return finish(args.total, part.plusMinusNZD, [part]);
}

function finish(total: number, plusMinus: number, parts: RangePart[]): ValuationRange {
  const sorted = [...parts].sort((a, b) => b.plusMinusNZD - a.plusMinusNZD);
  const pct = total > 0 ? plusMinus / total : 0;
  const top = sorted[0];
  const share = top && plusMinus > 0 ? top.plusMinusNZD / sorted.reduce((s, p) => s + p.plusMinusNZD, 0) : 0;
  const summary = top
    ? `±${Math.round(pct * 100)}%, ${share >= 0.6 ? "mostly" : "most of all"} the ${top.label.toLowerCase()}: ${top.reason}.`
    : `±${Math.round(pct * 100)}%.`;
  return {
    low: Math.round(total - plusMinus),
    high: Math.round(total + plusMinus),
    plusMinusNZD: Math.round(plusMinus),
    pct,
    parts: sorted,
    summary,
  };
}
