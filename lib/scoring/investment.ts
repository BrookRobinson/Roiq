// ============================================================
// RoiQ investment math (v3.4) — yield, capital growth, predicted sale price.
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
