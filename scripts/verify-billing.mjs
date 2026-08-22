#!/usr/bin/env node
// Billing maths integrity check. Run: npm run verify:billing
//
// There are no tests in this repo, and mostly that's fine. This file is the
// exception, for the same reason lib/scoring deserves one: these functions are
// pure, and a wrong answer here either hands someone Pro they didn't pay for or
// takes away a month they did. Both are silent — nothing throws, a date is just
// off — so the only way to notice is to check.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { accessUntil, daysRemaining, effectivePlan, planMeets, ACCESS_DAYS } = await import(
  join(root, "lib/billing/plans.ts")
);

const NOW = new Date("2026-08-22T10:00:00Z");
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

console.log("\neffectivePlan — access is the plan AND an unexpired date");
check("pro with time left is pro", effectivePlan("pro", iso(plus(5)), NOW), "pro");
check("pro that ran out is free", effectivePlan("pro", iso(plus(-1)), NOW), "free");
check("pro with no expiry fails closed", effectivePlan("pro", null, NOW), "free");
check("an unparseable expiry fails closed", effectivePlan("pro", "not-a-date", NOW), "free");
check("an expiry can't upgrade a free plan", effectivePlan("free", iso(plus(5)), NOW), "free");
check("an unknown plan name is free", effectivePlan("enterprise", iso(plus(5)), NOW), "free");
check("expiring exactly now is over", effectivePlan("pro", iso(NOW), NOW), "free");
check("starter with time left is starter", effectivePlan("starter", iso(plus(1)), NOW), "starter");

console.log("\naccessUntil — buying early must add days, never discard them");
check(`a first purchase runs ${ACCESS_DAYS} days`, iso(accessUntil(null, NOW)), iso(plus(ACCESS_DAYS)));
check("buying with 10 days left extends to 40", iso(accessUntil(iso(plus(10)), NOW)), iso(plus(10 + ACCESS_DAYS)));
check("buying after a lapse starts fresh", iso(accessUntil(iso(plus(-3)), NOW)), iso(plus(ACCESS_DAYS)));

console.log("\ndaysRemaining — the countdown shown in the account tab");
check("a part day rounds up", daysRemaining(new Date(NOW.getTime() + 6.5 * 86_400_000), NOW), 7);
check("a past date floors at zero", daysRemaining(iso(plus(-2)), NOW), 0);
check("no expiry is zero", daysRemaining(null, NOW), 0);

console.log("\nplanMeets — Pro ⊃ Starter ⊃ Free");
check("pro clears the starter bar", planMeets("pro", "starter"), true);
check("starter does not clear the pro bar", planMeets("starter", "pro"), false);
check("free clears the free bar", planMeets("free", "free"), true);

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll billing checks passed.\n");
process.exit(failures ? 1 : 0);
