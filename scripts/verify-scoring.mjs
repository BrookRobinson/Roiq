#!/usr/bin/env node
// RoiQ v3.1 scoring-model integrity check (spec section 9), dependency-free.
// Run: node scripts/verify-scoring.mjs
//
// Asserts the invariant that is easy to break when editing weights:
//   - both persona columns (buyerPoints / investorPoints) sum to exactly 1000
//   - every sub-item id is unique (84 items)
//   - per-inspection subtotals match the documented category weightings

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(join(root, "lib/scoring/model.ts"), "utf8");

// Parse each SCORING_MODEL row into { id, inspection, buyer, investor }.
const rows = [...src.matchAll(/\{\s*id:\s*"([^"]+)".*?inspection:\s*"([^"]+)".*?buyerPoints:\s*(\d+),\s*investorPoints:\s*(\d+)/gs)].map(
  (m) => ({ id: m[1], inspection: m[2], buyer: +m[3], investor: +m[4] })
);

let failures = 0;
const fail = (msg) => { console.error("  ✗ " + msg); failures++; };
const ok = (msg) => console.log("  ✓ " + msg);

// 1 — row count + uniqueness
const ids = rows.map((r) => r.id);
const unique = new Set(ids);
rows.length === 84 ? ok(`84 sub-items parsed`) : fail(`expected 84 sub-items, parsed ${rows.length}`);
unique.size === ids.length ? ok(`all ids unique`) : fail(`duplicate ids: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(", ")}`);

// 2 — both columns sum to exactly 1000
const buyerTotal = rows.reduce((s, r) => s + r.buyer, 0);
const investorTotal = rows.reduce((s, r) => s + r.investor, 0);
buyerTotal === 1000 ? ok(`buyer column sums to 1000`) : fail(`buyer column sums to ${buyerTotal}, expected 1000`);
investorTotal === 1000 ? ok(`investor column sums to 1000`) : fail(`investor column sums to ${investorTotal}, expected 1000`);

// 3 — per-inspection subtotals (the category-level weightings from the spec)
const EXPECT = {
  improvements: [500, 470],
  location: [220, 240],
  land: [170, 160],
  legal: [110, 130],
};
for (const [insp, [eb, ei]] of Object.entries(EXPECT)) {
  const b = rows.filter((r) => r.inspection === insp).reduce((s, r) => s + r.buyer, 0);
  const i = rows.filter((r) => r.inspection === insp).reduce((s, r) => s + r.investor, 0);
  b === eb && i === ei
    ? ok(`${insp}: buyer ${b} / investor ${i}`)
    : fail(`${insp}: buyer ${b} (want ${eb}), investor ${i} (want ${ei})`);
}

console.log("");
if (failures) {
  console.error(`FAILED — ${failures} assertion(s) broke. The scoring model is no longer self-consistent.`);
  process.exit(1);
}
console.log("PASSED — RoiQ v3.1 scoring model is self-consistent (both personas sum to 1000).");
