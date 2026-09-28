#!/usr/bin/env node
// Billing maths integrity check. Run: npm run verify:billing
//
// There are no tests in this repo, and mostly that's fine. This file is the
// exception, for the same reason lib/scoring deserves one: these functions are
// pure, and a wrong answer here either hands someone reports they didn't pay
// for or takes away ones they did. Both are silent — a number is just wrong —
// so the only way to notice is to check.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const {
  grantFor, orderPrice, isOrder, planKey, planLabel, describeGrant, includes, unlockFor,
  mapAccessUntil, mapActive, daysRemaining, quotaFrom, quotaExhaustedMessage,
  isReportQuantity, perReport, REPORT_QUANTITIES, REPORT_PRICE_NZD, MAP_PRICE_NZD,
  FEATURE_NEEDS, FREE_REPORTS, MAP_DAYS, NO_ENTITLEMENTS,
} = await import(join(root, "lib/billing/plans.ts"));

const NOW = new Date("2026-09-22T10:00:00Z");
const iso = (d) => d.toISOString();
const plus = (days) => new Date(NOW.getTime() + days * 86_400_000);

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    console.log("  ✓ " + label);
  } else {
    console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
    failures++;
  }
};

console.log("\nthe report prices — $29 for one, down to $10 each at 20");
check("the price table", REPORT_QUANTITIES.map((n) => [n, REPORT_PRICE_NZD[n]]),
  [[1, 29], [3, 69], [5, 95], [10, 150], [20, 200]]);
let cheaper = true;
for (let i = 1; i < REPORT_QUANTITIES.length; i++) {
  const [a, b] = [REPORT_QUANTITIES[i - 1], REPORT_QUANTITIES[i]];
  if (REPORT_PRICE_NZD[b] / b >= REPORT_PRICE_NZD[a] / a) cheaper = false;
  if (REPORT_PRICE_NZD[b] <= REPORT_PRICE_NZD[a]) cheaper = false;
}
check("more always costs more in total and less each", cheaper, true);
check("20 is $10 each", perReport(20), "10");
check("3 is $23 each", perReport(3), "23");
check("only offered quantities are orders", [isReportQuantity(20), isReportQuantity(50), isReportQuantity(0)], [true, false, false]);

console.log("\norders — reports, the map, or both");
check("reports alone", [orderPrice({ reports: 10, map: false }), grantFor({ reports: 10, map: false })],
  [150, { reports: 10, map: false, inspections: 0 }]);
check("the map alone is $249", [orderPrice({ reports: 0, map: true }), grantFor({ reports: 0, map: true })],
  [249, { reports: 0, map: true, inspections: 0 }]);
check("both add up to the dollar", orderPrice({ reports: 20, map: true }), REPORT_PRICE_NZD[20] + MAP_PRICE_NZD);
check("nothing at all is not an order", isOrder({ reports: 0, map: false }), false);
check("an unoffered quantity is not an order", isOrder({ reports: 7, map: false }), false);
check("a missing map flag is not an order", isOrder({ reports: 5 }), false);
check("the stored plan names what was bought",
  [planKey({ reports: 10, map: false }), planKey({ reports: 0, map: true }), planKey({ reports: 3, map: true })],
  ["reports-10", "map", "reports-3+map"]);
check("and reads back", [planLabel("reports-10+map"), planLabel("map"), planLabel("reports-1")],
  ["10 reports + Map", "Map", "1 report"]);

console.log("\ndescribeGrant — what the receipt and the checkout say");
check("one report is singular", describeGrant({ reports: 1, map: false, inspections: 0 }), "1 report");
check("reports and the map", describeGrant(grantFor({ reports: 10, map: true })), "10 reports and the map for 12 months");
check("the map alone", describeGrant(grantFor({ reports: 0, map: true })), "the map for 12 months");
check("a legacy inspection is still named", describeGrant({ reports: 75, map: true, inspections: 1 }),
  "75 reports, the map for 12 months and a building inspection");

