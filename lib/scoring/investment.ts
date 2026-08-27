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

/**
 * Quality → value multiplier. The 1,000-point score scales the suburb median to
 * reflect this property's condition against the median home.
 *
 * These five numbers used to be a staircase — `score < 600 ? 0.95 : 1.20` — and
 * a staircase is indefensible in a valuation. One point of a thousand, at 599
 * versus 600, moved the answer 26%. 230 Sewell Street scores 592: eight points
 * the other way and its valuation went from $586,264 to $740,545, on a model
 * that cannot tell 592 from 600 to anything like that precision. Nobody could
 * explain that to a buyer, because there is nothing to explain — it was an
 * artefact of where the bands were drawn.
 *
 * So the anchors are kept and the steps between them are interpolated. Each
 * band's value is pinned to the MIDDLE of the band it used to cover, which is
 * the score it was always most defensible for: a property scoring 300 or 500 or
 * 700 gets exactly what it got before, and it is the band EDGES — the arbitrary
 * part — that move. Below the first anchor and above the last it is flat,
 * because extrapolating past the range someone actually chose would be
 * inventing a sixth number.
 *
 * What this does NOT do is make the five numbers right. They are still five
 * values somebody picked, and no amount of smoothing changes that; it only
 * stops the model claiming a precision it hasn't got. Replacing them with a
 * curve fitted to real sales is what /api/health/valuation exists to make
 * possible — see lib/valuation/scoreboard.ts.
 */
export const QUALITY_ANCHORS: ReadonlyArray<readonly [score: number, multiplier: number]> = [
  [100, 0.65],
  [300, 0.8],
  [500, 0.95],
  [700, 1.2],
  [900, 1.45],
];

export function qualityMultiplier(score: number): number {
  const a = QUALITY_ANCHORS;
  const s = Math.max(0, Math.min(1000, Number.isFinite(score) ? score : 0));
  const first = a[0];
  const last = a[a.length - 1];
  if (s <= first[0]) return first[1];
  if (s >= last[0]) return last[1];
  for (let i = 1; i < a.length; i++) {
    const [x0, y0] = a[i - 1];
    const [x1, y1] = a[i];
    if (s <= x1) return y0 + ((s - x0) / (x1 - x0)) * (y1 - y0);
  }
  return last[1];
}

/** Tectara fair value = suburb median $/m² × quality multiplier × floor area. */
export function roiqFairValue(medianPerSqm: number, score: number, floorAreaSqm: number): number {
  return Math.round(medianPerSqm * qualityMultiplier(score) * floorAreaSqm);
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
