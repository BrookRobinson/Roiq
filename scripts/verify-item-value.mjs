#!/usr/bin/env node
// The generic item valuation. Run: npm run verify:item-value
//
// The roof was the template; this is the same seven steps for the other forty
// items. Its failures are the roof's failures repeated forty times, which is
// the reason it is asserted rather than eyeballed: one wrong life figure is a
// number on a card, and forty of them is a valuation.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { valueItem, isItemWithheld } = await import(join(root, "lib/scoring/item-value.ts"));
const { ITEM_LIFE, expectedLife } = await import(join(root, "lib/scoring/item-life.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};

const NOW = new Date("2026-09-24T00:00:00Z");
const base = { rcnNew: 20000, sizeWorkings: ["x"], sizeSummary: "x", now: NOW };

console.log("\nthe life table is coherent");
const bad = Object.entries(ITEM_LIFE).filter(([, l]) =>
  l.lifeLow >= l.lifeHigh || l.materialShare <= 0 || l.materialShare >= 1 ||
  l.disposalShare < 0 || l.disposalShare > 0.3 || (l.residual ?? 0) < 0 || (l.residual ?? 0) > 0.5);
check("no backwards range or impossible split", bad.map(([k]) => k), []);
check("every entry has a sane expected life",
  Object.values(ITEM_LIFE).filter((l) => expectedLife(l) < 5 || expectedLife(l) > 120), []);
// Paint protects the cladding it sits on, so it must fall due first or the
// report tells somebody to reclad when it needed repainting.
check("paint wears out long before cladding",
  expectedLife(ITEM_LIFE.ext_paint) < expectedLife(ITEM_LIFE.ext_cladding), true);
check("appliances wear out before the cabinetry they sit in",
  expectedLife(ITEM_LIFE.kit_appliances) < expectedLife(ITEM_LIFE.kit_cabinetry), true);
check("wiring outlives a heat pump",
  expectedLife(ITEM_LIFE.liv_fixtures) > expectedLife(ITEM_LIFE.liv_heating), true);
// A foundation is repaired, not replaced. It must never read as worthless.
check("structural items carry a residual",
  ["ext_foundation", "gar_floor", "out_drainage"].every((k) => (ITEM_LIFE[k].residual ?? 0) > 0), true);

console.log("\nthe valuation");
const newish = valueItem({ ...base, id: "kit_cabinetry", buildYear: 2024, conditionScore: 9 });
const shot = valueItem({ ...base, id: "kit_cabinetry", buildYear: 1975, conditionScore: 1 });
check("a new kitchen holds nearly all its cost", newish.remainingFraction > 0.9, true);
check("one at the end of its life holds none", shot.remainingFraction, 0);
// The build year is the OLDEST a component can be, not its age. A kitchen that
// presents as fair in a 1975 house has been replaced since — aging it to the
// house put every kitchen in every pre-2000 house at $0.
const fair75 = valueItem({ ...base, id: "kit_cabinetry", buildYear: 1975, conditionScore: 6 });
check("a fair kitchen in a 1975 house is not aged to the house", fair75.remainingFraction > 0.3, true);
check("…and the card says why", /replaced since/.test(fair75.age.basis), true);
// Only GOOD condition proves a replacement. A poor one looks like the original.
const good75 = valueItem({ ...base, id: "kit_cabinetry", buildYear: 1975, conditionScore: 8 });
check("a good kitchen in a 1975 house is credited as replaced", /has been replaced since/.test(good75.age.basis), true);
const poor75 = valueItem({ ...base, id: "kit_cabinetry", buildYear: 1975, conditionScore: 4 });
check("a poor one is aged with the house", poor75.remainingFraction, 0);
check("…and says nothing suggests it was replaced", /aged with the house/.test(poor75.age.basis), true);
const steps = [4, 4.5, 5, 5.5, 6, 6.5, 7].map((c) => valueItem({ ...base, id: "kit_cabinetry", buildYear: 1975, conditionScore: c }).remainingFraction);
check("the credit phases in without a jump",
  steps.every((v, i) => i === 0 || (v >= steps[i - 1] && v - steps[i - 1] < 0.2)), true);
const tired75 = valueItem({ ...base, id: "kit_cabinetry", buildYear: 1975, conditionScore: 3 });
check("a tired one holds less than a fair one", tired75.remainingFraction < fair75.remainingFraction, true);
// A new house's components are never aged past the house.
const new24 = valueItem({ ...base, id: "kit_cabinetry", buildYear: 2024, conditionScore: 5 });
check("a component is never older than its house", new24.age.effectiveYears <= 2 * 1.06, true);
// No cliff the year a house outlives a kitchen.
const edge = [2003, 2004, 2005].map((y) => valueItem({ ...base, id: "kit_cabinetry", buildYear: y, conditionScore: 6 }).remainingFraction);
check("no jump as the house passes the component's life",
  Math.max(...edge) - Math.min(...edge) < 0.1, true);
// A replacement date is a fact and beats the condition reading.
const dated = valueItem({ ...base, id: "kit_cabinetry", buildYear: 1975, installedYear: 1995, conditionScore: 6 });
check("a known replacement date is used as the age", dated.age.chronologicalYears, 31);
check("value and liability sum to the replacement cost",
  newish.valueNZD + newish.liabilityNZD, newish.cost.totalNZD);
check("the four cost lines add up",
  shot.cost.materialsNZD + shot.cost.labourNZD + shot.cost.scaffoldNZD + shot.cost.disposalNZD,
  shot.cost.totalNZD);
// A foundation at 150 years old still holds a house up.
const oldFooting = valueItem({ ...base, id: "ext_foundation", buildYear: 1880, conditionScore: 1 });
check("a residual item never reaches zero", oldFooting.valueNZD > 0, true);
check("…and says it is a residual", /residual/.test(oldFooting.summary), true);

console.log("\nscaffold — the biggest hidden cost on exterior work");
const clad = valueItem({ ...base, id: "ext_cladding", buildYear: 2000, conditionScore: 6 });
const kitchen = valueItem({ ...base, id: "kit_cabinetry", buildYear: 2000, conditionScore: 6 });
check("cladding carries scaffold", clad.cost.scaffoldNZD > 0, true);
check("a kitchen does not", kitchen.cost.scaffoldNZD, 0);
check("…so the same spend costs more outside", clad.cost.totalNZD > kitchen.cost.totalNZD, true);
check("it is named in the working", /Scaffold/.test(clad.cost.workings.join(" ")), true);
// You do not put scaffold round a footing. The flag is what decides it, and
// anything not flagged must come back at exactly zero so the card can drop the
// line rather than printing "Scaffold $0" on a foundation.
const GROUNDED = ["ext_foundation", "ext_decking", "out_driveway", "out_drainage", "out_fencing", "gar_floor", "liv_flooring", "kit_sink"];
check("nothing reachable from the ground is charged scaffold",
  GROUNDED.filter((id) => valueItem({ ...base, id, buildYear: 2000, conditionScore: 6 }).cost.scaffoldNZD !== 0), []);
check("…and their workings never mention it",
  GROUNDED.filter((id) => /scaffold/i.test(valueItem({ ...base, id, buildYear: 2000, conditionScore: 6 }).cost.workings.join(" "))), []);
// Everything at height must, or a reclad quote comes in thousands light.
const AT_HEIGHT = ["ext_cladding", "ext_gutters", "ext_soffits", "ext_paint", "ext_chimney", "ext_solar"];
check("everything worked at height is",
  AT_HEIGHT.filter((id) => valueItem({ ...base, id, buildYear: 2000, conditionScore: 6 }).cost.scaffoldNZD <= 0), []);

console.log("\nonly labour is regional");
const flat = valueItem({ ...base, id: "kit_cabinetry", buildYear: 2000, conditionScore: 6, labourMultiplier: 1 });
const dear = valueItem({ ...base, id: "kit_cabinetry", buildYear: 2000, conditionScore: 6, labourMultiplier: 1.3 });
check("a dearer region costs more", dear.cost.totalNZD > flat.cost.totalNZD, true);
check("…but the material line does not move", dear.cost.materialsNZD, flat.cost.materialsNZD);

console.log("\nrefusals and admissions");
const noLife = valueItem({ ...base, id: "liv_light", buildYear: 2000 });
check("an item with no service life is refused",
  isItemWithheld(noLife) && noLife.withheld, "no_life_data");
const noCost = valueItem({ ...base, id: "kit_cabinetry", rcnNew: 0, buildYear: 2000 });
check("an item with no replacement cost is refused",
  isItemWithheld(noCost) && noCost.withheld, "no_cost");
const noAge = valueItem({ ...base, id: "kit_cabinetry" });
check("no age and no condition says the figure is a ceiling", /ceiling/.test(noAge.age.basis), true);
const condOnly = valueItem({ ...base, id: "kit_cabinetry", conditionScore: 7 });
check("no age but a condition read is aged from the condition", /read from its condition/.test(condOnly.age.basis), true);

console.log("\nthe replacement-due line");
const mid = valueItem({ ...base, id: "ext_decking", buildYear: 2016, conditionScore: 5.5 });
check("it names the year", mid.life.dueYear, 2026 + Math.round(mid.life.yearsRemaining));
const overdue = valueItem({ ...base, id: "kit_cabinetry", buildYear: 1975, installedYear: 1990, conditionScore: 3 });
check("an overdue item says by how much", /overdue by/i.test(overdue.life.label), true);
check("the bar never overfills", shot.life.usedFraction <= 1, true);
check("the bar agrees with the value",
  Math.abs((1 - shot.life.usedFraction) - shot.remainingFraction) < 0.01, true);

console.log("\nthe visual evidence behind a condition");
// A sound item still has evidence. "Nothing visibly wrong" on every card said
// the whole house was brand new.
const { sampleEvidence, evidenceFor } = await import(join(root, "lib/scoring/condition-evidence.ts"));
check("every costed item has evidence phrases",
  Object.keys(ITEM_LIFE).filter((id) => sampleEvidence(id, 7, [3]).length === 0), []);
check("a good item gets evidence too", sampleEvidence("ext_roof", 9, [2]).length, 2);
check("…and it cites the photo", /\(Photo 2\)/.test(sampleEvidence("ext_roof", 9, [2])[0]), true);
check("a worn item reads worse than a fair one",
  sampleEvidence("ext_paint", 3, []).join(" ") !== sampleEvidence("ext_paint", 7, []).join(" "), true);
check("an unscored item gets none rather than a guess", sampleEvidence("ext_roof", null, [2]), []);
check("recorded evidence wins", evidenceFor({ conditionEvidence: ["a"], aiSummary: "Rust at the laps (Photo 4)." }), ["a"]);
check("older reports fall back to the photo-citing sentences",
  evidenceFor({ aiSummary: "It is a roof. Rust at the laps in Photo 4. Otherwise fine." }), ["Rust at the laps in Photo 4."]);
check("nothing recorded is empty, never 'nothing wrong'", evidenceFor({ aiSummary: "Looks fine overall." }), []);

console.log("\nthe summary leads with when work is due");
const { itemSummary } = await import(join(root, "lib/scoring/item-summary.ts"));
const sum = (o) => itemSummary({ holdYears: 10, replaceCost: 12000, score: 6, now: NOW, ...o });
check("inside the hold it names the year and the cost",
  sum({ yearsRemaining: 4 }), "Needs replacing in about 4 years (around 2030), inside your 10-year hold — about $12,000 to replace today.");
check("beyond the hold it says so and skips the cost", /beyond your 10-year hold\.$/.test(sum({ yearsRemaining: 18 })), true);
check("overdue says by how much", /^Replacement is overdue by about 3 years/.test(sum({ yearsRemaining: -3 })), true);
check("long overdue just says now", /^Well past the end of its life, so budget to replace it now/.test(sum({ yearsRemaining: -37 })), true);
check("a defect on a poor item is work now",
  /Needs attention now: rust at the laps\./.test(sum({ yearsRemaining: 2, score: 3, defect: "Rust at the laps. More text." })), true);
check("no more than two sentences",
  (sum({ yearsRemaining: 4, evidence: ["Paint chalked (Photo 3). Also faded."] }).match(/[.!?](\s|$)/g) ?? []).length <= 2, true);
check("an unassessed item never claims a date", /Not assessed/.test(sum({ yearsRemaining: 4, score: null })), true);

if (failures) { console.error(`\n${failures} item-value check(s) failed.\n`); process.exit(1); }
console.log("\nAll item-value checks passed.\n");
