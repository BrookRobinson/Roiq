#!/usr/bin/env node
// Title scoring from tenure. Run: npm run verify:title
//
// This exists because the AI was scoring it and would not do so consistently:
// 9/10 tier 1 "Freehold" on one property, "Not assessed — not visible in the
// listing" and no score on another with the same known freehold tenure. A tenure
// is a category, so it is scored by lookup now, and the ordering below is the
// thing worth protecting — it is about what the buyer actually acquires, not
// about how nice the property is.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { assessTitleType } = await import(join(root, "lib/scoring/title.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const score = (t) => assessTitleType(t)?.score ?? null;

console.log("\nThe ordering — what you actually acquire");
check("freehold is the top of the range", score("freehold"), 10);
check("unit title sits below freehold", score("unit_title") < score("freehold"), true);
check("cross-lease sits below unit title", score("cross_lease") < score("unit_title"), true);
check("leasehold sits below cross-lease", score("leasehold") < score("cross_lease"), true);
check("licence to occupy is the bottom", score("licence_to_occupy") < score("leasehold"), true);

console.log("\nUnknown is not a score");
check("unknown returns null, so the item stays unscored", assessTitleType("unknown"), null);
check("null returns null", assessTitleType(null), null);
check("undefined returns null", assessTitleType(undefined), null);
check("a tenure we don't recognise returns null", assessTitleType("company_share"), null);

console.log("\nEvery known tenure is scored, confidently and completely");
for (const t of ["freehold", "unit_title", "cross_lease", "leasehold", "licence_to_occupy"]) {
  const a = assessTitleType(t);
  check(`${t} is scored 1-10`, a.score >= 1 && a.score <= 10, true);
  check(`${t} is tier 1 — it comes from the register, not a guess`, a.confidenceTier, 1);
  check(`${t} explains itself`, a.finding.length > 10 && a.rationale.length > 80, true);
}

console.log("\nThe warnings a buyer must not miss");
check("leasehold warns about ground-rent reviews", /ground rent/i.test(assessTitleType("leasehold").rationale), true);
check("cross-lease warns the plan must match what's built", /flats plan/i.test(assessTitleType("cross_lease").rationale), true);
check("unit title names the body corporate", /body corporate/i.test(assessTitleType("unit_title").rationale), true);
check("licence to occupy says it is not land ownership", /not an estate in land/i.test(assessTitleType("licence_to_occupy").rationale), true);

console.log("\nDeterminism — the reason this moved out of the model");
check(
  "the same tenure scores the same every time",
  new Set([0, 1, 2, 3, 4].map(() => score("freehold"))).size,
  1
);

if (failures) { console.error(`\n${failures} title check(s) FAILED.\n`); process.exit(1); }
console.log("\nAll title checks passed.\n");
