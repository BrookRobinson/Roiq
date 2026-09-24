#!/usr/bin/env node
// The land, adjusted for this section. Run: npm run verify:land-value
//
// The base is a TYPICAL section, not a perfect one — the rate comes from
// ordinary sales of ordinary sections — so an average section must land back
// on it, a better one above it and a worse one below. Area faults (shape,
// slope) discount only the part you can't use; site faults (orientation,
// access) apply to all of it. A fact nobody established moves nothing.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { adjustLand, LAND_ADJ } = await import(join(root, "lib/scoring/land-value.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const BASE = 600000;
const TYPICAL = { workablePct: 95, usablePct: 90, aspect: "east", shade: "open", access: "road_frontage" };
const line = (r, id) => r.lines.find((l) => l.id === id);

console.log("\nthe base is a typical section");
check("a typical section is worth exactly the base", adjustLand(BASE, TYPICAL).valueNZD, BASE);
const best = adjustLand(BASE, { workablePct: 100, usablePct: 100, aspect: "north", shade: "open", access: "prime_frontage" });
check("a flat, north, rectangular front section is worth MORE", best.valueNZD > BASE, true);

console.log("\nshape and slope discount only the land you can't use");
// The case that set the rule: a triangle with 30% of it awkward.
const wedge = adjustLand(BASE, { ...TYPICAL, workablePct: 70 });
check("a wedge loses the awkward share at a discount, not the whole section",
  line(wedge, "land_shape").deltaNZD, Math.round(-0.25 * BASE * LAND_ADJ.shape.unworkableDiscount));
check("…the awkward part keeps some value", wedge.valueNZD > BASE * 0.7, true);
const steepWedge = adjustLand(BASE, { ...TYPICAL, workablePct: 70, usablePct: 50 });
const steepRect = adjustLand(BASE, { ...TYPICAL, workablePct: 100, usablePct: 50 });
check("slope counts only on the land the shape left workable",
  line(steepWedge, "land_topography").deltaNZD > line(steepRect, "land_topography").deltaNZD, true);

console.log("\norientation and access apply to the whole section");
check("south and heavily shaded is −13%",
  line(adjustLand(BASE, { ...TYPICAL, aspect: "south", shade: "heavily_shaded" }), "land_aspect").deltaNZD, -0.13 * BASE);
check("a rear lot shared by five homes is −11%",
  line(adjustLand(BASE, { ...TYPICAL, access: "rear_lot", homesOnAccess: 5 }), "land_frontage").deltaNZD, -0.11 * BASE);
check("…and never past the floor",
  line(adjustLand(BASE, { ...TYPICAL, access: "rear_lot", homesOnAccess: 20 }), "land_frontage").deltaNZD, LAND_ADJ.accessFloorPct / 100 * BASE);
check("sharing doesn't discount a road-frontage section",
  line(adjustLand(BASE, { ...TYPICAL, homesOnAccess: 6 }), "land_frontage").deltaNZD, 0);

console.log("\nwhat nobody established moves nothing");
const blind = adjustLand(BASE, {});
check("no facts, no adjustment", blind.valueNZD, BASE);
check("…and every line says it wasn't established", blind.lines.every((l) => !l.established && /wasn't established/.test(l.working)), true);

console.log("\ntypical is measured nearby when it can be");
// The case that set the rule: a steep section in a steep suburb. The suburb's
// sales already price the slope, so against ITS typical there's little to take.
const steepHere = { ...TYPICAL, usablePct: 10 };
const national = adjustLand(BASE, steepHere);
const hilly = adjustLand(BASE, steepHere, { workablePct: 95, usablePct: 15, sampled: 40, radiusM: 400 });
check("against a steep neighbourhood a steep section loses far less",
  line(hilly, "land_topography").deltaNZD > line(national, "land_topography").deltaNZD / 5, true);
check("…and the working names the neighbourhood", /typical of sections within 400 m/.test(line(hilly, "land_topography").working), true);
check("a section typical of its neighbourhood is worth the base",
  adjustLand(BASE, { ...TYPICAL, workablePct: 88, usablePct: 40 }, { workablePct: 88, usablePct: 40, sampled: 30, radiusM: 400 }).valueNZD, BASE);
check("no nearby measurement says the figure is national", /national figure/.test(line(national, "land_topography").working), true);
check("nearby shape but no nearby slope keeps the national slope",
  /national figure/.test(line(adjustLand(BASE, steepHere, { workablePct: 95, usablePct: null, sampled: 30, radiusM: 400 }), "land_topography").working), true);

console.log("\nguards");
check("never below zero", adjustLand(1000, { workablePct: 0, usablePct: 0, aspect: "south", shade: "heavily_shaded", access: "rear_lot", homesOnAccess: 30 }).valueNZD >= 0, true);
check("the lines add up", (() => { const r = adjustLand(BASE, { workablePct: 80, usablePct: 70, aspect: "north_west", shade: "partly_shaded", access: "right_of_way", homesOnAccess: 3 }); return r.baseNZD + r.lines.reduce((s, l) => s + l.deltaNZD, 0) === r.valueNZD; })(), true);

console.log(failures === 0 ? "\nLand-value rules hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
