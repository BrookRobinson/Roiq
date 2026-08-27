#!/usr/bin/env node
// Grading our own valuations. Run: npm run verify:scoreboard
//
// Every rule here is a way of fooling yourself, and none of them throws.
//
// The one that matters most is the sample floor. Three sections selling above
// our number is a reason to LOOK; it is not a bias, and a scoreboard that
// calls it one gets a rate moved on nothing. Chase the last few sales and the
// valuation lurches around and is wrong in a new direction every month. Below
// MIN_SAMPLE this must return "insufficient" no matter how damning the numbers.
//
// The second is the refusal to grade a valuation made AFTER the sale. A
// valuation produced from a sold listing has already read the answer off the
// page — grading it would report the model as excellent because it was copying.
//
// The third is the sign convention. Negative means we valued BELOW the market,
// which for a buyer means underbidding and losing houses. Flip that by accident
// and the scoreboard tells you to correct in the wrong direction.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const S = await import(join(root, "lib/valuation/scoreboard.ts"));
const { grade, isGrade, summarise, summariseBy, shouldDisclose, isBareLand, median,
        MIN_SAMPLE, BIAS_PCT, MAX_PREDICTION_AGE_DAYS } = S;

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};

const pred = (over = {}) => ({
  id: "p1", valuation: 500_000, valuedAt: "2026-01-01T00:00:00Z",
  suburb: "Hokitika", region: "West Coast", propertyType: "house", ...over,
});
const out = (over = {}) => ({ salePrice: 500_000, saleDate: "2026-03-01T00:00:00Z", source: "cotality", ...over });
const why = (g) => (isGrade(g) ? "graded" : g.ungradable);

// ── 1. What may be graded at all ────────────────────────────────────────
console.log("\ngrade — what counts as a scored prediction");
check("valuation + sourced sale price", why(grade(pred(), out())), "graded");
check("no valuation of ours", why(grade(pred({ valuation: null }), out())), "no-valuation");
check("no sale price yet", why(grade(pred(), out({ salePrice: null }))), "no-sale-price");
// A price nobody can attribute is not evidence — same rule as the migration.
check("sale price with no source", why(grade(pred(), out({ source: null }))), "no-source");
// The self-marking trap: valuing a property whose sale price was on the page.
check(
  "valued AFTER it sold is a fit, not a prediction",
  why(grade(pred({ valuedAt: "2026-06-01T00:00:00Z" }), out())),
  "valued-after-sale"
);
check(
  `valued more than ${MAX_PREDICTION_AGE_DAYS} days before the sale`,
  why(grade(pred({ valuedAt: "2024-01-01T00:00:00Z" }), out())),
  "stale"
);
check("same day is fine", why(grade(pred({ valuedAt: "2026-03-01T00:00:00Z" }), out())), "graded");

// ── 2. The sign convention ──────────────────────────────────────────────
console.log("\nerrorPct — negative means WE were low");
check("valued 400k, sold 500k → −20%", grade(pred({ valuation: 400_000 }), out()).errorPct, -20);
check("valued 600k, sold 500k → +20%", grade(pred({ valuation: 600_000 }), out()).errorPct, 20);
check("spot on → 0%", grade(pred(), out()).errorPct, 0);

// ── 3. A handful of sales is not a bias ─────────────────────────────────
console.log("\nsummarise — the sample floor");
const g = (errorPct, over = {}) => ({ id: "x", errorPct, valuation: 1, salePrice: 1, ageDays: 30,
  suburb: "Hokitika", region: "West Coast", propertyType: "house", ...over });
const many = (n, errorPct, over) => Array.from({ length: n }, () => g(errorPct, over));

check("nothing graded at all", summarise([]).verdict, "insufficient");
// The exact scenario: three sections in a row, every one 20% under. Damning,
// and still not enough to move a rate on.
check("3 sales all 20% low is NOT a bias", summarise(many(3, -20)).verdict, "insufficient");
check("…and it reports the median anyway, to be looked at", summarise(many(3, -20)).medianErrorPct, -20);
check(`${MIN_SAMPLE - 1} sales is still not enough`, summarise(many(MIN_SAMPLE - 1, -20)).verdict, "insufficient");
check(`${MIN_SAMPLE} sales at −20% IS a bias`, summarise(many(MIN_SAMPLE, -20)).verdict, "biased-low");
check("…and the other direction", summarise(many(MIN_SAMPLE, 20)).verdict, "biased-high");

// ── 4. Bias and spread are different faults ─────────────────────────────
console.log("\nsummarise — an offset is not the same fault as scatter");
check("no offset, tight spread", summarise(many(MIN_SAMPLE, 1)).verdict, "unbiased");
// Median ~0 but wildly scattered: the rate is FINE, something is missing.
const scattered = [...many(13, -30), ...many(13, 30)];
check("no offset, wide spread → noisy, not biased", summarise(scattered).verdict, "noisy");
check("…median really is about zero", summarise(scattered).medianErrorPct, 0);
// Under the bias threshold is not a bias.
check(`${BIAS_PCT - 1}% offset is within tolerance`, summarise(many(MIN_SAMPLE, BIAS_PCT - 1)).verdict, "unbiased");

// ── 5. Outlier resistance ───────────────────────────────────────────────
console.log("\nmedian, not mean");
check("one absurd sale doesn't move the verdict",
  summarise([...many(MIN_SAMPLE, 0), g(5000)]).verdict, "unbiased");
check("empty median is null, never 0", median([]), null);
check("even-length median averages the middle", median([10, 20, 30, 40]), 25);

// ── 6. When the app owes its readers a warning ──────────────────────────
console.log("\nshouldDisclose — telling people we're off");
check("measured bias → say so", shouldDisclose(summarise(many(MIN_SAMPLE, -20))), true);
check("3 damning sales → do NOT say so yet", shouldDisclose(summarise(many(3, -20))), false);
check("unbiased → nothing to say", shouldDisclose(summarise(many(MIN_SAMPLE, 0))), false);
check("noisy → not a disclosure, it's a modelling job", shouldDisclose(summarise(scattered)), false);

// ── 7. Accuracy bands + grouping ────────────────────────────────────────
console.log("\nbands and breakdowns");
const mixed = [...many(5, 5), ...many(3, 15), ...many(2, 25)];
check("within 10%", summarise(mixed).within10Pct, 50);
check("within 20%", summarise(mixed).within20Pct, 80);
const byRegion = summariseBy([...many(4, 0, { region: "West Coast" }), ...many(2, 0, { region: "Otago" })], (x) => x.region);
check("grouped, biggest sample first", byRegion.map((r) => [r.key, r.summary.n]), [["West Coast", 4], ["Otago", 2]]);
check("a null key is dropped, not bucketed as 'null'", summariseBy(many(3, 0, { suburb: null }), (x) => x.suburb).length, 0);

// ── 8. Sections are the canary ──────────────────────────────────────────
console.log("\nisBareLand — the cleanest test we have");
check("section", isBareLand("section"), true);
check("lifestyle-section", isBareLand("lifestyle-section"), true);
check("house", isBareLand("house"), false);
check("unknown type is not assumed bare", isBareLand(null), false);

console.log(failures === 0 ? "\nAll scoreboard rules hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
