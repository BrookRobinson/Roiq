// Fallback NZ mortgage rate — the value Screen 1 starts from before the live
// figure arrives, and what it keeps if the live lookup comes back empty.
//
// This file is pulled into the CLIENT bundle (via `variables.ts`), so it holds
// the constant and nothing else. The live lookup lives in
// `interest-rate.server.ts`, which reuses `lib/ai/rates.ts` (interest.co.nz +
// the major banks, with the source cited).

export const DEFAULT_INTEREST_RATE = 6.5; // % — indicative NZ rate
