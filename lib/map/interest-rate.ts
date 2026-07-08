// Current NZ average mortgage rate — the default interest rate on Screen 1.
// TODO: fetch live from the RBNZ B20 "new residential mortgage" series (or a
// reliable aggregator) and cache for 24h in Upstash Redis. Until that's wired,
// a current-market constant so the rest of the feature works end to end.

export const DEFAULT_INTEREST_RATE = 6.5; // % — indicative NZ floating rate

let cache: { rate: number; at: number } | null = null;

/** Server-side: current average NZ mortgage rate, cached 24h. */
export async function getDefaultInterestRate(): Promise<number> {
  const DAY = 24 * 60 * 60 * 1000;
  if (cache && Date.now() - cache.at < DAY) return cache.rate;
  // TODO: replace with `await fetch(RBNZ...)` + parse.
  cache = { rate: DEFAULT_INTEREST_RATE, at: Date.now() };
  return cache.rate;
}
