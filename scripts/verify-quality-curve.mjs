#!/usr/bin/env node
// The score → value multiplier. Run: npm run verify:quality-curve
//
// This number multiplies a suburb rate into a valuation that ends up in front
// of a buyer deciding what to offer, so a wrong one here is not a rounding
// error — it is somebody bidding on the strength of it.
//
// It used to be a staircase: `score < 600 ? 0.95 : 1.20`. One point of a
// thousand moved the answer 26%. 230 Sewell Street scores 592; eight points the
// other way took its valuation from $586,264 to $740,545, on a model that
// cannot tell 592 from 600 to remotely that precision.
//
// The fix keeps the five anchors and interpolates between them, which means the
// thing to protect is: the anchors still return exactly what they always did,
// and NOWHERE does a single point move the answer more than a whisker.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { qualityMultiplier, roiqFairValue, isScorable, QUALITY_ANCHORS } = await import(
  join(root, "lib/scoring/investment.ts")
);

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const near = (label, got, want, tol) => {
  if (Math.abs(got - want) <= tol) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${got}, wanted ${want} ±${tol}`); failures++; }
};

// ── 1. The anchors are untouched ────────────────────────────────────────
console.log("\nthe five chosen values still mean what they meant");
for (const [score, mult] of QUALITY_ANCHORS) {
  check(`score ${score} → ${mult}`, qualityMultiplier(score), mult);
}

// ── 2. No cliff anywhere ────────────────────────────────────────────────
console.log("\nno single point may move the valuation more than a whisker");
let worstJump = 0, worstAt = null;
for (let s = 0; s < 1000; s++) {
  const jump = Math.abs(qualityMultiplier(s + 1) - qualityMultiplier(s)) / qualityMultiplier(s);
  if (jump > worstJump) { worstJump = jump; worstAt = s; }
}
near(`worst one-point jump is tiny (at score ${worstAt})`, worstJump * 100, 0, 0.2);
// The exact boundary that used to cost 26%.
near("599 → 600 barely moves", (qualityMultiplier(600) / qualityMultiplier(599) - 1) * 100, 0, 0.2);
check("…and it used to be 26.3%", Math.round((1.2 / 0.95 - 1) * 1000) / 10, 26.3);

// ── 3. Still monotonic — a better property is never worth less ──────────
console.log("\nmonotonic: a higher score is never worth less");
let breaks = 0;
for (let s = 0; s < 1000; s++) if (qualityMultiplier(s + 1) < qualityMultiplier(s)) breaks++;
check("no score where scoring higher lowers the valuation", breaks, 0);

// ── 4. Interpolation is actually happening ──────────────────────────────
console.log("\nbetween anchors, proportional");
check("400 sits halfway between 0.80 and 0.95", qualityMultiplier(400), 0.875);
check("600 sits halfway between 0.95 and 1.20", qualityMultiplier(600), 1.075);
check("800 sits halfway between 1.20 and 1.45", qualityMultiplier(800), 1.325);
near("a quarter of the way", qualityMultiplier(350), 0.8375, 1e-9);

// ── 5. The ends are flat, not extrapolated ──────────────────────────────
console.log("\nends are flat — never invent a sixth number");
check("score 0 clamps to the bottom anchor", qualityMultiplier(0), 0.65);
check("below the range", qualityMultiplier(-50), 0.65);
check("a perfect 1000 gets the top anchor, not more", qualityMultiplier(1000), 1.45);
check("above the range", qualityMultiplier(99999), 1.45);
check("garbage in is not NaN out", qualityMultiplier(NaN), 0.65);

// ── 6. The valuation it feeds ───────────────────────────────────────────
console.log("\nroiqFairValue rounds to whole dollars");
check("median 6000 × 0.95 × 150m²", roiqFairValue(6000, 500, 150), 855_000);
check("one point higher is not a different house", 
  Math.abs(roiqFairValue(6000, 592, 150) - roiqFairValue(6000, 593, 150)) < 1500, true);

// ── 7. A score of zero is not a score ───────────────────────────────────
// 244 Upper Kokatahi Road: 27 photos read, 62 sub-items produced, every one of
// them unassessable, byCategory empty, total 0. The house is fine; the analysis
// of it isn't. Unguarded, that zero multiplied the suburb rate by the bottom of
// the curve and valued a $699,000 property at $242,028 — and published "0/1000"
// against a real address, which reads as the worst house in New Zealand.
console.log("\nisScorable — zero means we assessed nothing, not that it's worthless");
check("a real score", isScorable(650), true);
check("the lowest real score there is", isScorable(1), true);
check("zero is not a score", isScorable(0), false);
check("null", isScorable(null), false);
check("undefined", isScorable(undefined), false);
check("NaN", isScorable(NaN), false);
check("a negative is not a score", isScorable(-10), false);

console.log("\nno score, no price");
check("score 0 produces NO valuation", roiqFairValue(6000, 0, 150), null);
check("…the same refusal as no median or no floor area", roiqFairValue(6000, 0, 0), null);
check("a real score still produces one", roiqFairValue(6000, 650, 150), 1_023_750);
// The exact figure the guard prevents: Kokatahi's $699,000 asking price valued
// at the bottom of the curve off a score nobody produced.
check("the Kokatahi valuation is refused, not floored", roiqFairValue(2200, 0, 110), null);

console.log(failures === 0 ? "\nQuality curve holds.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
