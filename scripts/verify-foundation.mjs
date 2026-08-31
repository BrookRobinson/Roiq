#!/usr/bin/env node
// Foundation scoring. Run: npm run verify:foundation
//
// The largest single item in the model, and almost never photographed from
// underneath. The rules being checked here are the owner's own: a concrete
// floor outscores timber piles; a slab under the post-2011 standard is the top
// of the range; an old house on piles with floors visibly out of level and gaps
// around the doorways is the bottom. Symptoms seen INSIDE outrank the type.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { assessFoundation } = await import(join(root, "lib/scoring/foundation.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    console.log("  ✓ " + label);
  } else {
    console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
    failures++;
  }
};
const score = (type, buildYear, symptoms = []) =>
  assessFoundation({ type, buildYear, symptoms }).score;
const tier = (type, buildYear, symptoms = []) =>
  assessFoundation({ type, buildYear, symptoms }).confidenceTier;

console.log("\nConcrete beats timber, all else equal");
check("modern slab is the top of the range", score("concrete_slab", 2020), 10);
check("modern slab > modern timber piles", score("concrete_slab", 2020) > score("timber_piles", 2020), true);
check("1990s slab > 1990s piles", score("concrete_slab", 1995) > score("timber_piles", 1995), true);
check("old slab > old piles", score("concrete_slab", 1960) > score("timber_piles", 1960), true);
check("concrete piles sit between", score("concrete_piles", 1995) > score("timber_piles", 1995), true);

console.log("\nEra matters within a type");
check("post-2011 slab > engineered-era slab", score("concrete_slab", 2015) > score("concrete_slab", 1990), true);
check("braced-era piles > pre-1970 piles", score("timber_piles", 1990) > score("timber_piles", 1960), true);
check("pre-1970 piles start low", score("timber_piles", 1960), 4);

console.log("\nThe owner's worst case: an old house on piles, floors out of level");
// "you can see the floor is uneven from the pictures inside the house,
//  uneven gaps around the door ways etc."
const worst = assessFoundation({
  type: "timber_piles",
  buildYear: 1955,
  symptoms: ["sloping_floor", "door_gaps"],
});
check("scores at the bottom", worst.score, 1);
check("and is Tier 1 — the symptoms ARE the evidence", worst.confidenceTier, 1);
check("rationale names what was seen", /out of level|gaps around doorways/.test(worst.rationale), true);

console.log("\nSymptoms outrank the type");
check("a modern slab with movement drops", score("concrete_slab", 2018, ["sloping_floor", "exterior_cracking"]), 5);
check("symptoms cost the same whatever the type", score("timber_piles", 1990) - score("timber_piles", 1990, ["door_gaps"]), 2);
check("duplicates aren't counted twice", score("timber_piles", 1990, ["door_gaps", "door_gaps"]), score("timber_piles", 1990, ["door_gaps"]));
check("never falls below 1", score("timber_piles", 1900, ["sloping_floor", "door_gaps", "out_of_square", "lining_cracks", "exterior_cracking"]), 1);

console.log("\nConfidence follows the evidence, not the score");
// Nobody saw a pile in any of these — that is the normal case, not a failure.
check("clean read of the type is Tier 2", tier("timber_piles", 1975), 2);
check("visible symptoms make it Tier 1", tier("timber_piles", 1975, ["sloping_floor"]), 1);
check("subfloor actually shown is Tier 1", assessFoundation({ type: "timber_piles", buildYear: 1975, subfloorVisible: true }).confidenceTier, 1);
check("type not established is Tier 3", tier("unknown", 1975), 3);

console.log("\nNo build year — the band must not invent a decade");
for (const [type, want] of [["timber_piles","Timber piles, era not stated"],["concrete_slab","Concrete slab, era not stated"],["concrete_piles","Concrete piles, era not stated"]]) {
  check(`${type} with no build year`, assessFoundation({ type, buildYear: null }).band, want);
}
check("a stated era still names it", assessFoundation({ type: "timber_piles", buildYear: 1975 }).band, "Timber piles, 1970s");

console.log("\nAn unknown type still says something honest");
const unknown = assessFoundation({ type: "unknown", buildYear: null, symptoms: [] });
check("mid-band rather than a guess at the extremes", unknown.score, 6);
check("says the type couldn't be established", /could not be established/.test(unknown.rationale), true);
check("and admits the build year is missing", /build year not stated/.test(unknown.rationale), true);

console.log("\nVENTS RULE OUT A SLAB — the brick-veneer trap");
// 156 Buchanans Road, a 1975 brick-veneer bungalow. The analysis SAW the vents
// and reasoned past them: "a continuous brick veneer base running to ground
// level with small regularly-spaced vents but no elevated timber baseboard or
// height gap under the cladding — consistent with a concrete slab". The missing
// gap is what brick veneer always looks like; the vents are the real evidence,
// because a slab has no subfloor to ventilate.
const per = assessFoundation({ type: "perimeter_piles", buildYear: 1975, symptoms: [] });
const slab = assessFoundation({ type: "concrete_slab", buildYear: 1975, symptoms: [] });
const timber = assessFoundation({ type: "timber_piles", buildYear: 1975, symptoms: [] });
check("a perimeter footing with interior piles is its own type", !!per, true);
check("it rates below a full slab", per.score < slab.score, true);
check("and above bare timber piles", per.score > timber.score, true);
check("and says what it is", /perimeter footing/i.test(per.band), true);

console.log("\nNothing claims anyone looked underneath");
for (const [label, a] of [
  ["clean timber piles", assessFoundation({ type: "timber_piles", buildYear: 1975 })],
  ["modern slab", assessFoundation({ type: "concrete_slab", buildYear: 2020 })],
]) {
  check(`${label} says nobody has been under the floor`, /Nobody has been under the floor/.test(a.rationale), true);
}

if (failures) {
  console.error(`\n${failures} foundation check(s) FAILED.\n`);
  process.exit(1);
}
console.log("\nAll foundation checks passed.\n");
