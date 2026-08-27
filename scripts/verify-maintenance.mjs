#!/usr/bin/env node
// Maintenance allowance by building age. Run: npm run verify:maintenance
//
// It was a flat 1% of price for everything, which is the usual rule of thumb
// and is wrong at both ends. A house finished last year has nothing worn out,
// nothing at end of life and a build warranty still running. A seventy-year-old
// villa has roof, wiring, piles and joinery all marching toward replacement at
// once. Charging both the same is a rule of thumb applied where the actual age
// is sitting right there in the report.
//
// The anchors are chosen and the code says so. What is defended here is the
// SHAPE — upkeep rises with age, never falls — plus the two ends, and that an
// unknown age falls back to the old flat rule rather than to a guess.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { maintenancePctForAge, maintenanceBasis, MAINTENANCE_PCT_UNKNOWN_AGE } = await import(
  join(root, "lib/finance/maintenance.ts")
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
const NOW = 2026;
const pct = (buildYear) => maintenancePctForAge(buildYear, NOW);

console.log("\nthe complaint that started this — a near-new house");
// 1% of a $509,000 apartment is $5,090 a year to maintain a one-year-old
// building. It is now 0.44%.
check("a 1-year-old build is not charged 1%", pct(2025) < 0.01, true);
near("…it's about 0.44%", pct(2025) * 100, 0.44, 0.05);
check("brand new is the floor", pct(2026), 0.004);

console.log("\nolder buildings cost more");
check("a 50-year-old is at the ceiling", pct(1976), 0.016);
check("a 100-year-old villa doesn't exceed it", pct(1926), 0.016);
check("older is never cheaper than newer", pct(1970) > pct(2020), true);

console.log("\nnever falls with age, and never jumps");
// A LATER build year means a NEWER house, so the rate must never go UP as the
// build year increases.
let breaks = 0, worst = 0;
for (let y = 1900; y < 2026; y++) {
  if (pct(y + 1) > pct(y) + 1e-12) breaks++;
  worst = Math.max(worst, Math.abs(pct(y) - pct(y + 1)));
}
check("a newer house is never dearer to keep, across 126 build years", breaks, 0);
// A house turning twenty overnight must not cost more to keep the next morning.
near("no year-to-year cliff", worst * 100, 0, 0.05);

console.log("\nunknown age keeps the old rule rather than guessing");
check("null build year", pct(null), MAINTENANCE_PCT_UNKNOWN_AGE);
check("undefined", pct(undefined), MAINTENANCE_PCT_UNKNOWN_AGE);
check("nonsense", pct(NaN), MAINTENANCE_PCT_UNKNOWN_AGE);
// An off-plan listing or a typo — treat as new, don't run off the bottom.
check("a build year in the future is treated as new", pct(2030), 0.004);

console.log("\nthe basis is always stated");
check("unknown age says so", /no build year/.test(maintenanceBasis(null, NOW)), true);
check("a new build says so", /new build|1-year-old/.test(maintenanceBasis(2025, NOW)), true);
check("never presented as a quote", /not a quote/.test(maintenanceBasis(1990, NOW)), true);

console.log(failures === 0 ? "\nMaintenance rules hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
