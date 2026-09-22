#!/usr/bin/env node
// Billing maths integrity check. Run: npm run verify:billing
//
// There are no tests in this repo, and mostly that's fine. This file is the
// exception, for the same reason lib/scoring deserves one: these functions are
// pure, and a wrong answer here either hands someone Diamond they didn't pay for or
// takes away a month they did. Both are silent — nothing throws, a date is just
// off — so the only way to notice is to check.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const {
  accessUntil, daysRemaining, effectivePlan, planMeets, normalisePlan, nextPlanUp,
  planIncludes, featuresAddedBy, FEATURE_FROM, PAID_PLANS, PLAN_RANK, PLAN_PRICE_NZD,
  PLAN_ALLOWANCE, ACCESS_DAYS,
} = await import(join(root, "lib/billing/plans.ts"));

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
check("gold with time left is gold", effectivePlan("gold", iso(plus(5)), NOW), "gold");
check("gold that ran out is free", effectivePlan("gold", iso(plus(-1)), NOW), "free");
check("gold with no expiry fails closed", effectivePlan("gold", null, NOW), "free");
check("an unparseable expiry fails closed", effectivePlan("gold", "not-a-date", NOW), "free");
check("an expiry can't upgrade a free plan", effectivePlan("free", iso(plus(5)), NOW), "free");
check("an unknown plan name is free", effectivePlan("enterprise", iso(plus(5)), NOW), "free");
check("expiring exactly now is over", effectivePlan("gold", iso(NOW), NOW), "free");
check("diamond with time left is diamond", effectivePlan("diamond", iso(plus(1)), NOW), "diamond");

// Nobody should lose access because the tiers were renamed. A row still saying
// "pro" was paid for, and its 30 days are still running.
console.log("\nthe retired names — Starter and Pro still resolve");
check("starter maps to bronze", normalisePlan("starter"), "bronze");
// Deliberately NOT pinned to a tier name. What Pro was sold was the map, so
// what it must keep is the map — naming "gold" here is what let the mapping go
// stale the moment the map moved up a tier.
check("pro maps to the cheapest tier that still has the map",
  normalisePlan("pro"), FEATURE_FROM.map);
check("pro never maps to a tier without it", planIncludes(normalisePlan("pro"), "map"), true);
check("a live starter row keeps working", effectivePlan("starter", iso(plus(5)), NOW), "bronze");
check("a live pro row keeps the map", planIncludes(effectivePlan("pro", iso(plus(5)), NOW), "map"), true);
check("an expired pro row is still free", effectivePlan("pro", iso(plus(-1)), NOW), "free");
check("a metal name is left alone", normalisePlan("platinum"), "platinum");
check("nonsense is null, not a plan", normalisePlan("enterprise"), null);

console.log("\naccessUntil — buying early must add days, never discard them");
check(`a first purchase runs ${ACCESS_DAYS} days`, iso(accessUntil(null, NOW)), iso(plus(ACCESS_DAYS)));
check("buying with 10 days left extends to 40", iso(accessUntil(iso(plus(10)), NOW)), iso(plus(10 + ACCESS_DAYS)));
check("buying after a lapse starts fresh", iso(accessUntil(iso(plus(-3)), NOW)), iso(plus(ACCESS_DAYS)));

console.log("\ndaysRemaining — the countdown shown in the account tab");
check("a part day rounds up", daysRemaining(new Date(NOW.getTime() + 6.5 * 86_400_000), NOW), 7);
check("a past date floors at zero", daysRemaining(iso(plus(-2)), NOW), 0);
check("no expiry is zero", daysRemaining(null, NOW), 0);

console.log("\nplanMeets — Diamond ⊃ Platinum ⊃ … ⊃ Free");
check("diamond clears the copper bar", planMeets("diamond", "copper"), true);
check("copper does not clear the diamond bar", planMeets("copper", "diamond"), false);
check("free clears the free bar", planMeets("free", "free"), true);

console.log("\nthe ladder — each tier costs more and gives more than the one below");
let ladderOk = true;
PAID_PLANS.forEach((p, i) => {
  if (i === 0) return;
  const below = PAID_PLANS[i - 1];
  if (PLAN_RANK[p] <= PLAN_RANK[below]) ladderOk = false;
  if (PLAN_PRICE_NZD[p] <= PLAN_PRICE_NZD[below]) ladderOk = false;
  if (PLAN_ALLOWANCE[p].reports < PLAN_ALLOWANCE[below].reports) ladderOk = false;
});
check("rank, price and reports never go backwards", ladderOk, true);
check("free is cheaper than copper in reports too",
  PLAN_ALLOWANCE.free.reports < PLAN_ALLOWANCE.copper.reports, true);

// A tier that adds nothing is a tier nobody can be sold. Every paid step must
// either carry a feature the one below didn't, or more reports.
//
// Gold is the one that carries NO feature — it is the volume step. That is
// allowed, but only while it is genuinely cheaper per report than the tier
// below; the moment it isn't, it's a more expensive Silver and this fails.
console.log("\nevery paid tier earns its price");
const emptyTiers = PAID_PLANS.filter((p, i) => {
  if (i === 0) return false;
  const below = PAID_PLANS[i - 1];
  return (
    featuresAddedBy(p).length === 0 &&
    PLAN_ALLOWANCE[p].reports === PLAN_ALLOWANCE[below].reports
  );
});
check("no tier adds nothing over the one below", emptyTiers, []);
check("every feature starts at a real paid tier",
  Object.values(FEATURE_FROM).every((p) => PAID_PLANS.includes(p)), true);

console.log("\nfeature gates");
check("copper opens the score", planIncludes("copper", "score"), true);
check("free does not", planIncludes("free", "score"), false);
check("bronze can share, copper can't",
  [planIncludes("bronze", "share"), planIncludes("copper", "share")], [true, false]);
check("the map starts at platinum, NOT gold",
  [planIncludes("gold", "map"), planIncludes("platinum", "map")], [false, true]);
check("so does opening somebody else's report off it",
  [planIncludes("gold", "mapReports"), planIncludes("platinum", "mapReports")], [false, true]);
check("the agent letter starts at platinum",
  [planIncludes("gold", "negotiation"), planIncludes("platinum", "negotiation")], [false, true]);
check("only diamond sends an inspector",
  PAID_PLANS.filter((p) => planIncludes(p, "inspection")), ["diamond"]);
check("diamond includes everything below it",
  Object.keys(FEATURE_FROM).every((f) => planIncludes("diamond", f)), true);

console.log("\nGold is the volume tier, and has to actually be one");
check("gold adds no feature over silver", featuresAddedBy("gold"), []);
const perReport = (p) => PLAN_PRICE_NZD[p] / PLAN_ALLOWANCE[p].reports;
check("…so it must be cheaper per report than silver, or it's just dearer",
  perReport("gold") < perReport("silver"), true);
check("every feature-free tier is cheaper per report than the one below it",
  PAID_PLANS.filter((p, i) => i > 0 && featuresAddedBy(p).length === 0 &&
    perReport(p) >= perReport(PAID_PLANS[i - 1])), []);

console.log("\nnextPlanUp — what every upgrade prompt offers");
check("free is pointed at copper", nextPlanUp("free"), "copper");
check("gold is pointed at platinum", nextPlanUp("gold"), "platinum");
check("diamond has nowhere to go", nextPlanUp("diamond"), null);

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll billing checks passed.\n");
process.exit(failures ? 1 : 0);
