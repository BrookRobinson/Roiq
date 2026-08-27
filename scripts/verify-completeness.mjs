#!/usr/bin/env node
// When a grey pin may become a coloured one. Run: npm run verify:completeness
//
// A grey pin says one honest thing: this property is for sale and nobody has
// analysed it. The moment it turns coloured it starts making claims — a score,
// a valuation, a verdict against the asking price — and this decides whether
// the analysis behind them actually happened.
//
// It doesn't always. 244 Upper Kokatahi Road: 27 photos read, 62 sub-items
// produced, every one unassessable, because the run was interrupted half way.
// A max_tokens truncation looks the same and is worse — the SDK's partial-JSON
// parser hands the fragment back looking clean. Both wrote a pin; both then
// priced a $699,000 property at $242,028 and coloured it red.
//
// This gate fails OPEN if it's wrong, which is the dangerous direction: a bad
// report becomes a pin and nothing complains. So the cases below are the three
// ways an analysis can not-have-happened, plus the two that look broken and
// aren't — a bare section, and a report with no valuation.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { whyIncomplete, isComplete, assessedFraction } = await import(
  join(root, "lib/map/report-completeness.ts")
);

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};

/** A normal, finished house report. */
const ok = (over = {}) => ({
  photosAnalysed: 27, assessedPoints: 780, unassessedPoints: 220, score: 640, ...over,
});

console.log("\na finished report becomes a pin");
check("normal house report", whyIncomplete(ok()), null);
check("…and isComplete agrees", isComplete(ok()), true);

console.log("\nthe three ways an analysis didn't happen");
check("no photographs read", whyIncomplete(ok({ photosAnalysed: 0 })), "no-photos");
// The exact Kokatahi shape: photos read, nothing gradeable, score 0.
check(
  "interrupted run — photos read, nothing assessed",
  whyIncomplete({ photosAnalysed: 27, assessedPoints: 0, unassessedPoints: 1000, score: 0 }),
  "no-score"
);
check("score of zero", whyIncomplete(ok({ score: 0 })), "no-score");
check("no score at all", whyIncomplete(ok({ score: null })), "no-score");
check("a NaN score is not a score", whyIncomplete(ok({ score: NaN })), "no-score");
// A score with nothing under it — the denominator collapsed.
check("scored, but no points were assessable", whyIncomplete(ok({ assessedPoints: 0 })), "nothing-assessed");

console.log("\nthings that look broken and are not");
// A bare section assesses Land and Legal only. Low fraction, complete report.
check(
  "a bare section is complete",
  whyIncomplete({ photosAnalysed: 12, assessedPoints: 240, unassessedPoints: 760, score: 520, landOnly: true }),
  null
);
// No valuation is a gap in the WORLD (no land area, no comparable sales), not
// in the analysis. The pin may carry a score and admit it has no price.
check("a report with no valuation is still complete", whyIncomplete(ok()), null);
// One photo is thin, but it is not zero, and picking a minimum would be a
// number nobody chose.
check("one photograph still counts", whyIncomplete(ok({ photosAnalysed: 1 })), null);
check("a low assessed share is not a refusal", whyIncomplete(ok({ assessedPoints: 30, unassessedPoints: 970 })), null);

console.log("\nassessedFraction — measured, never gated on");
check("780 of 1000", assessedFraction(ok()), 0.78);
check("a bare section reads low by design",
  assessedFraction({ photosAnalysed: 12, assessedPoints: 240, unassessedPoints: 760, score: 520 }), 0.24);
check("nothing at all is null, not zero", assessedFraction(ok({ assessedPoints: 0, unassessedPoints: 0 })), null);

console.log(failures === 0 ? "\nCompleteness rules hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
