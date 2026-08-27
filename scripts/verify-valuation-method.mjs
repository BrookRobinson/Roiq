#!/usr/bin/env node
// Which method fits which property. Run: npm run verify:valuation-method
//
// One method used to be applied to everything: land + the building on it. Right
// for a house on its own section, silently wrong for an apartment — which has
// no land at all, so every apartment in the country came back with no valuation
// and no explanation.
//
// TENURE DECIDES, NOT THE LABEL. A "townhouse" may be freehold on its own
// section (a house, for valuing purposes) or unit title (an apartment with
// stairs). What the agent called it says nothing; what LINZ says is definitive.
// Getting that backwards values a share of somebody else's land as though it
// came with the flat.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { methodFor, comparablesMatch } = await import(join(root, "lib/scoring/valuation-method.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const m = (over) => methodFor({ floorAreaSqm: 140, landAreaSqm: 600, ...over });

console.log("\na house on its own section");
check("freehold house", m({ propertyType: "house", titleType: "freehold" }), "land-and-building");
check("freehold townhouse WITH a section", m({ propertyType: "townhouse", titleType: "freehold" }), "land-and-building");
check("lifestyle block", m({ propertyType: "lifestyle", titleType: "freehold", landAreaSqm: 20000 }), "land-and-building");

console.log("\nno section of their own — comparable sales per m²");
check("apartment", m({ propertyType: "apartment", titleType: "unit_title", landAreaSqm: null }), "floor-area-comparables");
// The one that matters: the label says townhouse, the title says otherwise.
check("townhouse on a UNIT title is not a house", m({ propertyType: "townhouse", titleType: "unit_title" }), "floor-area-comparables");
check("townhouse on a CROSS LEASE is not a house", m({ propertyType: "townhouse", titleType: "cross_lease" }), "floor-area-comparables");
check("unit", m({ propertyType: "unit", titleType: "cross_lease" }), "floor-area-comparables");
check("leasehold", m({ propertyType: "house", titleType: "leasehold" }), "floor-area-comparables");
check("licence to occupy", m({ propertyType: "house", titleType: "licence_to_occupy" }), "floor-area-comparables");
// An apartment is stacked whatever the title turns out to say.
check("apartment with an unknown title", m({ propertyType: "apartment", titleType: "unknown" }), "floor-area-comparables");
check("freehold but no land area published", m({ propertyType: "house", titleType: "freehold", landAreaSqm: null }), "floor-area-comparables");

console.log("\nnothing built");
check("a section", m({ propertyType: "section", floorAreaSqm: null }), "land-only");
// Settled before the apartment branch, or a bare section looks like a flat
// with a missing measurement.
check("no floor area but land — land, not an apartment", m({ propertyType: "unknown", floorAreaSqm: null }), "land-only");
check("nothing at all", m({ propertyType: "unknown", floorAreaSqm: null, landAreaSqm: null }), "none");

console.log("\ncomparablesMatch — a house median never values an apartment");
check("apartment vs apartment sales", comparablesMatch("apartment", "apartment"), true);
check("apartment and unit are one market", comparablesMatch("apartment", "unit"), true);
check("apartment vs HOUSE sales is refused", comparablesMatch("apartment", "house"), false);
check("townhouse vs house is refused", comparablesMatch("townhouse", "house"), false);
check("house vs house", comparablesMatch("house", "house"), true);
check("nothing to compare", comparablesMatch("apartment", null), false);
check("nothing to compare, the other way", comparablesMatch(null, "apartment"), false);

console.log(failures === 0 ? "\nMethod selection holds.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
