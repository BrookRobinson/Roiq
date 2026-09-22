#!/usr/bin/env node
// Allowance-rule check. Run: npm run verify:allowance
//
// These rules decide when someone is refused work they may have expected. Too
// strict and a paying customer is blocked; too loose and the free tier is an
// open tab at our expense. Both fail quietly, so they're checked here.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const {
  PLAN_ALLOWANCE, describeAllowance, allowanceWindowStart, allowanceResetsAt,
  quotaFrom, quotaExhaustedMessage, PLAN_PRICE_NZD,
} = await import(join(root, "lib/billing/plans.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};

const NOW = new Date("2026-08-22T10:00:00Z");

console.log("\nallowances");
check("free is one report, ever", PLAN_ALLOWANCE.free, { reports: 1, period: "lifetime" });
check("copper is 3 a month", PLAN_ALLOWANCE.copper, { reports: 3, period: "month" });
check("bronze is 10 a month", PLAN_ALLOWANCE.bronze, { reports: 10, period: "month" });
check("silver is 25 a month", PLAN_ALLOWANCE.silver, { reports: 25, period: "month" });
check("gold is 50 a month", PLAN_ALLOWANCE.gold, { reports: 50, period: "month" });
// Deliberate, and the one thing about this ladder that looks like a mistake:
// above Gold you are not buying more searching.
check("platinum matches gold", PLAN_ALLOWANCE.platinum.reports, PLAN_ALLOWANCE.gold.reports);
check("diamond matches gold", PLAN_ALLOWANCE.diamond.reports, PLAN_ALLOWANCE.gold.reports);
check("free reads as singular", describeAllowance("free"), "1 report");
check("copper names the period", describeAllowance("copper"), "3 reports a month");

console.log("\ncounting window");
check("free counts everything, ever", allowanceWindowStart("free", NOW), null);
check("paid counts from the 1st", allowanceWindowStart("gold", NOW)?.toISOString(), "2026-08-01T00:00:00.000Z");
check("free never resets", allowanceResetsAt("free", NOW), null);
check("paid resets next month", allowanceResetsAt("bronze", NOW)?.toISOString(), "2026-09-01T00:00:00.000Z");
check("December rolls to January", allowanceResetsAt("diamond", new Date("2026-12-14T00:00:00Z"))?.toISOString(), "2027-01-01T00:00:00.000Z");

console.log("\nremaining");
check("a fresh free account has one", quotaFrom("free", 0, NOW).remaining, 1);
check("after one, free is empty", quotaFrom("free", 1, NOW).remaining, 0);
check("remaining never goes negative", quotaFrom("free", 7, NOW).remaining, 0);
check("bronze at 3 used has 7", quotaFrom("bronze", 3, NOW).remaining, 7);
check("gold at 50 used has none", quotaFrom("gold", 50, NOW).remaining, 0);

console.log("\nwhat the wall says");
check("free is told what upgrading buys and what it costs",
  new RegExp(`Copper is 3 reports a month for \\$${PLAN_PRICE_NZD.copper}`)
    .test(quotaExhaustedMessage(quotaFrom("free", 1, NOW))), true);
check("paid is told when it refills",
  /refills on 1 September/.test(quotaExhaustedMessage(quotaFrom("bronze", 10, NOW))), true);
check("bronze is pointed at the next tier with MORE reports",
  /Silver takes it to 25/.test(quotaExhaustedMessage(quotaFrom("bronze", 10, NOW))), true);
// Platinum and Diamond carry the same 50 as Gold, so there is nothing to sell
// someone who has run out on Gold. Offering an upgrade here would be a lie.
check("gold is not upsold a tier with the same allowance",
  /takes it to/.test(quotaExhaustedMessage(quotaFrom("gold", 50, NOW))), false);
check("diamond isn't upsold to itself",
  /takes it to/.test(quotaExhaustedMessage(quotaFrom("diamond", 50, NOW))), false);

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll allowance checks passed.\n");
process.exit(failures ? 1 : 0);
