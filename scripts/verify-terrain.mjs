#!/usr/bin/env node
// Topography measured from the elevation model. Run: npm run verify:terrain
//
// Surfaces with known slopes, including the 0.1 m rounding the real heights
// arrive in — the whole reason slope is a fitted plane and not a difference
// between neighbouring cells.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { measureTerrain, asRatio } = await import(join(root, "lib/scoring/site-slope.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
// A 20 × 30 m section on a 0.5 m grid, heights from f(x, y), rounded to 0.1 m.
const grid = (f, w = 20, l = 30, step = 0.5) => {
  const cols = w / step, rows = l / step, z = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) z.push(Math.round(f(c * step, r * step) * 10) / 10);
  return { step, cols, rows, z };
};

console.log("\nknown slopes, through the 0.1 m rounding");
const flat = measureTerrain(grid(() => 11.3));
check("dead flat is flat", flat.slopeBand, "flat");
check("…and all usable", flat.usablePct, 100);
const g3 = measureTerrain(grid((x, y) => 0.03 * y));
check("1:33 is flat", g3.slopeBand, "flat");
check("…measured close to 3%", Math.abs(g3.medianGradientPct - 3) < 0.6, true);
const g8 = measureTerrain(grid((x, y) => 0.08 * y));
check("1:12.5 is gentle", g8.slopeBand, "gentle");
check("…and still usable", g8.usablePct, 100);
const g15 = measureTerrain(grid((x, y) => 0.15 * x));
check("1:7 is moderate", g15.slopeBand, "moderate");
check("…and not usable without works", g15.usablePct, 0);
check("1:3 is steep", measureTerrain(grid((x, y) => 0.33 * y)).slopeBand, "steep");

console.log("\nsections with a bank");
// Flat for the front 20 m, then a 1:3 bank for the back 10 m.
const bank = measureTerrain(grid((x, y) => (y < 20 ? 5 : 5 + (y - 20) * 0.33)));
check("a flat front with a steep back bank is mostly flat", bank.slopeBand, "flat");
check("…and the bank isn't usable", bank.usablePct > 55 && bank.usablePct < 75, true);
check("…the fall is the bank's height", Math.abs(bank.fallM - 3.1) < 0.3, true);

console.log("\nonly the section counts");
const outside = grid((x, y) => 0.02 * y);
outside.z = outside.z.map((v, i) => (i % outside.cols < 10 ? v : null)); // half the grid is off-parcel
check("cells outside the boundary are ignored", measureTerrain(outside).slopeBand, "flat");
check("nothing inside, nothing claimed", measureTerrain({ step: 1, cols: 2, rows: 2, z: [null, null, null, null] }), null);

console.log("\nsaid the way a builder says it");
check("10% is 1:10", asRatio(10), "1:10");
check("0.3% reads as flat", asRatio(0.3), "flat");

console.log(failures === 0 ? "\nTerrain rules hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
