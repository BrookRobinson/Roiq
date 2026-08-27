#!/usr/bin/env node
// Farms are refused at the door. Run: npm run verify:farm
//
// Tectara values a home and the ground it sits on. A farm is worth what it
// produces — hectares, soil, water take, stock units — and none of that is in a
// listing photograph. Run the 1,000-point model over one and you score a $3m
// dairy unit on the state of its kitchen.
//
// The risk runs BOTH ways and the second one is the quiet one:
//   • miss a farm  → money spent on an analysis that can't mean anything
//   • refuse a LIFESTYLE block → we turn away the customer we are built for
//
// A house on a few hectares is squarely in scope. The only signal used is the
// portal's own classification, because there is no hectare figure separating a
// farm from a lifestyle block that somebody didn't just choose.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { assessFarm } = await import(join(root, "lib/property/farm.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const isFarm = (propertyType) => assessFarm({ propertyType }).isFarm;

console.log("\nrefused");
check("rural", isFarm("rural"), true);
check("…whatever the casing", isFarm("Rural"), true);
check("…and with stray whitespace", isFarm("  rural  "), true);

console.log("\nnot refused — everything else is in scope");
for (const t of ["house", "townhouse", "unit", "apartment", "section", "commercial", "unknown"]) {
  check(t, isFarm(t), false);
}

console.log("\nthe one that must never be refused");
// A house on a few hectares is the customer, not the exception. Its oversized
// land figure is handled by the land-value cap, not by turning the person away.
check("lifestyle is NOT a farm", isFarm("lifestyle"), false);
check("nor is a lifestyle section", isFarm("lifestyle-section"), false);

console.log("\nmissing or malformed input never refuses");
check("null", isFarm(null), false);
check("undefined", isFarm(undefined), false);
check("empty string", isFarm(""), false);
check("no field at all", assessFarm({}).isFarm, false);

console.log("\nthe reason is shown to a person, so it must exist when refusing");
check("a refusal carries a reason", typeof assessFarm({ propertyType: "rural" }).reason, "string");
check("a pass carries none", assessFarm({ propertyType: "house" }).reason, null);

console.log(failures === 0 ? "\nFarm rules hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
