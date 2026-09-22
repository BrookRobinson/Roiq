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
  grantFor, priceFor, describeGrant, normalisePackage, includes, featuresOf,
  packageFor, mapAccessUntil, mapActive, daysRemaining, quotaFrom,
  quotaExhaustedMessage, isReportQuantity, perReport,
  PACKAGES, PACKAGE_PRICE_NZD, REPORT_QUANTITIES, REPORT_PRICE_NZD,
  MAP_VALUE_NZD, INSPECTION_VALUE_NZD, FEATURE_NEEDS, FREE_REPORTS, MAP_DAYS, reportsValue,
  NO_ENTITLEMENTS,
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

console.log("\nthe report curve — more must always cost less each");
let curveOk = true;
REPORT_QUANTITIES.forEach((n, i) => {
  if (i === 0) return;
  const prev = REPORT_QUANTITIES[i - 1];
  // Buying more must never cost less in total, and must always cost less each.
  if (REPORT_PRICE_NZD[n] <= REPORT_PRICE_NZD[prev]) curveOk = false;
  if (REPORT_PRICE_NZD[n] / n >= REPORT_PRICE_NZD[prev] / prev) curveOk = false;
});
check("total rises and unit price falls at every step", curveOk, true);
// The one that actually bites: a quantity that costs MORE in total than the
// next one up means somebody buying 25 is better off buying 50 and the
// dropdown is lying about value.
check("no quantity is dominated by a bigger one",
  REPORT_QUANTITIES.filter((n, i) =>
    REPORT_QUANTITIES.slice(i + 1).some((m) => REPORT_PRICE_NZD[m] <= REPORT_PRICE_NZD[n])), []);
check("every quantity clears the $1.45 cost several times over",
  REPORT_QUANTITIES.every((n) => REPORT_PRICE_NZD[n] / n > 1.45 * 1.5), true);
check("only the listed quantities are accepted",
  [isReportQuantity(10), isReportQuantity(7), isReportQuantity("10"), isReportQuantity(-1)],
  [true, false, false, false]);
check("per-report reads to the cent", perReport(50), "2.98");

console.log("\nwhat each package grants");
check("bronze grants exactly what was chosen", grantFor("bronze", 25),
  { reports: 25, map: false, inspections: 0 });
check("bronze never carries the map", PACKAGES.filter((p) => grantFor(p, 100).map), ["silver", "gold"]);
check("silver is 50 and the map", grantFor("silver"), { reports: 50, map: true, inspections: 0 });
check("gold is 75, the map and one inspection", grantFor("gold"),
  { reports: 75, map: true, inspections: 1 });
check("only gold sends an inspector",
  PACKAGES.filter((p) => grantFor(p, 100).inspections > 0), ["gold"]);
check("a bronze with no quantity doesn't grant a free 50", grantFor("bronze").reports, 1);

console.log("\nprices, and the working the cards show");
check("silver is its parts to the dollar",
  PACKAGE_PRICE_NZD.silver, REPORT_PRICE_NZD[50] + MAP_VALUE_NZD);
// Gold is a bundle, so it must be CHEAPER than its parts — a "bundle" that
// costs more than buying separately is the thing customers notice first.
// Priced off GOLD'S OWN report count, not Silver's. Using 50 here made Gold
// cost $1 more than its parts and the card said so in print.
check("gold is cheaper than buying its parts",
  PACKAGE_PRICE_NZD.gold <
    reportsValue(grantFor("gold").reports) + MAP_VALUE_NZD + INSPECTION_VALUE_NZD, true);
// The middle of the table IS the curve, to within a dollar. The two ends are
// deliberately above it: $19 for a single report protects the free taster and
// that buyer is the least price-sensitive there is, and 100 keeps a sane margin
// at volume. Above is fine; BELOW would mean the published price undercuts the
// curve every bundle is valued against, and Gold's "bought separately" line
// would be overstating what it saves you.
check("the curve reproduces the middle of the table",
  [3, 5, 10, 25, 50].filter((n) => Math.abs(reportsValue(n) - REPORT_PRICE_NZD[n]) > 1), []);