console.log("\nfeature gates");
const FREE = NO_ENTITLEMENTS;
const PAID = { ...NO_ENTITLEMENTS, paid: true };
const MAPPED = { ...NO_ENTITLEMENTS, paid: true, map: true };
check("free sees no score", includes(FREE, "score"), false);
check("any purchase unblurs the score", includes(PAID, "score"), true);
check("…and every other thing a report contains",
  Object.keys(FEATURE_NEEDS).filter((f) => FEATURE_NEEDS[f] !== "map" && !includes(PAID, f)), []);
check("the map needs the map, not just a purchase",
  [includes(PAID, "map"), includes(MAPPED, "map")], [false, true]);
check("so does opening somebody else's report",
  [includes(PAID, "mapReports"), includes(MAPPED, "mapReports")], [false, true]);
// Credits running out must NOT revoke what was already read. Somebody who
// bought ten reports and used all ten still paid to see their scores.
check("spent credits don't re-blur the reports already paid for",
  includes({ ...NO_ENTITLEMENTS, paid: true, credits: 0 }, "score"), true);
check("a report feature is unlocked by any report, from $29", unlockFor("score").price, 29);
check("the map is unlocked by the map, $249", [unlockFor("map").price, unlockFor("mapReports").order], [249, { reports: 0, map: true }]);

console.log("\npurchases from before still read under their names");
check("old names still display", ["bronze", "silver", "gold", "diamond"].map(planLabel), ["Bronze", "Silver", "Gold", "Diamond"]);

console.log(`\nmap access — rented, ${MAP_DAYS} days (12 months), and buying early must add days`);
check("the map runs a year", MAP_DAYS, 365);
check("a first purchase runs the full term", iso(mapAccessUntil(null, NOW)), iso(plus(MAP_DAYS)));
check("buying with 10 days left adds a full term", iso(mapAccessUntil(iso(plus(10)), NOW)), iso(plus(10 + MAP_DAYS)));
check("buying after a lapse starts fresh", iso(mapAccessUntil(iso(plus(-3)), NOW)), iso(plus(MAP_DAYS)));
check("a future date is active", mapActive(iso(plus(1)), NOW), true);
check("today's expiry is over", mapActive(iso(NOW), NOW), false);
check("no date fails closed", mapActive(null, NOW), false);
check("an unparseable date fails closed", mapActive("not-a-date", NOW), false);
check("a part day rounds up", daysRemaining(new Date(NOW.getTime() + 6.5 * 86_400_000), NOW), 7);
check("a past date floors at zero", daysRemaining(iso(plus(-2)), NOW), 0);

console.log("\ncredits — owned, so they never expire");
check("the free report is granted on top of nothing bought",
  quotaFrom(0, 0, false).remaining, FREE_REPORTS);
check("ten bought plus the free one is eleven", quotaFrom(10, 0, true).granted, 11);
check("spending counts down", quotaFrom(10, 4, true).remaining, 7);
check("remaining never goes negative", quotaFrom(1, 9, true).remaining, 0);

console.log("\nwhat the wall says");
check("somebody who never paid is told the one-report price",
  quotaExhaustedMessage(quotaFrom(0, 1, false)).includes(`$${REPORT_PRICE_NZD[1]}`), true);
// There is no "wait until it refills" any more — credits don't expire, so the
// only honest answer is a price.
check("nobody is told to wait for a refill",
  /refill|resets|next month/i.test(quotaExhaustedMessage(quotaFrom(10, 11, true))), false);
check("a paying customer is told buying adds rather than replaces",
  /don't expire/.test(quotaExhaustedMessage(quotaFrom(10, 11, true))), true);

if (failures) {
  console.error(`\n${failures} check(s) failed.\n`);
  process.exit(1);
}
console.log("\nAll billing checks passed.\n");
