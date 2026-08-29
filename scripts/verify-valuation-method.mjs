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
// A cross lease WITHOUT a known share. It is a house, but the published land
// area is the whole shared site and we have nothing to divide it by, so valuing
// it as a house would hand this flat the neighbour's land as well.
check("cross lease, share unknown — can't divide the site", m({ propertyType: "townhouse", titleType: "cross_lease" }), "floor-area-comparables");
check("unit", m({ propertyType: "unit", titleType: "cross_lease" }), "floor-area-comparables");
check("leasehold", m({ propertyType: "house", titleType: "leasehold" }), "floor-area-comparables");
check("licence to occupy", m({ propertyType: "house", titleType: "licence_to_occupy" }), "floor-area-comparables");
// An apartment is stacked whatever the title turns out to say.
check("apartment with an unknown title", m({ propertyType: "apartment", titleType: "unknown" }), "floor-area-comparables");
check("freehold but no land area published", m({ propertyType: "house", titleType: "freehold", landAreaSqm: null }), "floor-area-comparables");

console.log("\na cross lease IS a house, once we know how much land is theirs");
// The change this exists to protect. A cross-lease house used to go down the
// apartment road, where NO condition multiplier is applied — so a cross-lease
// house scoring 250/1000 and one scoring 850/1000 valued identically. With the
// LINZ share in hand the site can be divided and it is valued as what it is.
check("cross lease with a 1/2 share", m({ propertyType: "house", titleType: "cross_lease", landShareFraction: 0.5 }), "land-and-building");
check("cross lease with a 1/3 share", m({ propertyType: "townhouse", titleType: "cross_lease", landShareFraction: 1 / 3 }), "land-and-building");
// An APARTMENT stays an apartment even on a cross lease with a known share —
// it is stacked among others and has no ground of its own to divide.
check("a stacked unit is still not a house", m({ propertyType: "apartment", titleType: "cross_lease", landShareFraction: 0.25 }), "floor-area-comparables");
// A share with no land area behind it divides nothing.
check("cross lease, share known but no land area", m({ propertyType: "house", titleType: "cross_lease", landShareFraction: 0.5, landAreaSqm: null }), "floor-area-comparables");

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
