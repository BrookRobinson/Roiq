#!/usr/bin/env node
// Photo evidence beyond the agent's choices. Run: npm run verify:photo-evidence
//
// Two halves. The aerial crop must land on the right section: the tile maths
// is easy to get subtly wrong (y grows southward, the crop is in canvas pixels,
// the outline in crop pixels) and a wrong roof analysed confidently is worse
// than none. And a photo gap may lower CONFIDENCE but must never move a SCORE:
// a gap is a reason to doubt the read, not evidence the thing is bad.
//
// Imports the TypeScript modules directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { planAerialCrop, PAD_M, MIN_SIDE_M, MAX_TILES } = await import(join(root, "lib/imagery/aerial-plan.ts"));
const { normPhotoGaps, applyPhotoGaps, MAX_GAPS } = await import(join(root, "lib/ai/photo-gaps.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};

// Hokitika, roughly. Metres per degree as site-geometry.ts computes them.
const lat = -42.7167, lng = 170.9667;
const anchor = { lat, lng, mPerDegLat: 111320, mPerDegLon: 111320 * Math.cos((lat * Math.PI) / 180) };
const square = (half) => [{ x: -half, y: -half }, { x: half, y: -half }, { x: half, y: half }, { x: -half, y: half }];

console.log("\nAerial crop plan");
{
  const p = planAerialCrop(anchor, square(15), 20);
  check("plans at the zoom asked for", p.z, 20);
  const sideM = p.crop.width * p.metresPerPixel;
  check("crop covers the section plus padding (≈46 m)", Math.abs(sideM - (30 + 2 * PAD_M)) < 1.5, true);
  check("crop is square", Math.abs(p.crop.width - p.crop.height) <= 2, true);
  check("crop starts inside the first tile", p.crop.left >= 0 && p.crop.left < 256 && p.crop.top >= 0 && p.crop.top < 256, true);
  const canvasW = (p.tileX1 - p.tileX0 + 1) * 256, canvasH = (p.tileY1 - p.tileY0 + 1) * 256;
  check("crop fits on the stitched tiles", p.crop.left + p.crop.width <= canvasW && p.crop.top + p.crop.height <= canvasH, true);
  const xs = p.outline.map((q) => q.x), ys = p.outline.map((q) => q.y);
  const padPx = PAD_M / p.metresPerPixel;
  check("boundary sits inside the crop with the padding round it",
    Math.min(...xs) > padPx - 3 && Math.max(...xs) < p.crop.width - padPx + 3 && Math.min(...ys) > padPx - 3 && Math.max(...ys) < p.crop.height - padPx + 3, true);
  // North is UP: the point with the larger y (metres north) must be higher in the picture.
  check("north is up", p.outline[3].y < p.outline[0].y, true);
  check("east is right", p.outline[1].x > p.outline[0].x, true);
}
{
  const tiny = planAerialCrop(anchor, square(3), 20);
  check("a tiny section still gets at least the minimum frame", Math.round(tiny.crop.width * tiny.metresPerPixel) >= MIN_SIDE_M - 1, true);
  check("an enormous section is refused at high zoom", planAerialCrop(anchor, square(600), 20), null);
  const big = planAerialCrop(anchor, square(600), 16);
  check("…and planned at a lower one within the tile budget", big !== null && (big.tileX1 - big.tileX0 + 1) * (big.tileY1 - big.tileY0 + 1) <= MAX_TILES, true);
  check("no boundary, no plan", planAerialCrop(anchor, [], 20), null);
}

console.log("\nPhoto gaps: cleaning the model's list");
const valid = new Set(["ext_cladding", "ext_roof", "bath_shower"]);
{
  const g = normPhotoGaps([{ area: "Rear of the house", missing: "No photo of the back", item_ids: ["ext_cladding", "made_up", "ext_cladding"] }], valid);
  check("unknown and repeated item ids are dropped", g[0].itemIds, ["ext_cladding"]);
  check("a gap with no area or no 'missing' is dropped", normPhotoGaps([{ area: "x" }, { missing: "y" }], valid), []);
  check("the same area twice is one gap", normPhotoGaps([{ area: "Roof", missing: "a" }, { area: "roof", missing: "b" }], valid).length, 1);
  check("capped", normPhotoGaps(Array.from({ length: 20 }, (_, i) => ({ area: `A${i}`, missing: "m" })), valid).length, MAX_GAPS);
  check("not a list → nothing", normPhotoGaps(undefined, valid), []);
}

console.log("\nPhoto gaps: what they may do to an item");
{
  const gaps = [{ area: "Rear of the house", missing: "No photo of the back", itemIds: ["ext_cladding"] }];
  const item = { id: "ext_cladding", score: 8, confidenceTier: 1, aiSummary: "Sound weatherboards." };
  const out = applyPhotoGaps(item, gaps);
  check("Tier 1 becomes Tier 2", out.confidenceTier, 2);
  check("the SCORE never moves", out.score, 8);
  check("it says which part the photos skip", out.aiSummary.startsWith("The listing photos don't show the rear of the house"), true);
  check("an item no gap names is untouched", applyPhotoGaps({ ...item, id: "ext_roof" }, gaps), null);
  check("Tier 2 stays as it is", applyPhotoGaps({ ...item, confidenceTier: 2 }, gaps), null);
  check("an unscored item stays as it is", applyPhotoGaps({ ...item, score: null }, gaps), null);
}

console.log(failures ? `\n${failures} FAILED\n` : "\nAll photo-evidence rules hold.\n");
process.exit(failures ? 1 : 0);
