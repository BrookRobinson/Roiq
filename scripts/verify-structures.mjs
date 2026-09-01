#!/usr/bin/env node
// Add-a-structure: the rules, the costs, and where the footprint may be dragged.
// Run: npm run verify:structures
//
// The drag constraint IS the rule. A reader who drags a shed into a corner and
// feels it stop has learnt the setback better than any paragraph teaches it —
// which means the predicate behind that stop has to be right, and has to match
// the structure they picked. There is no single setback:
//
//   ≤10m² accessory      0m   Schedule 1, as amended 23 October 2025
//   10–30m² accessory    1m   same amendment (it used to be "its own height")
//   self-contained unit  2m   NES-DMRU, in force 15 January 2026
//   over the exemption   1m   drawing guide only; the district plan governs

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
registerHooks({
  resolve(spec, ctx, next) {
    const from = ctx.parentURL ? dirname(fileURLToPath(ctx.parentURL)) : root;
    const t = spec.startsWith("@/") ? join(root, spec.slice(2)) : spec.startsWith(".") ? join(from, spec) : null;
    if (t && !/\.[a-z]+$/i.test(t)) for (const e of [".ts", ".tsx"]) if (existsSync(t + e)) return { url: pathToFileURL(t + e).href, shortCircuit: true };
    if (t && existsSync(t)) return { url: pathToFileURL(t).href, shortCircuit: true };
    return next(spec, ctx);
  },
});

const { readSiteLayout, canPlace, firstFit } = await import(join(root, "lib/scoring/site-layout.ts"));
const {
  BUILDABLE, BUILDABLE_BY_ID, estimateBuild, footprintFor, regimeFor, setbacksFor, resaleOf,
  SCHEDULE1_MAX_SQM, SCHEDULE1_NO_SETBACK_MAX_SQM, NES_DWELLING_MAX_SQM,
} = await import(join(root, "lib/scoring/buildable-structures.ts"));
const { STRUCTURES } = await import(join(root, "lib/scoring/structures.ts"));

