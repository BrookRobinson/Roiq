#!/usr/bin/env node
// The roof valuation. Run: npm run verify:roof
//
// This is the first item priced the new way, and it is the template for the
// rest — so the arithmetic is asserted here rather than eyeballed on a card.
// Every failure mode below is silent: a roof measured off the floor area, a
// value discounted twice, an end-of-life roof still carrying value, or a
// material we couldn't identify being quietly priced as the nearest one. None
// of them throw; they just produce a five-figure number that looks exactly
// like a right one.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const {
  valueRoof, roofArea, effectiveRoofAge, roofReplacementCost, estimatePerimeter,
  isWithheld, ROOF_MATERIALS, TYPICAL_PITCH,
} = await import(join(root, "lib/scoring/roof-value.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const near = (label, got, want, tol) => check(label, Math.abs(got - want) <= tol, true);

const NOW = new Date("2026-09-24T00:00:00Z");

console.log("\narea — a roof is not a floor, and it is not its own footprint either");
const a = roofArea({ footprintM2: 150, pitchDegrees: 25, eavesOverhangM: 0.6 });
near("25° adds about 10% over the plan area", a.pitchFactor, 1.103, 0.002);
check("a slope always makes it bigger", a.roofM2 > 150, true);
near("150 m² at 25° with 600mm eaves ≈ 199 m²", a.roofM2, 199, 3);
check("a flat roof is its footprint plus eaves",
  roofArea({ footprintM2: 100, pitchDegrees: 0, eavesOverhangM: 0 }).roofM2, 100);
check("45° is the classic √2", Math.round(roofArea({ footprintM2: 100, pitchDegrees: 45 }).roofM2 / 100 * 100) / 100 > 1.41, true);
check("the working is shown, not just the answer", a.workings.length >= 5, true);
near("perimeter of a 150 m² rectangle is about 50 m", estimatePerimeter(150), 50, 2);

console.log("\nage — condition moves the AGE, it never multiplies the value twice");
check("average for its age moves nothing",
  effectiveRoofAge({ chronologicalYears: 20, conditionScore: 5.5 }).effectiveYears, 20);
check("a well-kept roof presents younger",
  effectiveRoofAge({ chronologicalYears: 20, conditionScore: 10 }).effectiveYears < 20, true);
check("a neglected roof presents older",
  effectiveRoofAge({ chronologicalYears: 20, conditionScore: 1 }).effectiveYears > 20, true);
check("no condition read leaves the age alone",
  effectiveRoofAge({ chronologicalYears: 20, conditionScore: null }).effectiveYears, 20);
check("a brand new roof can't be aged by a bad score",
  effectiveRoofAge({ chronologicalYears: 0, conditionScore: 1 }).effectiveYears, 0);
check("the reason is always stated",
  effectiveRoofAge({ chronologicalYears: 20, conditionScore: 3 }).basis.length > 20, true);

console.log("\ncost — split the way a quote is, and only labour is regional");
const area150 = roofArea({ footprintM2: 150, pitchDegrees: 25 });
const cheap = roofReplacementCost({ area: area150, material: "longrun_galv" });
const dear = roofReplacementCost({ area: area150, material: "slate" });
check("slate costs more than galvanised iron", dear.totalNZD > cheap.totalNZD, true);
check("the four lines add to the total",
  cheap.materialsNZD + cheap.labourNZD + cheap.scaffoldNZD + cheap.disposalNZD, cheap.totalNZD);
const region = roofReplacementCost({ area: area150, material: "longrun_colorsteel", labourMultiplier: 1.3 });
const flat = roofReplacementCost({ area: area150, material: "longrun_colorsteel", labourMultiplier: 1 });
check("a dearer region costs more", region.totalNZD > flat.totalNZD, true);
// Steel is steel in Gore and in Remuera. If a regional multiplier ever reaches
// the material line, build cost starts tracking land value — which is the
// rival-valuation mistake this codebase has deleted twice.
check("…but ONLY through labour and scaffold", region.materialsNZD, flat.materialsNZD);
check("two storeys need more scaffold than one",
  roofReplacementCost({ area: area150, material: "longrun_colorsteel", storeys: 2 }).scaffoldNZD >
    roofReplacementCost({ area: area150, material: "longrun_colorsteel", storeys: 1 }).scaffoldNZD, true);
// Licensed removal, not a rounding difference.
check("asbestos disposal dominates its own strip cost",
  ROOF_MATERIALS.asbestos_cement.disposalRate > ROOF_MATERIALS.longrun_colorsteel.disposalRate * 4, true);

console.log("\nthe valuation itself");
const newRoof = valueRoof({ material: "longrun_colorsteel", footprintM2: 150, pitchDegrees: 25, roofLaidYear: 2026, conditionScore: 10, now: NOW });
const oldRoof = valueRoof({ material: "longrun_galv", footprintM2: 150, pitchDegrees: 25, roofLaidYear: 1970, conditionScore: 2, now: NOW });
check("a new roof holds nearly all its cost", newRoof.remainingFraction > 0.95, true);
check("a 56-year-old galv roof holds none of it", oldRoof.remainingFraction, 0);
check("…and is worth zero", oldRoof.valueNZD, 0);
// The two numbers answer different questions and a reader needs both: one is
// what they are buying, the other is what they are about to spend.
check("…while still costing the full replacement to put right",
  oldRoof.liabilityNZD, oldRoof.cost.totalNZD);
check("value and liability always sum to the replacement cost",
  newRoof.valueNZD + newRoof.liabilityNZD, newRoof.cost.totalNZD);
check("value never exceeds the cost to replace", newRoof.valueNZD <= newRoof.cost.totalNZD, true);
check("remaining fraction stays inside 0–1",
  [oldRoof.remainingFraction >= 0, newRoof.remainingFraction <= 1], [true, true]);

console.log("\nlife bar and replacement due — the part a reader looks at first");
const mid = valueRoof({ material: "longrun_colorsteel", footprintM2: 150, pitchDegrees: 25, roofLaidYear: 2011, conditionScore: 5.5, now: NOW });
check("a 15-year-old Colorsteel roof is part-way through its life",
  mid.life.usedFraction > 0.3 && mid.life.usedFraction < 0.6, true);
check("the bar and the value agree",
  Math.abs((1 - mid.life.usedFraction) - mid.remainingFraction) < 0.01, true);
check("it names the year it falls due", mid.life.dueYear, 2026 + Math.round(mid.life.yearsRemaining));
check("…and says it in words", /left till replacement/.test(mid.life.label), true);
// "Overdue by four years" is a different conversation with a vendor from "due
// now", and the buyer is the one who has to have it.
check("an overdue roof says by how much", /overdue by/i.test(oldRoof.life.label), true);
check("…and has no due year left to give", oldRoof.life.dueYear, null);
check("the bar never overfills", oldRoof.life.usedFraction <= 1, true);
const fresh = valueRoof({ material: "longrun_colorsteel", footprintM2: 150, roofLaidYear: 2026, conditionScore: 10, now: NOW });
check("a brand new roof reads nearly empty", fresh.life.usedFraction < 0.05, true);

console.log("\nrefusals — a guessed input must not become a five-figure number");
const noMat = valueRoof({ material: null, footprintM2: 150, now: NOW });
check("no material identified is refused", isWithheld(noMat) && noMat.withheld, "no_material");
const noFoot = valueRoof({ material: "longrun_colorsteel", footprintM2: null, now: NOW });
check("no footprint is refused", isWithheld(noFoot) && noFoot.withheld, "no_footprint");
check("…and says why floor area isn't a substitute", /two-storey/.test(noFoot.reason), true);
const bogus = valueRoof({ material: "thatch", footprintM2: 150, now: NOW });
check("an unpriced material is refused, not rounded to the nearest",
  isWithheld(bogus) && bogus.withheld, "unknown_material");

console.log("\nwhat it admits it doesn't know");
const noPitch = valueRoof({ material: "longrun_colorsteel", footprintM2: 150, roofForm: "gable", roofLaidYear: 2000, now: NOW });
check("an assumed pitch uses the form's typical", noPitch.area.pitchDegrees, TYPICAL_PITCH.gable);
check("…and says it was assumed", /typical/.test(noPitch.area.workings[1]), true);
const noAge = valueRoof({ material: "longrun_colorsteel", footprintM2: 150, now: NOW });
check("an unknown age says the figure is a ceiling", /ceiling/.test(noAge.age.basis), true);

console.log("\nevery material is priced coherently");
const bad = Object.entries(ROOF_MATERIALS).filter(([, m]) =>
  m.lifeLow >= m.lifeHigh || m.rateLow >= m.rateHigh ||
  m.materialShare <= 0 || m.materialShare >= 1 || m.disposalRate <= 0);
check("no material has a backwards range or an impossible split", bad.map(([k]) => k), []);

if (failures) { console.error(`\n${failures} roof check(s) failed.\n`); process.exit(1); }
console.log("\nAll roof checks passed.\n");
