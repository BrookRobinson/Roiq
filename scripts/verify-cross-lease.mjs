#!/usr/bin/env node
// The cross-lease discount. Run: npm run verify:cross-lease
//
// A cross lease used to be valued like an apartment — floor area × suburb $/m²,
// with NO condition multiplier — so a cross-lease house scoring 250/1000 and one
// scoring 850/1000 came out at the same number. It is a house: it sits on the
// ground, it wears out like a house, and it sells like a house at a discount.
//
// This file guards the discount, and the thing it mostly guards is the BAND.
// 5–10% is what Trade Me Property and the Property Institute measured against
// equivalent freehold; anything outside it is a number nobody chose. The
// entanglement factors move the figure INSIDE that band and may never leave it.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// The other verifiers load dependency-free modules and need none of this.
// `valueProperty` is the opposite — it is the top of the valuation graph, and
// testing the discount without it would test the arithmetic and not the thing
// that actually reaches a reader. So teach the loader the two conventions the
// app's own bundler already knows: extensionless relative imports, and `@/`.
registerHooks({
  resolve(spec, ctx, next) {
    const from = ctx.parentURL ? dirname(fileURLToPath(ctx.parentURL)) : root;
    let target = null;
    if (spec.startsWith("@/")) target = join(root, spec.slice(2));
    else if (spec.startsWith(".")) target = join(from, spec);
    if (target && !/\.[a-z]+$/i.test(target)) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(target + ext)) {
          return { url: pathToFileURL(target + ext).href, shortCircuit: true };
        }
      }
    }
    if (target && existsSync(target)) {
      return { url: pathToFileURL(target).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});
const { crossLeaseDiscount, explainCrossLeaseDiscount, MIN_DISCOUNT_PCT, MAX_DISCOUNT_PCT } =
  await import(join(root, "lib/scoring/cross-lease.ts"));