let failures = 0;
const check = (l, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + l);
  else { console.error(`  ✗ ${l} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const ok = (l, c) => check(l, !!c, true);
const rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

console.log("\nthe setback depends on WHAT and HOW BIG, not on one number");
const shed = BUILDABLE_BY_ID.get("wood_shed");
const garage = BUILDABLE_BY_ID.get("garage_single");
const flat = BUILDABLE_BY_ID.get("minor_dwelling");
check("a 5m² woodshed may sit on the boundary", setbacksFor(regimeFor(shed, 5)).boundary, 0);
check("an 18m² garage keeps 1m", setbacksFor(regimeFor(garage, 18)).boundary, 1);
check("a 60m² granny flat keeps 2m", setbacksFor(regimeFor(flat, 60)).boundary, 2);
// The thresholds themselves, so a later edit can't quietly move them.
check("Schedule 1's no-setback ceiling", SCHEDULE1_NO_SETBACK_MAX_SQM, 10);
check("Schedule 1's exemption ceiling", SCHEDULE1_MAX_SQM, 30);
check("the NES dwelling ceiling", NES_DWELLING_MAX_SQM, 70);
// 10 is ON the no-setback side; 11 is not.
check("exactly 10m² still needs no setback", setbacksFor(regimeFor(shed, 10)).boundary, 0);
check("11m² crosses into the 1m band", regimeFor(BUILDABLE_BY_ID.get("closed_shed"), 11), "exempt-1m");
check("31m² is past the exemption entirely", regimeFor(BUILDABLE_BY_ID.get("closed_shed"), 31), "consent-required");
// A dwelling is never a Schedule 1 accessory building, however small.
check("a tiny self-contained unit is still a dwelling", regimeFor(flat, 20), "minor-dwelling");

console.log("\nthe drag refuses what the rules refuse");
const L = readSiteLayout({ parcel: rect(0, 0, 20, 35), buildings: [rect(4, 2, 12, 10)], roadPoint: { x: 10, y: -5 } });
const g = { width: 6, length: 10 };
check("the middle of the back yard is fine", canPlace(L.plan, { x: 7, y: 20, ...g }, 2, 2), true);
check("hard against the boundary is not", canPlace(L.plan, { x: 0, y: 20, ...g }, 2, 2), false);
check("1m off, when 2m is required, is not", canPlace(L.plan, { x: 1, y: 20, ...g }, 2, 2), false);
check("2m off is", canPlace(L.plan, { x: 2, y: 20, ...g }, 2, 2), true);
check("on top of the house is not", canPlace(L.plan, { x: 5, y: 4, ...g }, 2, 2), false);
check("1m from the house, when 2m is required, is not", canPlace(L.plan, { x: 5, y: 13, ...g }, 2, 2), false);
check("hanging off the section is not", canPlace(L.plan, { x: 18, y: 20, ...g }, 2, 2), false);
// The SAME spot, for a structure the rules treat differently.
ok("a woodshed goes where a granny flat can't", canPlace(L.plan, { x: 0.2, y: 20, width: 1.6, length: 3.2 }, 0, 0));

console.log("\nYOU CANNOT BUILD ON A REGISTERED EASEMENT");
// LINZ publishes 784,660 surveyed easement polygons and 78,296 land covenant
// ones. A right of way or a drainage easement is not buildable ground, and a
// footprint that can be dropped on one is a plan somebody takes to a builder
// before anybody notices.
const withEase = readSiteLayout({
  parcel: rect(0, 0, 20, 35),
  buildings: [rect(4, 2, 12, 10)],
  roadPoint: { x: 10, y: -5 },
  burdens: [rect(0, 20, 20, 8)],        // a right of way clean across the back yard
  burdenLabels: [{ kind: "Easement", appellation: "Area C DP 498181" }],
});
const smallShed = { width: 3, length: 4 };
check("a spot inside the easement is refused", canPlace(withEase.plan, { x: 8, y: 22, ...smallShed }, 0, 0), false);
check("and clear of it is fine", canPlace(withEase.plan, { x: 8, y: 30, ...smallShed }, 0, 0), true);
// Tested both ways round: a small shed sitting WHOLLY inside a large easement
// has no corner anywhere near its edge.
check("a footprint swallowed by a large easement is still refused",
  canPlace(withEase.plan, { x: 9, y: 23, width: 2, length: 2 }, 0, 0), false);
// Setbacks are for boundaries and buildings. The burden's own edge is where it
// stops — there is no yard requirement around an easement.
ok("the burden is drawn with what it is", withEase.plan.burdens[0].kind === "Easement");
ok("and its appellation, for the solicitor", withEase.plan.burdens[0].appellation === "Area C DP 498181");
ok("burdened ground is measured", withEase.burdenedAreaSqm > 0);
// The same section with nothing registered keeps that ground.
const noEase = readSiteLayout({ parcel: rect(0, 0, 20, 35), buildings: [rect(4, 2, 12, 10)], roadPoint: { x: 10, y: -5 } });
ok("an easement costs real buildable area", withEase.clearAreaSqm < noEase.clearAreaSqm);
check("no burdens means none drawn", noEase.plan.burdens.length, 0);

console.log("\nevery structure gets somewhere sensible to start");
for (const b of BUILDABLE) {
  const size = footprintFor(b, b.defaultSqm);
  const sb = setbacksFor(regimeFor(b, b.defaultSqm));
  const home = firstFit(L.plan, size, sb.boundary, sb.building);
  // A pole shed at 60m² genuinely doesn't fit a 700m² section with a house on
  // it; what must never happen is a home position that ISN'T legal.
  if (home && !canPlace(L.plan, { ...home, ...size }, sb.boundary, sb.building)) {
    console.error(`  ✗ ${b.label} placed somewhere illegal`); failures++;
  }
}
check("no structure is dropped somewhere it may not go", failures, 0);

console.log("\ncosts are real, and small structures aren't priced per m² alone");
const w5 = estimateBuild(shed, 5);
ok("a 5m² woodshed lands near $2,100", w5.mid > 1800 && w5.mid < 2500);
// Pure $/m² makes a 5m² shed a fifteenth of a 75m² one, which no builder would
// recognise. The fixed share is why the small end stays sane.
ok("doubling the size does NOT double the price", estimateBuild(shed, 10).mid < w5.mid * 2);
ok("a range, not false precision", w5.low < w5.mid && w5.mid < w5.high);
ok("a granny flat is six figures", estimateBuild(flat, 60).mid > 100_000);
// Cost is not value — the structures catalogue has said so about pools since it
// was written. Build tab and valuation must not tell two stories.
ok("resale is less than build for everything", BUILDABLE.every((b) => resaleOf(b, b.defaultSqm) < estimateBuild(b, b.defaultSqm).mid));
ok("and it uses the valuation's own retention", BUILDABLE.every((b) => STRUCTURES[b.type] !== undefined));

console.log("\nsizes and shapes stay inside their own bounds");
for (const b of BUILDABLE) {
  if (b.defaultSqm < b.minSqm || b.defaultSqm > b.maxSqm) { console.error(`  ✗ ${b.label} default outside its range`); failures++; }
  const f = footprintFor(b, b.defaultSqm);
  if (Math.abs(f.width * f.length - b.defaultSqm) > b.defaultSqm * 0.05) { console.error(`  ✗ ${b.label} footprint doesn't match its area`); failures++; }
}
check("every default sits inside its range, and every footprint matches its area", failures, 0);
check("a size past the maximum is clamped, not extrapolated", estimateBuild(shed, 500).mid, estimateBuild(shed, shed.maxSqm).mid);

console.log(failures === 0 ? "\nAdd-a-structure holds.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
