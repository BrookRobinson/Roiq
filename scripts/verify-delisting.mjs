#!/usr/bin/env node
// When a listing may be recorded as gone. Run: npm run verify:delisting
//
// This guards a write that cannot be undone in any useful sense. If a sweep
// concludes that four thousand houses left the market on a night when the real
// answer was "a shard came back empty", the map is wrong, the days-on-market
// figures are wrong, and — worst — those rows sit waiting to be joined to a
// sale price that will never come, indistinguishable from the real ones. There
// is nothing in the data afterwards that says which is which.
//
// The dangerous cases are the ones where absence is an artefact of HOW WE
// LOOKED rather than a fact about the market: an incremental crawl that only
// asked what changed, a crawl narrowed to one region, a crawl that read one of
// the two sitemaps, a crawl with a failed shard. Every one of them presents as
// mass delisting, and every one of them is checked here.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { sweepRefusal, seenEnough, planSweep, daysOnMarket, MIN_SEEN_RATIO } = await import(
  join(root, "lib/map/delisting.ts")
);

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    console.log("  ✓ " + label);
  } else {
    console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
    failures++;
  }
};

/** A crawl that read the whole index cleanly — the only kind that may conclude. */
const complete = (over = {}) => ({
  since: null,
  regions: null,
  categories: ["residential", "rural"],
  shardsRead: 24,
  shardsFailed: 0,
  ...over,
});

// ── 1. Which crawls may conclude anything ───────────────────────────────
console.log("\nsweepRefusal — a crawl has to have looked everywhere");
check("a complete crawl may sweep", sweepRefusal(complete()), null);
check("incremental may not", sweepRefusal(complete({ since: "2026-08-25" })), "incremental");
check("region-filtered may not", sweepRefusal(complete({ regions: ["west-coast"] })), "region-filtered");
check("one sitemap only may not", sweepRefusal(complete({ categories: ["residential"] })), "partial-categories");
check("rural only may not", sweepRefusal(complete({ categories: ["rural"] })), "partial-categories");
check("a single failed shard stops it", sweepRefusal(complete({ shardsFailed: 1 })), "shards-failed");
check("nothing read at all", sweepRefusal(complete({ shardsRead: 0 })), "no-shards");
// An empty regions array is "no filter", not "filter to nothing".
check("empty region list is no filter", sweepRefusal(complete({ regions: [] })), null);

// ── 2. The circuit breaker ──────────────────────────────────────────────
console.log("\nseenEnough — listings do not vanish by the thousand");
check("saw everything", seenEnough(41_000, 41_000), true);
check("saw a bit fewer, fine", seenEnough(40_000, 41_000), true);
check(`saw under ${MIN_SEEN_RATIO * 100}%, refuse`, seenEnough(19_000, 41_000), false);
check("saw nothing at all, refuse", seenEnough(0, 41_000), false);
check("an empty map has nothing to compare", seenEnough(0, 0), true);

// ── 3. Absence is noted once and concluded twice ────────────────────────
console.log("\nplanSweep — a listing has to go missing twice");
const pin = (over = {}) => ({
  sourceKey: "oneroof-A1",
  indexKey: "oneroof.co.nz/property/x/y/z/A1",
  missingSince: null,
  listingStatus: "active",
  ...over,
});
const seen = (...keys) => new Set(keys);

check(
  "present: nothing happens",
  planSweep([pin()], seen("oneroof.co.nz/property/x/y/z/A1")),
  { delist: [], suspect: [], returned: [] }
);
check("absent once: suspected only", planSweep([pin()], seen()), {
  delist: [],
  suspect: ["oneroof-A1"],
  returned: [],
});
check("absent twice: delisted", planSweep([pin({ missingSince: "2026-08-20T00:00:00Z" })], seen()), {
  delist: ["oneroof-A1"],
  suspect: [],
  returned: [],
});
check(
  "back in the index: suspicion withdrawn",
  planSweep([pin({ missingSince: "2026-08-20T00:00:00Z" })], seen("oneroof.co.nz/property/x/y/z/A1")),
  { delist: [], suspect: [], returned: ["oneroof-A1"] }
);

// The pin that must never be touched: a property analysed from a Trade Me link
// has no entry in OneRoof's sitemap and never will. Treating "not in the index
// we crawled" as "gone from the market" would delist it on the first sweep.
check(
  "a pin from another portal is not in this index",
  planSweep([pin({ sourceKey: "report-9", indexKey: null })], seen()),
  { delist: [], suspect: [], returned: [] }
);
check(
  "…not even on a second miss",
  planSweep([pin({ sourceKey: "report-9", indexKey: null, missingSince: "2026-08-20T00:00:00Z" })], seen()),
  { delist: [], suspect: [], returned: [] }
);
// Already gone, and already priced by a sale feed — never re-stamp either.
check(
  "an already-removed pin is left alone",
  planSweep([pin({ listingStatus: "removed", missingSince: "2026-08-20T00:00:00Z" })], seen()),
  { delist: [], suspect: [], returned: [] }
);
check("a sold pin is left alone", planSweep([pin({ listingStatus: "sold" })], seen()), {
  delist: [],
  suspect: [],
  returned: [],
});

// ── 4. Days on market ───────────────────────────────────────────────────
console.log("\ndaysOnMarket — only when both ends are known");
check("a normal run", daysOnMarket("2026-06-01T00:00:00Z", "2026-08-27T00:00:00Z"), 87);
check("never delisted", daysOnMarket("2026-06-01T00:00:00Z", null), null);
check("never seen listed", daysOnMarket(null, "2026-08-27T00:00:00Z"), null);
check("delisted before it was listed is nonsense", daysOnMarket("2026-08-27T00:00:00Z", "2026-06-01T00:00:00Z"), null);
check("unparseable is not zero", daysOnMarket("whenever", "2026-08-27T00:00:00Z"), null);

console.log(
  failures === 0
    ? "\nAll delisting rules hold.\n"
    : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`
);
process.exit(failures === 0 ? 0 : 1);
