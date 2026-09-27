#!/usr/bin/env node
// The valuation's range, built from the property's own evidence.
// Run: npm run verify:valuation-range
//
// It used to be ±12% of everything. These pin down what the range must now
// respond to — and the one combination rule that is easy to get wrong: the
// building's parts share one cost basis, so their errors ADD; land and
// building do not move together, so those two combine as independent errors.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const R = await import(join(root, "lib/scoring/valuation-range.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};

const house = (over = {}) =>
  R.houseRange({
    total: 1_000_000,
    land: { valueNZD: 700_000, sampleSize: 16, suburb: "Remuera", ...(over.land ?? {}) },
    seenNZD: 200_000, shellNZD: 60_000, estimatedNZD: 40_000, extraNZD: 0,
    ...over, land: { valueNZD: 700_000, sampleSize: 16, suburb: "Remuera", ...(over.land ?? {}) },
  });

console.log("\nthe land rate is only as good as the sales behind it");
check("more sales, narrower land", R.landPct({ sampleSize: 40 }) < R.landPct({ sampleSize: 6 }), true);
check("a search widened past the suburb is wider", R.landPct({ sampleSize: 16, widened: true }) > R.landPct({ sampleSize: 16 }), true);
check("no recorded sample is treated as poorly evidenced", R.landPct({}) >= R.LAND_UNKNOWN_SAMPLE, true);
check("site facts nobody could measure widen it", R.landPct({ sampleSize: 16, unestablishedFacts: 3 }) > R.landPct({ sampleSize: 16 }), true);
check("however many sales, the sale-to-land step keeps it at 5% or more", R.landPct({ sampleSize: 10_000 }) >= R.LAND_MIN, true);
check("never wider than the ceiling", R.landPct({ sampleSize: 1, widened: true, unestablishedFacts: 4 }), R.LAND_MAX);

console.log("\nwhat was seen is firmer than what was estimated");
const r = house();
const pctOf = (k) => r.parts.find((p) => p.key === k).pct;
check("estimated components are wider than photographed ones", pctOf("estimated") > pctOf("seen"), true);
check("verified prices would narrow the building", R.houseRange({ total: 1e6, land: { valueNZD: 7e5, sampleSize: 16 }, seenNZD: 2e5, shellNZD: 6e4, estimatedNZD: 4e4, extraNZD: 0, pricesVerified: true }).plusMinusNZD < r.plusMinusNZD, true);

console.log("\nhow the parts combine");
const bld = r.parts.filter((p) => p.key !== "land").reduce((s, p) => s + p.plusMinusNZD, 0);
const lnd = r.parts.find((p) => p.key === "land").plusMinusNZD;
check("land and building combine as independent errors", r.plusMinusNZD, Math.round(Math.sqrt(lnd * lnd + bld * bld)));
check("…so the whole is less than the parts added up", r.plusMinusNZD < lnd + bld, true);
check("the range sits evenly around the value", [r.low + r.plusMinusNZD, r.high - r.plusMinusNZD], [1_000_000, 1_000_000]);
check("a cross-lease discount shrinks the range with the value", house({ total: 920_000, scale: 0.92 }).plusMinusNZD, Math.round(r.plusMinusNZD * 0.92));

console.log("\nit says what drives it");
check("the widest part leads", r.parts[0].key, "land");
check("the summary names it and why", /land rate comes from 16 recent sales in Remuera/.test(r.summary), true);
check("a part worth nothing isn't listed", r.parts.some((p) => p.key === "extra"), false);

console.log("\ncomparables alone (an apartment)");
const apt = R.comparablesRange({ total: 600_000, sampleSize: 16 });
check("wider than the same sales would make a land rate — no condition adjustment", apt.pct > R.landPct({ sampleSize: 16 }), true);

console.log(failures === 0 ? "\nValuation-range rules hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