// Gold's card says what its 75 reports are worth, and 75 is not on sale. The
// figure has to be one nobody can beat by shopping — if reportsValue(75) came
// out ABOVE what you could actually pay for 75 reports, the card would be
// inflating the saving, which is the one direction that matters. (It is well
// under: the cheapest published route to 75 is the 100 pack.)
const cheapestPublished = (n) => {
  const single = REPORT_QUANTITIES.filter((q) => q >= n).map((q) => REPORT_PRICE_NZD[q]);
  return single.length ? Math.min(...single) : Infinity;
};
check("a bundle never claims its reports are worth more than you could pay",
  reportsValue(grantFor("gold").reports) <= cheapestPublished(grantFor("gold").reports), true);
check("…nor Silver's, which is an on-sale quantity and must match it exactly",
  reportsValue(grantFor("silver").reports), REPORT_PRICE_NZD[50]);
check("gold still covers the worst inspection it promises",
  PACKAGE_PRICE_NZD.gold - MAP_VALUE_NZD - 75 * 1.45 > 900, true);
check("packages get dearer as they grow",
  PACKAGE_PRICE_NZD.gold > PACKAGE_PRICE_NZD.silver, true);
check("bronze's cheapest is the cheapest thing on sale",
  REPORT_PRICE_NZD[1] < PACKAGE_PRICE_NZD.silver, true);

console.log("\ndescribeGrant — what the receipt and the checkout say");
check("one report is singular", describeGrant({ reports: 1, map: false, inspections: 0 }), "1 report");
check("reports and the map", describeGrant(grantFor("silver")), "50 reports and the map");
check("all three are listed", describeGrant(grantFor("gold")),
  "75 reports, the map and a building inspection");

console.log("\nfeature gates");
const FREE = NO_ENTITLEMENTS;
const PAID = { ...NO_ENTITLEMENTS, paid: true };
const MAPPED = { ...NO_ENTITLEMENTS, paid: true, map: true };
check("free sees no score", includes(FREE, "score"), false);
check("any purchase unblurs the score", includes(PAID, "score"), true);
check("…and the agent document, which the inspection gate then holds",
  includes(PAID, "negotiation"), true);
check("the map needs the map, not just a purchase",
  [includes(PAID, "map"), includes(MAPPED, "map")], [false, true]);
check("so does opening somebody else's report",
  [includes(PAID, "mapReports"), includes(MAPPED, "mapReports")], [false, true]);
// Credits running out must NOT revoke what was already read. Somebody who
// bought ten reports and used all ten still paid to see their scores.
check("spent credits don't re-blur the reports already paid for",
  includes({ ...NO_ENTITLEMENTS, paid: true, credits: 0 }, "score"), true);
check("bronze carries everything except the map",
  featuresOf("bronze"),
  Object.keys(FEATURE_NEEDS).filter((f) => FEATURE_NEEDS[f] !== "map"));
check("silver carries the lot", featuresOf("silver").length, Object.keys(FEATURE_NEEDS).length);
check("the map is sold from silver up", packageFor("map"), "silver");
check("a report feature is sold from bronze up", packageFor("score"), "bronze");

console.log("\nthe retired names still resolve — nobody loses what they bought");
check("starter → bronze", normalisePackage("starter"), "bronze");
check("copper → bronze", normalisePackage("copper"), "bronze");
// These three had the map. They must land somewhere that still has it, or the
// rename quietly takes it off accounts that pre-date the packages.
check("everything that had the map keeps it",
  ["pro", "platinum", "diamond"].every((p) => featuresOf(normalisePackage(p)).includes("map")), true);
check("diamond → gold, so its inspection isn't lost", normalisePackage("diamond"), "gold");
check("a current name is left alone", normalisePackage("silver"), "silver");
check("nonsense is null, never a package", normalisePackage("enterprise"), null);

console.log(`\nmap access — rented, ${MAP_DAYS} days, and buying early must add days`);
check("a first purchase runs the full term", iso(mapAccessUntil(null, NOW)), iso(plus(MAP_DAYS)));
check("buying with 10 days left extends to 40", iso(mapAccessUntil(iso(plus(10)), NOW)), iso(plus(10 + MAP_DAYS)));
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
