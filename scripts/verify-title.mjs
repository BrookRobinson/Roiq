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

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// title.ts is dependency-free, but the points helpers live in the engine, which
// imports its rubric. Teach the loader the app's two module conventions so the
// card's arithmetic can be checked against the engine's rather than eyeballed.
registerHooks({
  resolve(spec, ctx, next) {
    const from = ctx.parentURL ? dirname(fileURLToPath(ctx.parentURL)) : root;
    const target = spec.startsWith("@/") ? join(root, spec.slice(2)) : spec.startsWith(".") ? join(from, spec) : null;
    if (target && !/\.[a-z]+$/i.test(target)) {
      for (const ext of [".ts", ".tsx"]) {
        if (existsSync(target + ext)) return { url: pathToFileURL(target + ext).href, shortCircuit: true };
      }
    }
    if (target && existsSync(target)) return { url: pathToFileURL(target).href, shortCircuit: true };
    return next(spec, ctx);
  },
});
const { assessTitleType, resolveTenure } = await import(join(root, "lib/scoring/title.ts"));

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

console.log("\nWhose answer about the tenure wins");
// The register used to LOSE this, and to the weakest source in the app: the
// model's read was taken first, so a LINZ Record of Title saying cross lease
// was overruled by a guess made from marketing photographs. The resolved tenure
// decides which conditional items are scored, what the header prints, and —
// since a cross lease became a house — which valuation method runs at all.
check("LINZ beats the model", resolveTenure({ register: "cross_lease", model: "freehold", page: "freehold" }), "cross_lease");
check("LINZ beats the page scan", resolveTenure({ register: "cross_lease", page: "freehold" }), "cross_lease");
// The page scan matches the word "freehold" ANYWHERE in the HTML — a related
// listing, or a line about the other sections this agency has for sale, will
// satisfy it. A model that actually read the listing outranks that.
check("the model beats the page scan where the register is silent", resolveTenure({ model: "cross_lease", page: "freehold" }), "cross_lease");
check("the page scan is used when it is all there is", resolveTenure({ page: "freehold" }), "freehold");
check("nothing known stays unknown", resolveTenure({}), "unknown");
// "unknown" is an absence, not an answer, and must not block a real one.
check("an unknown register does not outrank a known model", resolveTenure({ register: "unknown", model: "cross_lease" }), "cross_lease");
check("an unknown model does not outrank a known page scan", resolveTenure({ register: null, model: "unknown", page: "leasehold" }), "leasehold");
check("every source unknown is still unknown", resolveTenure({ register: "unknown", model: "unknown", page: "unknown" }), "unknown");

console.log("\nLegal cards print POINTS, and they must be the engine's points");
// Out of ten was never the scale anything is decided on. The title carries 28 of
// a buyer's 1,000 and 30 of an investor's, and "5/10" states neither — it also
// printed the SAME number for two readers the item is worth different amounts
// to. The card does the arithmetic itself, so it is checked against the engine
// here: a card that disagrees with the score beside it is worse than no card.
const { itemMaxPoints, scoredItemPoints } = await import(join(root, "lib/scoring/engine.ts"));

check("the title is 28 points to a buyer", itemMaxPoints("leg_title", "buyer"), 28);
check("and 30 to an investor — the /10 hid this", itemMaxPoints("leg_title", "investor"), 30);
check("an unknown id has no points", itemMaxPoints("not_an_item", "buyer"), null);

for (const [tenure, buyerPts] of [["freehold", 28], ["unit_title", 20], ["cross_lease", 14], ["leasehold", 8]]) {
  const score = assessTitleType(tenure).score;
  check(`${tenure} → ${buyerPts}/28`, scoredItemPoints("leg_title", score, "buyer").earned, buyerPts);
}

// The rounding has to match the engine's, or the cards won't sum to the bar
// above them. Every tenure score, both personas, against the engine's own sum.
for (const persona of ["buyer", "investor"]) {
  for (let score = 1; score <= 10; score++) {
    const p = scoredItemPoints("leg_title", score, persona);
    const engineWay = Math.round((score / 10) * itemMaxPoints("leg_title", persona));
    if (p.earned !== engineWay) { console.error(`  ✗ ${persona} ${score}/10 → ${p.earned}, engine says ${engineWay}`); failures++; }
  }
}
check("every score, both personas, matches the engine", true, true);

// Unassessed is not zero. A Tier 3 item and one nobody scored belong to the
// unassessed pile, and "0 of 28" would read as a property that failed rather
// than a question nobody could answer.
check("an unscored item shows no points", scoredItemPoints("leg_title", null, "buyer"), null);
check("a zero score shows no points", scoredItemPoints("leg_title", 0, "buyer"), null);
// Improvements have their own tiered arithmetic and must not come through here.
check("improvements are left to their own helper", scoredItemPoints("ext_roof", 8, "buyer"), null);

if (failures) { console.error(`\n${failures} title check(s) FAILED.\n`); process.exit(1); }
console.log("\nAll title checks passed.\n");
