#!/usr/bin/env node
// The map's valuation rules. Run: npm run verify:map-valuation
//
// Both rules here are silent when they break, and both break the same way: by
// putting a verdict on somebody's house that we did not earn.
//
// A valuation needs a suburb $/m² from recent sales AND a floor area. Neither
// is guaranteed — a bare section has no floor area, and thin suburbs return no
// sales to median. When that happened, the valuation used to fall back to the
// ASKING PRICE, which is not a fallback: it is the vendor's number handed back
// as ours. The gap came out at 0%, the pin coloured orange, and the sheet said
// "Fair price — close to Tectara's estimated value" about a property we had
// never valued. Rows written in that era are still in the table.
//
// So: no valuation must mean NO percentage and NO colour, never a zero. And a
// missing valuation must not touch investor mode, which is built from the
// asking price, the repairs and the rent and never needed one.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Teach node what TypeScript already knows: the tsconfig "@/…" alias, and
// imports written without a file extension. Node resolves ESM by exact path and
// does neither, which is why verify scripts have so far only been able to load
// the dependency-free modules. With this, any lib module is testable.
const resolveFile = (base) =>
  [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((p) => existsSync(p) && !p.endsWith("/"));

registerHooks({
  resolve(specifier, context, next) {
    let base = null;
    if (specifier.startsWith("@/")) base = join(root, specifier.slice(2));
    else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:"))
      base = join(dirname(fileURLToPath(context.parentURL)), specifier);
    const target = base && resolveFile(base);
    return target ? { url: pathToFileURL(target).href, shortCircuit: true } : next(specifier, context);
  },
});
const { computeListing, realValuation, valuationForScore } = await import(join(root, "lib/map/calc.ts"));
const { isScorable } = await import(join(root, "lib/scoring/investment.ts"));
const { DEFAULT_VARIABLES } = await import(join(root, "lib/map/variables.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    console.log("  ✓ " + label);
  } else {
    console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
    failures++;
  }
};

/** A listing with only the fields the calculation reads. */
const listing = (over = {}) => ({
  id: "t", address: "", suburb: null, city: null, region: null, lat: 0, lng: 0,
  askingPrice: 800_000, bedrooms: 3, bathrooms: 1, propertyType: "house",
  floorAreaSqm: 140, landAreaSqm: 500, photos: [], listingType: null,
  roiqScore: 650, roiqValuation: 900_000, medianPerSqm: 6_000,
  repairAllowance: 10_000, repairBreakdown: {}, estimatedWeeklyRent: 620,
  suburbGrowthRatePct: 4, listingUrl: null, fullReportId: null,
  status: "active", analysed: true, ...over,
});

const hb = (over) => computeListing(listing(over), DEFAULT_VARIABLES, "homebuyer");
const inv = (over) => computeListing(listing(over), DEFAULT_VARIABLES, "investor");

// ── 1. What counts as a valuation at all ────────────────────────────────
console.log("\nrealValuation — what the table is allowed to call a valuation");
check("a figure of our own stands", realValuation(900_000, 800_000), 900_000);
check("null stays null", realValuation(null, 800_000), null);
// The legacy fallback: a row whose "valuation" is the asking price to the dollar.
check("asking price echoed back is not a valuation", realValuation(800_000, 800_000), null);
check("no asking price to compare against, figure stands", realValuation(900_000, null), 900_000);
check("a dollar off the asking price is a real one", realValuation(800_001, 800_000), 800_001);

// ── 1b. A valuation is only as good as the score under it ───────────────
// Every valuation is median × qualityMultiplier(score) × floor area, so one
// built on a score that assessed nothing has no foundation. 244 Upper Kokatahi
// Road scored zero — nothing in it could be assessed — and $242,028 was written
// against a $699,000 asking price. Refusing only on the write path would leave
// that figure sitting on the map forever.
// 244 Upper Kokatahi Road: 27 photos read, 62 sub-items produced, every one
// unassessable, byCategory empty, total 0. The house is fine; the analysis of
// it isn't, and a zero must never be read as a grade.
console.log("\nisScorable — zero means we assessed nothing, not that it's worthless");
check("a real score", isScorable(650), true);
check("the lowest real score there is", isScorable(1), true);
check("zero is not a score", isScorable(0), false);
check("null", isScorable(null), false);
check("undefined", isScorable(undefined), false);
check("NaN", isScorable(NaN), false);
check("a negative is not a score", isScorable(-10), false);

console.log("\nvaluationForScore — no score, no valuation, on the way out too");
check("a real score keeps its valuation", valuationForScore(900_000, 800_000, 650), 900_000);
check("score 0 withholds it", valuationForScore(242_028, 699_000, 0), null);
check("no score at all withholds it", valuationForScore(900_000, 800_000, null), null);
// Both refusals still apply together.
check("asking-price echo is still withheld even with a good score",
  valuationForScore(800_000, 800_000, 650), null);

// ── 2. No valuation → no verdict, never a zero ──────────────────────────
console.log("\nhomebuyer mode — a missing valuation is not a fair price");
check("no valuation: no gap", hb({ roiqValuation: null }).valuationGapPct, null);
check("no valuation: no marker %", hb({ roiqValuation: null }).pct, null);
check("no valuation: no deal colour", hb({ roiqValuation: null }).colour, "unvalued");
check("no valuation: no figure to show", hb({ roiqValuation: null }).roiqValuation, null);
// A section: no floor area is exactly how a listing ends up unvalued.
check(
  "a bare section reads unvalued, not orange",
  hb({ roiqValuation: null, floorAreaSqm: null, bedrooms: null }).colour,
  "unvalued"
);
// Price by negotiation / auction with no figure — nothing to compare against.
check("no asking price: no verdict", hb({ askingPrice: 0 }).colour, "unvalued");

// ── 3. With a valuation, the bands are unchanged ────────────────────────
console.log("\nhomebuyer mode — the ±15% bands");
check("valued 12.5% over asking is green", Math.round(hb({ roiqValuation: 900_000 }).pct), 13);
check("…and green needs more than 15%", hb({ roiqValuation: 900_000 }).colour, "orange");
check("+25% is green", hb({ roiqValuation: 1_000_000 }).colour, "green");
check("−25% is red", hb({ roiqValuation: 600_000 }).colour, "red");
check("exactly on asking is orange, not unvalued", hb({ roiqValuation: 800_001 }).colour, "orange");

// ── 4. Investor mode never needed a valuation ───────────────────────────
console.log("\ninvestor mode — untouched by a missing valuation");
const withVal = inv({});
const without = inv({ roiqValuation: null });
check("same net profit", without.netProfit, withVal.netProfit);
check("same colour", without.colour, withVal.colour);
check("same marker %", without.pct, withVal.pct);
check("still a real verdict", ["green", "orange", "red"].includes(without.colour), true);

console.log(
  failures === 0
    ? "\nAll map valuation rules hold.\n"
    : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`
);
process.exit(failures === 0 ? 0 : 1);
