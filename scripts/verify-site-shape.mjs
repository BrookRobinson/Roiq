#!/usr/bin/env node
// Section shape and frontage, measured off the boundary. Run: npm run verify:site-shape
//
// Hand-drawn sections with known answers. The measurement is the surveyed
// polygon, not a photograph, so every one of these has to come out exactly
// what it plainly is.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { measureSite } = await import(join(root, "lib/scoring/site-shape.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const box = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
// Road reserve 20 m wide along the south edge (y < 0) and, for corners, the west edge.
const SOUTH_ROAD = box(-50, -20, 80, 0);
const WEST_ROAD = box(-20, -50, 0, 80);

console.log("\na plain rectangle on the street");
const rect = measureSite(box(0, 0, 20, 30), [SOUTH_ROAD]);
check("is rectangular", rect.shapeType, "rectangular");
check("nearly all of it is workable", rect.workablePct >= 97, true);
check("20 m of frontage", rect.frontage.lengthM, 20);
check("road frontage", rect.frontage.access, "road_frontage");

console.log("\na corner site");
const corner = measureSite(box(0, 0, 20, 30), [SOUTH_ROAD, WEST_ROAD]);
check("frontage on two sides is a corner", corner.frontage.access, "corner_site");
check("…50 m of it", corner.frontage.lengthM, 50);

console.log("\na battle-axe rear lot");
// A 4 m leg 30 m long from the street to a 20 × 20 m body behind the front lot.
const axe = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 30 }, { x: 20, y: 30 }, { x: 20, y: 50 }, { x: 0, y: 50 }];
const rear = measureSite(axe, [SOUTH_ROAD]);
check("is a rear lot", rear.frontage.access, "rear_lot");
check("…and the shape says so", rear.shapeType, "rear_lot");
check("the leg isn't workable land", rear.workablePct < 80, true);

console.log("\nother shapes");
const tri = measureSite([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 30 }], [SOUTH_ROAD]);
check("a triangle is a wedge", tri.shapeType, "wedge");
check("…its point is not workable", tri.workablePct < 95, true);
const ell = measureSite([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 15 }, { x: 15, y: 15 }, { x: 15, y: 30 }, { x: 0, y: 30 }], [SOUTH_ROAD]);
check("an L is an L", ell.shapeType, "l_shaped");
check("…both legs are wide enough to use", ell.workablePct >= 95, true);
check("a 12 × 45 m section is long and narrow", measureSite(box(0, 0, 12, 45), [SOUTH_ROAD]).shapeType, "long_narrow");
check("a 25 × 26 m section is square", measureSite(box(0, 0, 25, 26), [SOUTH_ROAD]).shapeType, "square");

console.log("\na shared access lot");
// A 4 m × 40 m driveway lot off the street, with three sections along it and
// the section being measured in the list too (it comes from the same query).
const DRIVE = box(0, 0, 4, 40);
const A = box(4, 20, 24, 40), B = box(-20, 20, 0, 40), C = box(-8, 40, 12, 60);
const lot = measureSite(A, [SOUTH_ROAD], [DRIVE, A, B, C, box(4, 0, 24, 20)]);
check("a section off an access lot is on a shared driveway", lot.frontage.access, "shared_driveway");
check("…and counts the homes on it, itself once", lot.frontage.homesOnAccess, 3);

console.log("\nwhat wasn't measured");
check("no road contact is access over someone else's land",
  measureSite(box(0, 30, 20, 60), [SOUTH_ROAD]).frontage.access, "right_of_way");
check("no road data, no frontage claimed", measureSite(box(0, 0, 20, 30)).frontage, null);

console.log(failures === 0 ? "\nSite-shape rules hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
