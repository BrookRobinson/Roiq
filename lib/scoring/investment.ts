// ============================================================
// BDR Report investment math (v3.4) — yield, capital growth, predicted sale price.
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
 * Quality → value multiplier (Change 1 Value Verdict). The hidden 1,000-pt score
 * scales the suburb median to reflect this property's condition vs the median home.
 */
export function qualityMultiplier(score: number): number {
  if (score < 200) return 0.65;
  if (score < 400) return 0.80;
  if (score < 600) return 0.95;
  if (score < 800) return 1.20;
  return 1.45;
}

/** BDR Report fair value = suburb median $/m² × quality multiplier × floor area. */
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
