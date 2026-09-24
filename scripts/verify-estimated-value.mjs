#!/usr/bin/env node
// Valuing what the photos couldn't show. Run: npm run verify:estimated-value
//
// Leaving an unseen component at zero was its own distortion. A roof that isn't
// in the listing photographs is still up there, and on a house finished last
// year it is almost certainly a new roof — dropping it understated the property
// by the price of a reroof, which on the map reads as a worse deal than it is.
//
// But an estimate has to be an ESTIMATE and not a guess, so the line this
// enforces is where it comes from: the building itself. The RCN-weighted
// condition of every component that WAS assessed. Same house, same age, same
// owner, same maintenance.
//
// The two ways to get this wrong:
//   • estimate from nothing — no assessed components means no building to
//     reason from, and anything produced there is invention
//   • let an estimate reach TOP marks — full marks require evidence that
//     premium materials were used, and an unphotographed component can't
//     supply it
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
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

const { valueImprovementItems } = await import(join(root, "lib/scoring/improvement-values.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const run = (subItems) => valueImprovementItems({ subItems, floorAreaSqm: 160, bathrooms: 2 });
const item = (id, score, specTier = "modern") => ({ id, score, specTier });

// A well-presented house where most things were visible.
const GOOD = [
  item("ext_cladding", 9), item("ext_windows", 9), item("kit_cabinetry", 9),
  item("bath_shower", 9), item("liv_flooring", 9), item("ext_paint", 9),
];
// The same house, tired.
const TIRED = GOOD.map((i) => ({ ...i, score: 3, specTier: "dated" }));

console.log("\nthe unseen roof — the case that prompted this");
const good = run(GOOD);
const roof = good.estimatedItems.find((i) => i.id === "ext_roof");
check("an unphotographed roof is valued, not dropped", !!roof, true);
check("…at a real figure", roof.valueNow > 0, true);
check("…and it is listed so the reader can see what was estimated", roof.label.length > 0, true);

console.log("\nthe estimate follows the building it came from");
const tired = run(TIRED);
const tiredRoof = tired.estimatedItems.find((i) => i.id === "ext_roof");
// Spec sets what it costs to build new, and an unseen component inherits the
// spec of the building around it (capped at modern) — so the tired, dated house
// prices the roof's replacement at dated, and nothing else moves the cost.
check("an estimate's cost moves only with the spec it inherits",
  Math.round((roof.rcnNew / tiredRoof.rcnNew) * 100) / 100, Math.round((1.2 / 0.9) * 100) / 100);
check("a well-kept house estimates its unseen roof higher", roof.valueNow > tiredRoof.valueNow, true);
check("a tired house doesn't get a flattering roof", tiredRoof.valueNow < roof.valueNow / 2, true);

console.log("\nnothing assessed means nothing estimated");
const blind = run([]);
check("no estimated value at all", blind.estimatedValue, 0);
check("no estimated items", blind.estimatedItems.length, 0);
// With nothing seen there is no building to reason from — that would be a guess.
check("and no confirmed components either", blind.items.length, 0);

console.log("\ntop marks still need evidence");
// Every visible component is luxury at 10/10. The unseen ones must NOT inherit
// that — a premium fit-out elsewhere is not evidence about a roof nobody saw.
const lux = run(GOOD.map((i) => ({ ...i, score: 10, specTier: "luxury" })));
const luxRoof = lux.estimatedItems.find((i) => i.id === "ext_roof");
const capped = run(GOOD.map((i) => ({ ...i, score: 10, specTier: "modern" })));
const cappedRoof = capped.estimatedItems.find((i) => i.id === "ext_roof");
check("an estimated component is capped at 'modern'", luxRoof.valueNow, cappedRoof.valueNow);

console.log("\nthe split adds up and is reported");
check("confirmed + estimated = building value", good.confirmedValue + good.estimatedValue, good.buildingValue);
check("confirmed is more than nothing", good.confirmedValue > 0, true);
check("coverage still reports what was seen", good.coverage.valued, GOOD.length);
check("…out of what could have been", good.coverage.possible > GOOD.length, true);
check("…and every unvalued component is accounted for",
  good.coverage.valued + good.estimatedItems.length, good.coverage.possible);

console.log("\nan estimate never beats the real thing");
// A component that WAS seen is valued from what was seen, never re-estimated.
check("assessed components are not in the estimated list",
  good.estimatedItems.some((e) => GOOD.some((g) => g.id === e.id)), false);

console.log("\nthe cards add up to the headline");
// The headline used to be rcn × spec × a condition factor while every card was
// cost-to-replace × life-left: on a fair 1975 house the cards summed to a
// quarter of what the headline counted. One method now, so they must agree to
// the dollar.
const { valueItem } = await import(join(root, "lib/scoring/item-value.ts"));
const HOUSE = ["ext_cladding", "ext_windows", "kit_cabinetry", "bath_shower", "liv_flooring", "ext_foundation", "out_driveway"]
  .map((id) => item(id, 6, "dated"));
const NOW = new Date("2026-09-24T00:00:00Z");
const h = valueImprovementItems({ subItems: HOUSE, floorAreaSqm: 150, bathrooms: 1, buildYear: 1975, labourMultiplier: 1.1, now: NOW });
const cardSum = h.items.reduce((sum, v) => sum + valueItem({
  id: v.id, rcnNew: v.rcnNew, sizeWorkings: [], sizeSummary: "", conditionScore: v.condition,
  buildYear: 1975, labourMultiplier: 1.1, now: NOW,
}).valueNZD, 0);
check("every card and the headline are the same sum", cardSum, h.componentsValue);
check("nothing is worth more than it costs to replace",
  h.items.filter((v) => v.valueNow > v.replacementTotal).map((v) => v.id), []);
// A fair kitchen in a 1975 house has been replaced since — aging it to the
// house valued it at nothing.
check("a fair component in an old house still holds value",
  h.items.find((v) => v.id === "kit_cabinetry").valueNow > 0, true);

console.log("\nan ungraded spec is not a guess");
const graded = valueImprovementItems({ subItems: [{ id: "kit_cabinetry", score: 7, specTier: "dated" }], floorAreaSqm: 150, bathrooms: 1, buildYear: 2000, now: NOW });
const ungraded = valueImprovementItems({ subItems: [{ id: "kit_cabinetry", score: 7 }], floorAreaSqm: 150, bathrooms: 1, buildYear: 2000, now: NOW });
check("it carries no tier rather than an invented 'dated'", ungraded.items[0].tier, null);
check("…and is priced at the 1.0 reference, not 0.9",
  Math.round((ungraded.items[0].rcnNew / graded.items[0].rcnNew) * 100) / 100, Math.round((1 / 0.9) * 100) / 100);

console.log("\nthe roof is in the building either way");
const roofFacts = [{ id: "ext_roof", score: 7, specTier: "modern", material: "Long-run corrugated steel" }];
const measured = valueImprovementItems({ subItems: roofFacts, floorAreaSqm: 150, bathrooms: 1, buildYear: 2000, roof: { footprintM2: 160 }, now: NOW });
const unmeasured = valueImprovementItems({ subItems: roofFacts, floorAreaSqm: 150, bathrooms: 1, buildYear: 2000, now: NOW });
check("with a footprint it is valued", measured.items.some((v) => v.id === "ext_roof" && v.valueNow > 0), true);
check("without one it falls back rather than dropping out", unmeasured.items.some((v) => v.id === "ext_roof" && v.valueNow > 0), true);

console.log("\nthe base rate holds only what is behind the linings");
// Linings came out of the shell rate and became graded items; the rough-in
// came out and now scales with bathrooms. On the 150 m², one-bathroom reference
// house the three must add back to the old all-in $1,100/m² — moved, not changed.
const { IMPROVEMENT_BASE_COSTS } = await import(join(root, "lib/scoring/improvement-values.ts"));
const ref = valueImprovementItems({ subItems: [item("kit_cabinetry", 7)], floorAreaSqm: 150, bathrooms: 1, now: NOW });
const linings = (IMPROVEMENT_BASE_COSTS.liv_walls.baseRCN + IMPROVEMENT_BASE_COSTS.liv_ceiling.baseRCN + IMPROVEMENT_BASE_COSTS.bed_ceiling.baseRCN) * 150;
check("reference house: frame + rough-in + linings = the old $165,000", ref.shell.costNew + linings, 165000);
const oneBath = valueImprovementItems({ subItems: [item("kit_cabinetry", 7)], floorAreaSqm: 180, bathrooms: 1, now: NOW });
const threeBath = valueImprovementItems({ subItems: [item("kit_cabinetry", 7)], floorAreaSqm: 180, bathrooms: 3, now: NOW });
check("each extra bathroom adds its rough-in", threeBath.shell.roughIn - oneBath.shell.roughIn, 2 * 5500);
check("…and the frame doesn't move with it", threeBath.shell.structureCost, oneBath.shell.structureCost);
check("wall linings are a graded item", "liv_walls" in IMPROVEMENT_BASE_COSTS, true);
check("ceilings scale with the floor now", IMPROVEMENT_BASE_COSTS.liv_ceiling.scale, "floorM2");

console.log(failures === 0 ? "\nEstimated-value rules hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
