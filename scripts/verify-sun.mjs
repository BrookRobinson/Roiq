#!/usr/bin/env node
// Winter sun traced through the surface model. Run: npm run verify:sun
//
// Built worlds with known answers: an open field, a two-storey wall on the
// north boundary, the same wall on the south, a hill to the north, and the
// owner's own tree — which must not count.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { measureSun, sunVector } = await import(join(root, "lib/scoring/site-sun.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const LAT = -41.3; // Wellington
// A 20 × 30 m section, x 0..20, y 0..30, ground at 0.
const points = [];
for (let x = 2; x < 20; x += 4) for (let y = 2; y < 30; y += 4) points.push({ x, y, z: 0 });
const isOwn = (x, y) => x >= 0 && x <= 20 && y >= 0 && y <= 30;
const run = (surface, terrain = () => 0) => measureSun({ lat: LAT, points, surfaceAt: surface, terrainAt: terrain, isOwn });

console.log("\nthe sun itself");
const noon = sunVector(LAT, 0);
check("midwinter noon sun is to the north", noon.north > 0, true);
check("…about 25° up at Wellington", Math.round(Math.asin(noon.up) * 180 / Math.PI), 25);
check("afternoon sun is in the west", sunVector(LAT, 30).east < 0, true);

console.log("\nopen ground");
const open = run(() => 0);
check("an open field gets all its winter sun", open.sharePct >= 95, true);
check("…which is open", open.shade, "open");
check("…about 9 hours of daylight at Wellington in June", Math.abs(open.daylightHours - 9.2) < 0.5, true);

console.log("\nwho is where matters");
// A 7 m wall (two storeys) across the whole north boundary, 1 m beyond it.
const northWall = run((x, y) => (y > 31 && y < 34 ? 7 : 0));
check("two storeys on the north boundary puts the garden in shade", northWall.sharePct < 60, true);
const southWall = run((x, y) => (y < -1 && y > -4 ? 7 : 0));
check("the same building to the SOUTH costs nothing", southWall.sharePct >= 95, true);
// A ridge 300 m north, 150 m up — 27°, above the 25° midwinter noon sun.
const hill = run(() => 0, (x, y) => (y > 280 && y < 400 ? 150 : 0));
check("a hill to the north is traced too", hill.sharePct < 50, true);
check("…and reads heavily shaded", hill.shade, "heavily_shaded");

console.log("\nonly shade that isn't yours");
const ownTree = run((x, y) => (x > 8 && x < 12 && y > 26 && y < 29 ? 12 : 0));
check("the section's own tree isn't counted", ownTree.sharePct >= 95, true);

console.log(failures === 0 ? "\nSun rules hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
