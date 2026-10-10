#!/usr/bin/env node
// Digitally edited listing photos. Run: npm run verify:edited-photos
//
// An edited photo used to RAISE a valuation: the stain is painted out, the AI
// sees a clean ceiling, the item scores well. These rules make an edited photo
// weaker evidence instead, and the assertions hold the three things that are
// easy to get wrong later:
//   • only a "likely" flag may move a score — a guess about editing must never
//     cost a real house its marks;
//   • an item that also appears in an untouched photo keeps its score;
//   • something shown ONLY in a render is not seen at all (no score), which is
//     the "never score what the analysis could not see" rule applied to a fake.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { normEditedPhotos, applyEditedPhotos, applyEditedPhotosToRoom, EDITED_SCORE_CAP } = await import(
  join(root, "lib/ai/edited-photos.ts")
);

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    console.log("  ✓ " + label);
  } else {
    console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
    failures++;
  }
};

const item = (over = {}) => ({
  id: "kit_cabinetry",
  score: 9,
  confidenceTier: 1,
  specTier: "luxury",
  aiSummary: "New cabinetry.",
  evidenceSource: "Listing photos",
  photoReferences: [3, 4],
  ...over,
});
const flag = (photo, kind, confidence = "likely") => ({ photo, kind, confidence, evidence: "x" });

console.log("\nCleaning the model's list");
check("drops a photo number past the end", normEditedPhotos([flag(9, "retouched")], 5), []);
check("drops photo 0 and non-integers", normEditedPhotos([flag(0, "retouched"), flag(1.5, "retouched")], 5), []);
check("drops an unknown kind", normEditedPhotos([flag(2, "photoshopped")], 5), []);
check("anything but 'likely' is 'possible'", normEditedPhotos([{ photo: 2, kind: "retouched", confidence: "certain" }], 5)[0].confidence, "possible");
check("one entry per photo, the stronger claim wins",
  normEditedPhotos([flag(2, "retouched", "possible"), flag(2, "render", "likely")], 5).map((e) => [e.photo, e.kind, e.confidence]),
  [[2, "render", "likely"]]);
check("sorted by photo", normEditedPhotos([flag(4, "retouched"), flag(1, "retouched")], 5).map((e) => e.photo), [1, 4]);
check("not a list → nothing", normEditedPhotos(undefined, 5), []);

console.log("\nWhat must NOT change a score");
check("no flags", applyEditedPhotos(item(), []), null);
check("a flag on a photo this item doesn't use", applyEditedPhotos(item(), [flag(7, "render")]), null);
check("a 'possible' flag moves nothing", applyEditedPhotos(item(), [flag(3, "render", "possible"), flag(4, "render", "possible")]), null);
check("an item nobody scored is left alone", applyEditedPhotos(item({ score: null }), [flag(3, "render"), flag(4, "render")]), null);
check("an item with no photos is left alone", applyEditedPhotos(item({ photoReferences: [] }), [flag(3, "render")]), null);

console.log("\nAlso shown in an untouched photo → noted, score kept");
{
  const r = applyEditedPhotos(item(), [flag(3, "render")]);
  check("effect", r.effect, "noted");
  check("score kept", r.item.score, 9);
  check("tier kept", r.item.confidenceTier, 1);
  check("spec kept", r.item.specTier, "luxury");
  check("says which photo", r.item.aiSummary.startsWith("Photo 3 looks digitally edited"), true);
}

console.log("\nShown only in edited photos of a real room → weakened");
{
  const r = applyEditedPhotos(item(), [flag(3, "virtual_staging"), flag(4, "retouched")]);
  check("effect", r.effect, "weakened");
  check("score capped", r.item.score, EDITED_SCORE_CAP);
  check("tier 1 → 2", r.item.confidenceTier, 2);
  check("luxury → modern", r.item.specTier, "modern");
  check("names both photos", r.item.aiSummary.startsWith("Photos 3 and 4 look digitally edited"), true);
  const low = applyEditedPhotos(item({ score: 4, specTier: "dated", confidenceTier: 2 }), [flag(3, "retouched"), flag(4, "retouched")]);
  check("a low score is never raised", low.item.score, 4);
  check("a dated spec is left alone", low.item.specTier, "dated");
  check("tier 2 stays 2", low.item.confidenceTier, 2);
  const mixed = applyEditedPhotos(item(), [flag(3, "render"), flag(4, "retouched")]);
  check("a render plus a retouched REAL photo is weakened, not unseen", mixed.effect, "weakened");
}

console.log("\nShown only in renders / virtual renovations → not seen");
{
  const r = applyEditedPhotos(item(), [flag(3, "render"), flag(4, "virtual_renovation")]);
  check("effect", r.effect, "unseen");
  check("no score", r.item.score, null);
  check("tier 3", r.item.confidenceTier, 3);
  check("source says so", r.item.evidenceSource, "Shown only in digitally created images");
  check("original finding is kept after the warning", r.item.aiSummary.endsWith("New cabinetry."), true);
}

console.log("\nPer-room reads");
{
  const room = (over = {}) => ({ room: "Ensuite", score: 10, specTier: "luxury", photoReferences: [5], ...over });
  check("untouched room unchanged", applyEditedPhotosToRoom(room(), [flag(9, "render")]).score, 10);
  check("'possible' moves nothing", applyEditedPhotosToRoom(room(), [flag(5, "render", "possible")]).score, 10);
  check("render-only room → unseen", applyEditedPhotosToRoom(room(), [flag(5, "render")]).score, null);
  const w = applyEditedPhotosToRoom(room(), [flag(5, "virtual_staging")]);
  check("staged-only room capped", [w.score, w.specTier], [EDITED_SCORE_CAP, "modern"]);
  check("room also in a clean photo unchanged", applyEditedPhotosToRoom(room({ photoReferences: [5, 6] }), [flag(5, "render")]).score, 10);
}

console.log("\nReading a tool input the model stringified");
{
  const { normaliseToolInput } = await import(join(root, "lib/ai/tool-input.ts"));
  const items = [{ id: "ext_roof", score: 6 }];
  check("a normal input passes through", normaliseToolInput({ edited_photos: [], sub_items: items }), { edited_photos: [], sub_items: items });
  check("sub_items as a JSON string of a list", normaliseToolInput({ sub_items: JSON.stringify(items) }).sub_items, items);
  // The real failure: 172 Park Street, 11 October 2026.
  const wrapped = normaliseToolInput({ sub_items: JSON.stringify({ sub_items: items, property_context: { has_pool: false }, edited_photos: [{ photo: 1 }] }) });
  check("the whole answer as a string inside sub_items", wrapped.sub_items, items);
  check("…and its other fields are lifted out", [wrapped.property_context, wrapped.edited_photos], [{ has_pool: false }, [{ photo: 1 }]]);
  check("the whole answer nested as an object", normaliseToolInput({ sub_items: { sub_items: items } }).sub_items, items);
  check("an outer field beats the nested one", normaliseToolInput({ edited_photos: [], sub_items: { sub_items: items, edited_photos: [{ photo: 2 }] } }).edited_photos, []);
  check("text that isn't JSON is dropped, not iterated", "sub_items" in normaliseToolInput({ sub_items: "sorry, I could not" }), false);
  check("a stringified property_context is parsed", normaliseToolInput({ sub_items: [], property_context: '{"has_pool":true}' }).property_context, { has_pool: true });
  check("not an object at all → empty", normaliseToolInput(null), {});
}

console.log(failures ? `\n${failures} FAILED\n` : "\nAll edited-photo rules hold.\n");
process.exit(failures ? 1 : 0);
