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
// …and with damage on one of them, the headline takes off what the card does.
const { actionFor } = await import(join(root, "lib/scoring/depreciation.ts"));
const DAMAGED = HOUSE.map((i) => i.id === "ext_windows" ? { ...i, urgentAction: { work: "Replace two smashed panes", scope: "repair", share: 0.25 }, observedDefect: "Two panes smashed" } : i);
const hd = valueImprovementItems({ subItems: DAMAGED, floorAreaSqm: 150, bathrooms: 1, buildYear: 1975, labourMultiplier: 1.1, now: NOW });
const cardSumD = hd.items.reduce((sum, v) => sum + valueItem({
  id: v.id, rcnNew: v.rcnNew, sizeWorkings: [], sizeSummary: "", conditionScore: v.condition,
  buildYear: 1975, labourMultiplier: 1.1, now: NOW, action: actionFor(DAMAGED.find((d) => d.id === v.id)),
}).valueNZD, 0);
check("with work needed: the cards and the headline still agree", cardSumD, hd.componentsValue);
check("…and the work lowered the building", hd.componentsValue < h.componentsValue, true);
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

console.log("\nseveral bathrooms, each valued on its own read");
// Three bathrooms used to share one score — the worst — so a new ensuite was
// valued as if it were the original 1970s bathroom downstairs.
const bath = (reads) => ({ id: "bath_shower", score: Math.min(...reads.filter((r) => r.score != null).map((r) => r.score)), specTier: "dated", byRoom: reads.map((r) => ({ photoReferences: [], ...r })) });
const mixed = [
  { room: "Ensuite", score: 9, specTier: "modern" },
  { room: "Main bathroom", score: 7, specTier: "modern" },
  { room: "Downstairs", score: 2, specTier: "dated", observedDefect: "Cracked shower tray and failed silicone (Photo 14)." },
];
const perBath = valueImprovementItems({ subItems: [bath(mixed)], floorAreaSqm: 200, bathrooms: 3, buildYear: 1975, now: NOW });
const worstCase = valueImprovementItems({ subItems: [{ id: "bath_shower", score: 2, specTier: "dated" }], floorAreaSqm: 200, bathrooms: 3, buildYear: 1975, now: NOW });
const shower = perBath.items.find((v) => v.id === "bath_shower");
check("every seen bathroom gets its own line", shower.byRoom.map((p) => p.room), ["Ensuite", "Main bathroom", "Downstairs"]);
check("the lines add up to the item", shower.valueNow, shower.byRoom.reduce((a, p) => a + p.valueNow, 0));
check("…and so does the cost new", shower.replacementTotal, shower.byRoom.reduce((a, p) => a + p.replacementTotal, 0));
check("a good ensuite is no longer valued as the worst bathroom", shower.valueNow > worstCase.items[0].valueNow, true);
check("each bathroom's own spec sets its cost new", shower.byRoom[0].rcnNew > shower.byRoom[2].rcnNew, true);
check("the urgent work is only the bad bathroom's",
  shower.byRoom.map((p) => p.actionCostNZD > 0), [false, false, true]);
check("…and the plan is charged that, not a share of all three",
  shower.actionCostNZD, shower.byRoom[2].actionCostNZD);

const partlySeen = valueImprovementItems({
  subItems: [item("kit_cabinetry", 7), bath([{ room: "Ensuite", score: 9, specTier: "modern" }, { room: "Main bathroom", score: null }])],
  floorAreaSqm: 200, bathrooms: 3, buildYear: 1975, now: NOW,
});
const ps = partlySeen.items.find((v) => v.id === "bath_shower");
check("an unphotographed bathroom is not valued as a seen one", ps.byRoom.length, 1);
check("…it is named, with any the listing counts beyond those named", ps.unseenRooms, ["Main bathroom", "Bathroom 3"]);
const est = partlySeen.estimatedItems.find((e) => e.id === "bath_shower:unseen");
check("…and estimated from the house instead", !!est && est.valueNow > 0, true);
check("…at two bathrooms' cost, not three", est.rcnNew < 3 * IMPROVEMENT_BASE_COSTS.bath_shower.baseRCN, true);

const single = valueImprovementItems({ subItems: [{ id: "bath_shower", score: 6, specTier: "dated" }], floorAreaSqm: 200, bathrooms: 3, buildYear: 1975, now: NOW });
check("without per-bathroom reads the old count-times-one-score still stands", single.items[0].byRoom, undefined);
check("…at three bathrooms' cost", single.items[0].rcnNew, Math.round(3 * IMPROVEMENT_BASE_COSTS.bath_shower.baseRCN * 0.9));

