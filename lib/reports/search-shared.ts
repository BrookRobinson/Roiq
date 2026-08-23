// ============================================================
// The shape of an address search, and its limits.
//
// Pure and import-safe from anywhere. The search itself lives in `search.ts`,
// which reaches for the service-role client and must never touch a client
// bundle — so the pieces the browser legitimately needs (the result type and
// the minimum query length the input enforces) live here instead. Same split as
// `billing/plans.ts` against `billing/stripe.ts`, for the same reason.
// ============================================================

/** Below this a query matches half the country, so we don't run it. */
export const MIN_QUERY_LENGTH = 3;

/** Enough to choose from; few enough that nobody harvests the table with it. */
export const MAX_MATCHES = 6;

export interface AnalysedMatch {
  address: string;
  suburb: string | null;
  region: string | null;
  /**
   * How to open it again. The stored listing URL is the strong handle; a report
   * from uploaded photos has none, and the address is matched instead.
   */
  listingUrl: string | null;
  analysedAt: string;
  /** The caller's own report — theirs to open directly, and already paid for. */
  mine: boolean;
  /**
   * Set ONLY when `mine`. A stranger's report id is not the caller's to open:
   * they go through the normal analyse flow, which re-checks the listing and
   * charges them an allowance like everyone else.
   */
  id: string | null;
}
