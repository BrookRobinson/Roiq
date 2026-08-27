// ============================================================
// When a listing has left the market — and, far more important, when we are
// not entitled to say so.
//
// The signal is absence: a property in OneRoof's for-sale index yesterday and
// not in it today has gone. The trouble is that absence is also what a broken
// crawl looks like. A shard that 200s with an empty <urlset>, an index that
// came back short, a region filter someone forgot they passed — every one of
// them presents as thousands of properties leaving the market overnight, and
// the write that follows is not reversible in any useful sense: once we have
// stamped "left the market on the 27th" against 4,000 houses that are still
// for sale, the record is poisoned and there is nothing in the data to say so.
//
// So this module is mostly refusals. A crawl earns the right to conclude
// anything only if it read the whole index; and even then a listing has to go
// missing TWICE in a row before we write it down.
//
// Dependency-free on purpose, so scripts/verify-delisting.mjs can load it with
// plain node — the same reason lib/viewing/status.ts imports nothing.
// ============================================================

/** Both of OneRoof's for-sale sitemaps. A crawl of one is not a crawl. */
export const ALL_CATEGORIES = ["residential", "rural"] as const;

/**
 * How much of what we hold a complete crawl must still find before we believe
 * it. Listings do not vanish by the thousand; a crawl that comes back having
 * seen less than half the index it saw yesterday has broken, not discovered
 * something. Deliberately loose — this is a circuit breaker, not a threshold
 * anyone should be tuning.
 */
export const MIN_SEEN_RATIO = 0.5;

/** What a crawl actually covered, as opposed to what it was asked to cover. */
export interface CrawlScope {
  /** The `since` filter it ran with. Non-null means it only saw what CHANGED. */
  since: string | null;
  /** Region filter, if one was passed. */
  regions: string[] | null;
  /** Which of OneRoof's sitemaps were read. */
  categories: readonly string[];
  shardsRead: number;
  shardsFailed: number;
}

export type SweepRefusal =
  | "incremental"
  | "region-filtered"
  | "partial-categories"
  | "shards-failed"
  | "no-shards"
  | "too-few-seen";

export const REFUSAL_REASON: Record<SweepRefusal, string> = {
  incremental:
    "the crawl only read what changed since a date, so a listing it didn't see may simply not have been edited",
  "region-filtered": "the crawl was narrowed to some regions, so every pin outside them is missing by construction",
  "partial-categories": "one of OneRoof's two for-sale sitemaps wasn't read",
  "shards-failed": "a shard failed to read, and its listings are absent because we never looked",
  "no-shards": "nothing was read at all",
  "too-few-seen": "the crawl saw too little of what we already hold to be a complete one",
};

/**
 * Why this crawl may not be used to conclude a listing has gone — or null if it
 * may. Everything here is a reason absence would be an artefact of how we
 * looked rather than a fact about the market.
 */
export function sweepRefusal(scope: CrawlScope): SweepRefusal | null {
  if (scope.since) return "incremental";
  if (scope.regions?.length) return "region-filtered";
  if (ALL_CATEGORIES.some((c) => !scope.categories.includes(c))) return "partial-categories";
  if (scope.shardsFailed > 0) return "shards-failed";
  if (scope.shardsRead === 0) return "no-shards";
  return null;
}

/** The circuit breaker. An empty map has nothing to compare against and passes. */
export function seenEnough(seenCount: number, heldCount: number): boolean {
  if (heldCount === 0) return true;
  return seenCount >= heldCount * MIN_SEEN_RATIO;
}

export interface HeldPin {
  sourceKey: string;
  /**
   * The pin's key in the index we just crawled — its normalised OneRoof URL —
   * or null if this pin isn't in that index at all.
   *
   * Null is not a missing listing. A property analysed from a Trade Me link, or
   * a pin from before listing URLs were kept, has no entry in OneRoof's sitemap
   * and never will; treating it as absent would delist it on the first sweep.
   */
  indexKey: string | null;
  missingSince: string | null;
  listingStatus: string | null;
}

export interface SweepPlan {
  /** Missing from a complete crawl for the second time. Record it as gone. */
  delist: string[];
  /** Missing for the first time. Noted, not concluded. */
  suspect: string[];
  /** Back in the index — whatever we suspected, we were wrong. */
  returned: string[];
}

/**
 * Sort the pins we hold against what the crawl saw.
 *
 * Only pins that are (a) currently active and (b) actually in the crawled index
 * are eligible. Everything else is left exactly as it is.
 */
export function planSweep(held: readonly HeldPin[], seen: ReadonlySet<string>): SweepPlan {
  const plan: SweepPlan = { delist: [], suspect: [], returned: [] };

  for (const pin of held) {
    // Not in this index — nothing this crawl saw or failed to see means anything.
    if (!pin.indexKey) continue;
    // Already off the market. Coming back is handled by discovery's own upsert,
    // which writes it active again the moment the portal lists it.
    if (pin.listingStatus && pin.listingStatus !== "active") continue;

    if (seen.has(pin.indexKey)) {
      if (pin.missingSince) plan.returned.push(pin.sourceKey);
      continue;
    }

    if (pin.missingSince) plan.delist.push(pin.sourceKey);
    else plan.suspect.push(pin.sourceKey);
  }

  return plan;
}

/** Days a listing was on the market, or null if either end is unknown. */
export function daysOnMarket(firstSeen: string | null, delistedAt: string | null): number | null {
  if (!firstSeen || !delistedAt) return null;
  const from = Date.parse(firstSeen);
  const to = Date.parse(delistedAt);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
  return Math.round((to - from) / 86_400_000);
}