console.log("\nbedrooms: priced per bedroom, and each read on its own");
const bedItems = ["bed_heating", "bed_storage", "bed_flooring"].map((id) => ({ id, score: 7 }));
const bedTotal = (bedrooms) =>
  valueImprovementItems({ subItems: bedItems, floorAreaSqm: 150, bathrooms: 1, bedrooms, now: NOW })
    .items.reduce((a, v) => a + v.rcnNew, 0);
// The old whole-house figures were $1,500 + $2,500 + $3,000, for three
// bedrooms; per bedroom they are $500 + $850 + $1,000 (wardrobes rounded up $17).
check("a three-bedroom house costs about what the old whole-house figures did", bedTotal(3), 7050);
check("no bedroom count is read as the reference three", bedTotal(null), 7050);
check("a five-bedroom house has more wardrobes, heaters and carpet", bedTotal(5) > bedTotal(3), true);
check("…and a two-bedroom house fewer", bedTotal(2) < bedTotal(3), true);

const bedReads = (reads) => ({ id: "bed_flooring", score: Math.min(...reads.filter((r) => r.score != null).map((r) => r.score)), specTier: "dated", byRoom: reads.map((r) => ({ photoReferences: [], ...r })) });
const beds = valueImprovementItems({
  subItems: [item("kit_cabinetry", 7), bedReads([
    { room: "Main bedroom", score: 9, specTier: "modern" },
    { room: "Back bedroom", score: 4, specTier: "dated" },
    { room: "Middle bedroom", score: null },
  ])],
  floorAreaSqm: 150, bathrooms: 1, bedrooms: 3, buildYear: 1975, now: NOW,
});
const carpet = beds.items.find((v) => v.id === "bed_flooring");
check("each seen bedroom gets its own line", carpet.byRoom.map((p) => p.room), ["Main bedroom", "Back bedroom"]);
check("the lines add up to the item", carpet.valueNow, carpet.byRoom.reduce((a, p) => a + p.valueNow, 0));
check("a recarpeted main bedroom is worth more than the worn back one", carpet.byRoom[0].valueNow > carpet.byRoom[1].valueNow, true);
check("the unphotographed bedroom is named", carpet.unseenRooms, ["Middle bedroom"]);
check("…and estimated from the house", (beds.estimatedItems.find((e) => e.id === "bed_flooring:unseen")?.valueNow ?? 0) > 0, true);

// The ceilings are priced by floor area, but it is still one ceiling per bedroom.
const ceil = valueImprovementItems({
  subItems: [{ id: "bed_ceiling", score: 7, byRoom: [{ room: "A", score: 7, photoReferences: [] }, { room: "B", score: 7, photoReferences: [] }] }],
  floorAreaSqm: 150, bathrooms: 1, bedrooms: 2, now: NOW,
}).items[0];
check("a bedroom ceiling is its share of the floor-area figure", ceil.byRoom[0].rcnNew, (IMPROVEMENT_BASE_COSTS.bed_ceiling.baseRCN * 150) / 2);

console.log("\na tiled shower carries its membrane; a liner doesn't");
const { SHOWER_MEMBRANE, showerTypeFromText } = await import(join(root, "lib/scoring/improvement-values.ts"));
const showerCost = (extra) => valueImprovementItems({ subItems: [{ id: "bath_shower", score: 7, ...extra }], floorAreaSqm: 150, bathrooms: 1, now: NOW }).items[0].rcnNew;
const base = IMPROVEMENT_BASE_COSTS.bath_shower.baseRCN;
check("a tiled shower costs the membrane on top", showerCost({ showerType: "tiled" }), base + SHOWER_MEMBRANE);
check("a lined shower costs no membrane", showerCost({ showerType: "liner" }), base);
check("an unknown shower is priced as the plain one", showerCost({}), base);
check("the analysis's own words decide when it gave no type", showerCost({ material: "Tiled walk-in shower, frameless glass" }), base + SHOWER_MEMBRANE);
check("any tile wins — a tray with tiled walls still has tiles to seal behind", showerTypeFromText("Acrylic tray, tiled walls"), "tiled");
check("an acrylic shower over a bath is a liner", showerTypeFromText("Framed shower over an acrylic bath"), "liner");
check("nothing recognisable is not a guess", showerTypeFromText("Shower"), null);
const twoShowers = valueImprovementItems({
  subItems: [{ id: "bath_shower", score: 6, byRoom: [
    { room: "Ensuite", score: 9, showerType: "tiled", photoReferences: [] },
    { room: "Main bathroom", score: 6, showerType: "liner", photoReferences: [] },
  ] }],
  floorAreaSqm: 150, bathrooms: 2, now: NOW,
}).items[0];
check("each bathroom's shower is priced as its own type", twoShowers.byRoom.map((p) => p.rcnNew), [base + SHOWER_MEMBRANE, base]);

