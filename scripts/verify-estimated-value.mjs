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
// Same roof, same replacement cost — a tired house estimates it tired.
check("same component, same replacement cost either way", roof.rcnNew, tiredRoof.rcnNew);
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

console.log(failures === 0 ? "\nEstimated-value rules hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
