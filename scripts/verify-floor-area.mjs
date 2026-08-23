#!/usr/bin/env node
// Listing floor area vs the rating roll. Run: npm run verify:floor-area
//
// This decides whether a buyer is told to go and look harder at a house, so
// both mistakes cost something real. Flagging an honest listing sends someone
// to buy a LIM over a garage the council never counted; missing a genuine gap
// loses the one consent-adjacent check the app can honestly make.
//
// The wording matters as much as the threshold and is asserted here too: the
// app has never opened a council file, so this must never say "unconsented".
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { compareFloorArea, MATERIAL_PCT, MATERIAL_SQM } = await import(
  join(root, "lib/property/floor-area-check.ts")
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

const NOW = new Date("2026-08-24T00:00:00Z");
const status = (listingSqm, rollSqm, rollEffectiveDate = null) =>
  compareFloorArea({ listingSqm, rollSqm, rollEffectiveDate, now: NOW }).status;

console.log("\nWhen there is nothing to compare");
// The roll covers ~12% of NZ properties, so this is the common answer.
check("no roll figure", status(180, null), "unknown");
check("no listing figure", status(null, 180), "unknown");
check("neither", status(null, null), "unknown");
check("a zero is not a measurement", status(180, 0), "unknown");

console.log("\nRecords that agree — must NOT flag");
check("identical", status(180, 180), "consistent");
// A roll that leaves out a garage is the single most common benign gap.
check("a garage's worth on a big house", status(215, 180), "consistent");
check("just under both thresholds", status(204, 175), "consistent");
check("large pct but small house", status(58, 40), "consistent");

console.log("\nA gap worth explaining");
check("a room the roll doesn't know about", status(240, 180), "listing_larger");
check("a whole extra level", status(320, 160), "listing_larger");
check("exactly on both thresholds", status(150, 125), "listing_larger");

console.log("\nThe other direction");
check("rated bigger than advertised", status(150, 220), "listing_smaller");

console.log("\nThe numbers it reports");
const gap = compareFloorArea({ listingSqm: 240, rollSqm: 180, rollEffectiveDate: null, now: NOW });
check("difference in m²", gap.differenceSqm, 60);
check("difference as a percentage of the rated area", gap.differencePct, 33);

console.log("\nA stale rating assessment is said out loud");
const stale = compareFloorArea({
  listingSqm: 240,
  rollSqm: 180,
  rollEffectiveDate: "2019-07-01T00:00:00Z",
  now: NOW,
});
check("age is reported", stale.rollAgeYears, 7.1);
check("and mentioned in the note", /years old/.test(stale.note), true);
const fresh = compareFloorArea({
  listingSqm: 240,
  rollSqm: 180,
  rollEffectiveDate: "2026-01-01T00:00:00Z",
  now: NOW,
});
check("a recent assessment isn't excused", /years old/.test(fresh.note), false);

console.log("\nWhat it must never say");
// We have not seen a council file and cannot — councils don't publish consents.
for (const [label, c] of [
  ["a flagged gap", gap],
  ["a stale-roll gap", stale],
  ["records that agree", compareFloorArea({ listingSqm: 180, rollSqm: 180, now: NOW })],
]) {
  check(`${label} never says "unconsent"`, /unconsent/i.test(c.note ?? ""), false);
  check(`${label} never claims a council file was read`, /council record|property file was|we checked/i.test(c.note ?? ""), false);
}
check("a flagged gap names what would settle it", /LIM|property file/i.test(gap.note), true);

console.log("\nThresholds are what the module says they are");
check("percentage threshold", MATERIAL_PCT, 20);
check("absolute threshold", MATERIAL_SQM, 25);

if (failures) {
  console.error(`\n${failures} floor-area check(s) FAILED.\n`);
  process.exit(1);
}
console.log("\nAll floor-area checks passed.\n");
