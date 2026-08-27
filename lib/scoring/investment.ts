// ============================================================
// Tectara investment math (v3.4) — yield, capital growth, predicted sale price.
// Pure functions; the 1,000-pt quality score is untouched (panels approach).
// ============================================================

/** Estimated weekly rent for the property/suburb. */
export interface MarketRent {
  weekly: number;
  source: string; // e.g. "myRent / Tenancy Services market rent (Remuera)"
  isEstimate: boolean; // true = AI/indicative, false = from a cited median
}

/** Suburb capital-growth signal. */
export interface CapitalGrowth {
  annualRatePct: number; // long-run trend, e.g. 4.7
  source: string;
  why: string; // written explanation of the drivers
  recentNote?: string; // honest near-term note, e.g. "−9.4% last 12 months"
}

/** Scraped suburb median $/m² from recent comparable sales (Change 2). */
export interface SuburbValue {
  medianPerSqm: number; // headline figure, $/m²
  sampleSize: number; // number of recent sales used
  medianSalePrice?: number;
  medianFloorArea?: number;
  propertyType?: string; // type filtered to, e.g. "house"
  suburb: string; // label, e.g. "Greymouth, West Coast"
  source: string; // e.g. "oneroof.co.nz" (+ any cross-checks)
  widenedNote?: string; // set if the search widened to a nearby town/district
  retrieved: string; // "June 2026"
}

// ── There is no second valuation here ────────────────────────────────────────
//
// `qualityMultiplier()` and `roiqFairValue()` used to live at this spot: suburb
// $/m² × a condition multiplier × floor area, the map's own way of pricing a
// house. It was a rival to the report's land + improvements figure and it lost.
// Same property, two answers — 230 Sewell Street was $697,648 in the report and
// $657,233 on the map — and because it had no land term at all, a 342m²
// building on the West Coast came out at $1.17m against a $659,000 asking
// price. A pin now carries the report's valuation or none.
//
// Don't reintroduce a shortcut here. lib/scoring/property-value.ts is the only
// place a property gets a value.

/**
 * Did the analysis actually assess anything?
 *
 * A score of zero is not a bad property. It is what comes back when EVERY item
 * landed in `unassessed`, and there are at least three ways to get there:
 * photographs that show too little (Tier 3 items no longer score), an analysis
 * interrupted part-way, or a response truncated at max_tokens, which the SDK's
 * partial-JSON parser hands back looking like a clean result. They are
 * indistinguishable from here — 244 Upper Kokatahi Road looked like the first
 * and turned out to be the second — so nothing downstream may name a cause.
 *
 * Left unguarded that zero flows straight into a price. It multiplied the
 * suburb rate by the bottom of the quality curve and valued a $699,000 property
 * at $242,028 — and published "0/1000" against a real address, which reads as
 * the worst house in New Zealand rather than "we couldn't see enough". Both are
 * claims we have no basis for.
 *
 * Zero is the only value refused, deliberately. Anything above it means at
 * least one item was graded, and inventing a floor above zero would be picking
 * a number nobody chose.
 */
export function isScorable(score: number | null | undefined): score is number {
  return typeof score === "number" && Number.isFinite(score) && score > 0;
}


/** Compound a price forward at an annual rate for N years. */
export function projectValue(price: number, annualRatePct: number, years: number): number {
  return price * Math.pow(1 + annualRatePct / 100, years);
}

/** Cumulative growth percentage over N years (compounded). */
export function cumulativeGrowthPct(annualRatePct: number, years: number): number {
  return (Math.pow(1 + annualRatePct / 100, years) - 1) * 100;
}

/**
 * Predicted future sale price (replaces the old VFM grade):
 *   asking grown by capital growth over the hold period, minus the urgent
 *   renovation spend you've toggled on.
 */
export function predictedSalePrice(
  asking: number,
  toggledRenoCosts: number,
  annualRatePct: number,
  years: number
): number {
  return projectValue(asking, annualRatePct, years) - toggledRenoCosts;
}

export function grossYieldPct(weeklyRent: number, totalInvestment: number): number {
  return totalInvestment > 0 ? ((weeklyRent * 52) / totalInvestment) * 100 : 0;
}

export function netYieldPct(weeklyRent: number, totalInvestment: number, annualCosts: number): number {
  return totalInvestment > 0 ? ((weeklyRent * 52 - annualCosts) / totalInvestment) * 100 : 0;
}

/** Rough annual operating costs for a NZ rental (rates + insurance + PM + maintenance). */
export function estimateAnnualCosts(price: number, weeklyRent: number): number {
  const rates = 3200; // indicative territorial rates
  const insurance = 2200;
  const propertyMgmt = weeklyRent * 52 * 0.08; // ~8% of rent
  const maintenance = price * 0.01; // 1% of value
  return rates + insurance + propertyMgmt + maintenance;
}

/** Indicative vacancy descriptor from suburb demand (loc_growth score 1–10). */
export function vacancyRisk(growthScore: number | null | undefined): { label: string; color: string } {
  const s = growthScore ?? 6;
  if (s >= 8) return { label: "Low", color: "#00e676" };
  if (s >= 5) return { label: "Moderate", color: "#fbbf24" };
  return { label: "Elevated", color: "#ff5f5f" };
}