console.log("\na tiled bathroom floor carries its membrane; vinyl doesn't");
const { FLOOR_MEMBRANE, floorTypeFromText } = await import(join(root, "lib/scoring/improvement-values.ts"));
const floorCost = (extra) => valueImprovementItems({ subItems: [{ id: "bath_flooring", score: 7, ...extra }], floorAreaSqm: 150, bathrooms: 1, now: NOW }).items[0].rcnNew;
const fbase = IMPROVEMENT_BASE_COSTS.bath_flooring.baseRCN;
check("a tiled floor costs the membrane on top", floorCost({ floorType: "tiled" }), fbase + FLOOR_MEMBRANE);
check("a vinyl floor costs no membrane", floorCost({ floorType: "vinyl" }), fbase);
check("an unknown floor carries no membrane", floorCost({}), fbase);
check("the analysis's words decide when it gave no type", floorCost({ material: "Ceramic floor tile" }), fbase + FLOOR_MEMBRANE);
check("lino is vinyl", floorTypeFromText("Original lino, lifting at the door"), "vinyl");
check("the shower's membrane never lands on the floor", floorCost({ floorType: "vinyl", showerType: "tiled" }), fbase);

console.log("\nreplacing a shower is a shower job, not a bathroom refit");
const { costThreeTier } = await import(join(root, "lib/reno-costing/three-tier.ts"));
const tiledJob = costThreeTier({ id: "bath_shower", name: "Shower / bath", category: "Bathroom", variant: "tiled" });
const linerJob = costThreeTier({ id: "bath_shower", name: "Shower / bath", category: "Bathroom", variant: "liner" });
check("a tiled shower is the tiled job", tiledJob.kind, "shower_tiled");
check("…which includes a waterproof membrane", tiledJob.budget.materials.some((m) => /membrane/i.test(m.name)), true);
check("a liner is the liner job", linerJob.kind, "shower_liner");
check("…with no membrane in it", linerJob.budget.materials.some((m) => /membrane/i.test(m.name)), false);
check("the tiled job costs more", tiledJob.budget.tradieTotal > linerJob.budget.tradieTotal, true);
check("neither prices a toilet or a vanity", [...tiledJob.budget.materials, ...linerJob.budget.materials].some((m) => /toilet|vanity/i.test(m.name)), false);
const vanityJob = costThreeTier({ id: "bath_vanity", name: "Vanity & tapware", category: "Bathroom" });
const toiletJob = costThreeTier({ id: "bath_toilet", name: "Toilet", category: "Bathroom" });
check("a vanity is a vanity job", vanityJob.kind, "vanity");
check("a tiled bathroom floor is the tile job, with its membrane",
  costThreeTier({ id: "bath_flooring", category: "Bathroom", variant: "tiled" }).budget.materials.some((m) => /membrane/i.test(m.name)), true);
const vinylFloor = costThreeTier({ id: "bath_flooring", category: "Bathroom", variant: "vinyl" });
check("a vinyl bathroom floor is relaid in vinyl", vinylFloor.kind, "flooring_sheet_vinyl");
check("…with no tiles and no membrane", vinylFloor.budget.materials.some((m) => /tile|membrane/i.test(m.name)), false);
check("a toilet is a toilet job", toiletJob.kind, "toilet");
check("neither prices a shower, tiles or a membrane",
  [...vanityJob.budget.materials, ...toiletJob.budget.materials].some((m) => /shower|tile|membrane/i.test(m.name)), false);
check("each costs less than the bathroom refit it used to price",
  Math.max(vanityJob.budget.tradieTotal, toiletJob.budget.tradieTotal) < costThreeTier({ id: "room_bathroom", category: "Bathroom" }).budget.tradieTotal, true);

console.log(failures === 0 ? "\nEstimated-value rules hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
