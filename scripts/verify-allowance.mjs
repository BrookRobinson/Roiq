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
  quotaFrom, quotaExhaustedMessage,
} = await import(join(root, "lib/billing/plans.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};

const NOW = new Date("2026-08-22T10:00:00Z");

console.log("\nallowances");
check("free is one report, ever", PLAN_ALLOWANCE.free, { reports: 1, period: "lifetime" });
check("starter is 10 a month", PLAN_ALLOWANCE.starter, { reports: 10, period: "month" });
check("pro is 20 a month", PLAN_ALLOWANCE.pro, { reports: 20, period: "month" });
check("free reads as singular", describeAllowance("free"), "1 report");
check("starter names the period", describeAllowance("starter"), "10 reports a month");

console.log("\ncounting window");
check("free counts everything, ever", allowanceWindowStart("free", NOW), null);
check("paid counts from the 1st", allowanceWindowStart("pro", NOW)?.toISOString(), "2026-08-01T00:00:00.000Z");
check("free never resets", allowanceResetsAt("free", NOW), null);
check("paid resets next month", allowanceResetsAt("starter", NOW)?.toISOString(), "2026-09-01T00:00:00.000Z");
check("December rolls to January", allowanceResetsAt("pro", new Date("2026-12-14T00:00:00Z"))?.toISOString(), "2027-01-01T00:00:00.000Z");

console.log("\nremaining");
check("a fresh free account has one", quotaFrom("free", 0, NOW).remaining, 1);
check("after one, free is empty", quotaFrom("free", 1, NOW).remaining, 0);
check("remaining never goes negative", quotaFrom("free", 7, NOW).remaining, 0);
check("starter at 3 used has 7", quotaFrom("starter", 3, NOW).remaining, 7);
check("pro at 20 used has none", quotaFrom("pro", 20, NOW).remaining, 0);

console.log("\nwhat the wall says");
check("free is told what upgrading buys",
  /Upgrade to Starter/.test(quotaExhaustedMessage(quotaFrom("free", 1, NOW))), true);
check("paid is told when it refills",
  /refills on 1 September/.test(quotaExhaustedMessage(quotaFrom("starter", 10, NOW))), true);
check("starter is pointed at Pro",
  /Pro doubles it to 20/.test(quotaExhaustedMessage(quotaFrom("starter", 10, NOW))), true);
check("pro isn't upsold to itself",
  /Pro doubles/.test(quotaExhaustedMessage(quotaFrom("pro", 20, NOW))), false);

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll allowance checks passed.\n");
process.exit(failures ? 1 : 0);
