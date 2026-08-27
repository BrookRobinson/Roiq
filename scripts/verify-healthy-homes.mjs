#!/usr/bin/env node
// Healthy Homes standards. Run: npm run verify:healthy-homes
//
// These are the five LEGAL standards for renting a property out, so getting one
// wrong is not a rounding error — "Compliant" against a standard nobody
// established could put a landlord into a tenancy with a house that isn't.
//
// The bug this locks out: insulation sits in a ceiling, ventilation ducting runs
// inside a wall, and a ground moisture barrier is under the floor. NONE of them
// can be photographed, so the vision analysis quite correctly doesn't assess
// them — and used to hit a silent `?? "dated"` fallback, which scored a
// one-year-old townhouse 8/15 for insulation and 3/8 for ventilation on no
// evidence at all, then called it Compliant.
//
// The build year is real evidence: a dwelling put up under the current Building
// Code meets these by law. Where even that is unknown, the honest answer is that
// nobody knows — not a default.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Teach node the tsconfig "@/…" alias and extensionless imports — see
// verify-map-valuation.mjs, which does the same.
const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };
const resolveFile = (base) => [`${base}.ts`, `${base}.tsx`, base, join(base, "index.ts")].find(isFile);
registerHooks({
  resolve(specifier, context, next) {
    let base = null;
    if (specifier.startsWith("@/")) base = join(root, specifier.slice(2));
    else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:"))
      base = join(dirname(fileURLToPath(context.parentURL)), specifier);
    const target = base && resolveFile(base);
    return target ? { url: pathToFileURL(target).href, shortCircuit: true } : next(specifier, context);
  },
});
const { assessHealthyHomes } = await import(join(root, "lib/scoring/healthy-homes.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const get = (subItems, buildYear, key) => assessHealthyHomes(subItems, buildYear).find((r) => r.key === key);

// Nothing photographable — exactly what a real analysis returns for these.
const NOTHING_SEEN = [];

console.log("\nthe one-year-old townhouse that started this");
// It used to hit a silent `?? "dated" / score 5` fallback. These are what that
// produced, and what a reader saw against a house finished last year.
// hh_draught was ALREADY era-based and was never broken — it is the one that
// worked, and the fix generalises what it was doing to the other three.
const WAS = { hh_insulation: 8, hh_ventilation: 3, hh_moisture: 3 };
for (const [key, max] of [["hh_insulation", 15], ["hh_ventilation", 8], ["hh_moisture", 6]]) {
  const r = get(NOTHING_SEEN, 2025, key);
  check(`${key} beats the old silent default of ${WAS[key]}/${max}`, r.earned > WAS[key], true);
  check(`  …and says where that came from`, r.basis, "build-era");
}

// NOT full marks, and that is deliberate. Full marks means the fit-out EXCEEDS
// the standard. A build date proves the dwelling was put up under the current
// Code — it cannot prove the developer went beyond the minimum, and awarding
// maximum points from a date alone is the same over-claim in the other
// direction. So a new build sits at the top of "modern": ~80% of the points.
console.log("\nmeeting the standard is not the same as exceeding it");
for (const [key, max] of [["hh_insulation", 15], ["hh_ventilation", 8], ["hh_moisture", 6], ["hh_draught", 6]]) {
  const r = get(NOTHING_SEEN, 2025, key);
  check(`${key} scores well on a new build`, r.earned >= Math.floor(max * 0.75), true);
  check(`  …but not full marks from a date alone`, r.earned < max, true);
  check(`  …and is compliant`, r.compliant, true);
}

console.log("\nan old house is not given the benefit of the doubt");
const old = get(NOTHING_SEEN, 1950, "hh_insulation");
check("a 1950 build isn't assumed insulated", old.compliant, false);
check("…and scores nothing for it", old.earned, 0);
const mid = get(NOTHING_SEEN, 1990, "hh_insulation");
check("a 1990 build had it required, to a lower standard", mid.basis, "build-era");
check("…scoring less than a new build", mid.earned < 15, true);

console.log("\nwhat was SEEN always beats what the era implies");
// A new build with a visibly failed extractor fan is not compliant because it
// is new.
const seen = get([{ id: "bath_ventilation", specTier: "deteriorated", score: 1 }], 2025, "hh_ventilation");
check("a failed fan on a 2025 build is not compliant", seen.compliant, false);
check("…and the basis says it was observed", seen.basis, "observed");

console.log("\nno build year and nothing visible — nobody knows");
const unknown = get(NOTHING_SEEN, null, "hh_insulation");
check("not assessed", unknown.assessed, false);
// The dangerous one: unknown must NEVER read as compliant.
check("compliance is null, not true", unknown.compliant, null);
check("compliance is null, not false either", unknown.compliant === false, false);
check("scores nothing", unknown.earned, 0);
check("no basis is claimed", unknown.basis, null);

console.log("\na heater is a fitting, not a build date");
// Visible in a photograph, and not a consequence of when the house went up —
// so no era rule, and an unassessed heater stays unassessed.
const heat = get(NOTHING_SEEN, 2025, "hh_heating");
check("an unseen heater on a new build is NOT assumed present", heat.assessed, false);
check("…and is not called compliant", heat.compliant, null);
const heatSeen = get([{ id: "liv_heating", specTier: "modern", score: 8 }], 2025, "hh_heating");
check("a heat pump that WAS seen scores", heatSeen.earned > 0, true);
check("…as observed", heatSeen.basis, "observed");

console.log("\nall five standards are always returned");
check("five results", assessHealthyHomes(NOTHING_SEEN, 2025).length, 5);

console.log(failures === 0 ? "\nHealthy Homes rules hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