const { valueProperty } = await import(join(root, "lib/scoring/property-value.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const ok = (label, cond) => check(label, !!cond, true);

console.log("\nthe band is held, whatever is observed");
// Every combination of every factor, at every plausible flat count. Not one of
// them may produce a figure the published research doesn't support.
const FIELDS = ["separateDriveway", "detached", "exclusiveYard", "sharedStructures", "rearFlat"];
let worst = 0, best = 100, combos = 0;
for (let n = 2; n <= 12; n++) {
  // 3^5 = 243 tri-states per flat count.
  for (let mask = 0; mask < 3 ** FIELDS.length; mask++) {
    const sharing = {};
    let m = mask;
    for (const f of FIELDS) {
      const v = m % 3; m = Math.floor(m / 3);
      if (v === 1) sharing[f] = true;
      if (v === 2) sharing[f] = false;
    }
    const d = crossLeaseDiscount(n, sharing);
    worst = Math.max(worst, d.pct);
    best = Math.min(best, d.pct);
    combos++;
    if (d.pct < MIN_DISCOUNT_PCT || d.pct > MAX_DISCOUNT_PCT) {
      console.error(`  ✗ ${n} flats ${JSON.stringify(sharing)} → ${d.pct}%`);
      failures++;
      mask = 3 ** FIELDS.length; n = 99;
    }
  }
}
ok(`${combos} combinations all inside ${MIN_DISCOUNT_PCT}–${MAX_DISCOUNT_PCT}%`, failures === 0);
check("the best case reaches the floor", best, MIN_DISCOUNT_PCT);
check("the worst case reaches the cap", worst, MAX_DISCOUNT_PCT);

console.log("\nmore owners, more discount — the research finding");
const bare = (n) => crossLeaseDiscount(n).pct;
ok("two flats discount less than three", bare(2) < bare(3));
ok("three less than four", bare(3) < bare(4));
ok("it stops at the cap rather than running away", bare(20) === MAX_DISCOUNT_PCT);
check("a two-flat pair sits at the bottom of the band", bare(2), 6);

console.log("\nseparate driveways beat a shared one — the whole point");
const shared = crossLeaseDiscount(2, { separateDriveway: false });
const own = crossLeaseDiscount(2, { separateDriveway: true });
ok("a shared right-of-way costs more than its own driveway", shared.pct > own.pct);
// Two flats side by side, each self-contained, is the best a cross lease gets.
check("the most separate two-flat arrangement", crossLeaseDiscount(2, {
  separateDriveway: true, detached: true, exclusiveYard: true,
}).pct, MIN_DISCOUNT_PCT);
// The rear flat up a shared drive, sharing a garage block, is the worst.
ok("the most entangled arrangement is worse", crossLeaseDiscount(2, {
  separateDriveway: false, detached: false, exclusiveYard: false,
  sharedStructures: true, rearFlat: true,
}).pct > crossLeaseDiscount(2, { separateDriveway: true, detached: true, exclusiveYard: true }).pct);

console.log("\nUNOBSERVED IS NOT SHARED — a driveway nobody photographed");
// The rule that stops the discount being a guess. An absent observation must
// score exactly nothing, the same way a Tier 3 improvement does.
check("nothing observed sits at the co-owner base", crossLeaseDiscount(3).pct, crossLeaseDiscount(3, {}).pct);
check("undefined is not false", crossLeaseDiscount(2, { separateDriveway: undefined }).pct, crossLeaseDiscount(2).pct);
ok("and it says so", crossLeaseDiscount(2).unobserved);
ok("one observation is enough to stop being unobserved", !crossLeaseDiscount(2, { detached: true }).unobserved);

console.log("\nthe reader is told what it cost them and why");
const explained = explainCrossLeaseDiscount(crossLeaseDiscount(2, { separateDriveway: false }));
ok("names the tenure", /cross lease/i.test(explained));
ok("states the percentage", /%/.test(explained));
ok("names how many flats share the title", /two flats/.test(explained));
ok("names what pushed it up", /driveway|right-of-way/i.test(explained));
ok("an unobserved one admits it", /didn't show/.test(explainCrossLeaseDiscount(crossLeaseDiscount(2))));

console.log("\nend to end — the land is divided BEFORE the discount");
const subItems = [
  { id: "ext_roof", score: 8, specTier: "modern" },
  { id: "ext_cladding", score: 8, specTier: "modern" },
  { id: "kit_cabinetry", score: 7, specTier: "modern" },
  { id: "bath_shower", score: 7, specTier: "modern" },
  { id: "liv_flooring", score: 7, specTier: "modern" },
];
const suburbValue = {
  medianPerSqm: 5200, sampleSize: 18, medianSalePrice: 780000, medianFloorArea: 150,
  propertyType: "house", suburb: "Somewhere", source: "test", retrieved: "August 2026",
};
const base = { subItems, floorAreaSqm: 150, bathrooms: 1, suburbValue, propertyType: "house" };

// The freehold reference: a 600m² section of its own.
const freehold = valueProperty({ ...base, landAreaSqm: 600, titleType: "freehold" });
// The same house, cross lease, holding half of a 1,200m² shared site — which is
// the same 600m² of land. Everything else identical.
const xlease = valueProperty({
  ...base, landAreaSqm: 1200, titleType: "cross_lease", landShareFraction: 0.5,
});

ok("both are valued at all", freehold && xlease);
check("the cross lease is valued as a house, not an apartment", xlease.method, "land-and-building");
check("its land is the half it actually holds", xlease.landAreaValuedSqm, 600);
check("so the gross land value matches the freehold's", xlease.landValue, freehold.landValue);
check("and the building is identical — condition is priced again", xlease.mainBuildingValue, freehold.mainBuildingValue);
ok("but the total is lower, because the tenure costs something", xlease.total < freehold.total);
check("by exactly the discount", xlease.total, Math.round(freehold.total * (1 - xlease.crossLease.pct / 100)));

console.log("\nthe parts are gross, and the deduction is its own line");
// Scaling land and improvements down instead would leave the breakdown adding
// up perfectly while never telling the reader the tenure took anything.
ok("land + improvements exceed the total", xlease.landValue + xlease.buildingValue > xlease.total);
check("by exactly the stated deduction",
  xlease.landValue + xlease.buildingValue - xlease.total, xlease.crossLease.deduction);

console.log("\nCONDITION MOVES THE NUMBER AGAIN — the bug this fixes");
// The whole reason for the change. Under the old apartment routing these two
// returned the identical figure.
const tired = valueProperty({
  ...base,
  subItems: subItems.map((s) => ({ ...s, score: 3, specTier: "deteriorated" })),
  landAreaSqm: 1200, titleType: "cross_lease", landShareFraction: 0.5,
});
ok("a tired cross lease is worth less than a smart one", tired.total < xlease.total);

console.log("\nwithout a share we do not guess one");
// The published land area is the WHOLE site. Valuing it as a house without
// dividing it would hand this flat the neighbour's land as well, so the old
// method stands rather than a made-up fraction.
const noShare = valueProperty({ ...base, landAreaSqm: 1200, titleType: "cross_lease" });
check("it falls back rather than inventing a fraction", noShare?.method, "floor-area-comparables");
ok("and carries no discount, having applied no share", !noShare?.crossLease);

console.log("\na freehold is untouched by any of this");
ok("no cross-lease block on a freehold", !freehold.crossLease);
check("its land is its whole section", freehold.landAreaValuedSqm, undefined);

console.log(failures === 0 ? "\nThe cross-lease discount holds.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
