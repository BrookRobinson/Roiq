#!/usr/bin/env node
// Is there a building to score? Run: npm run verify:dwelling
//
// This decides whether a listing gets a 1,000-point condition report or a
// refusal, and both mistakes are bad in different ways. Saying "no building"
// about a real house blocks a paying customer from the product. Saying "house"
// about a bare section produces a confident, detailed, entirely false report —
// a roof scored from a photograph of an empty paddock — which is how this check
// came to exist. So the tests below lean hard on BOTH directions.
//
// The address rule is here for the same reason: a street name with no number
// identifies a road, not a property, and looking one up returned a neighbouring
// house's floor area and asking price to be merged into a section's report.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { assessDwelling, identifiesOneProperty } = await import(
  join(root, "lib/property/dwelling.ts")
);
const { landValuePublishable, LAND_VALUE_MAX_SQM } = await import(
  join(root, "lib/scoring/land-quality.ts")
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

const has = (listing) => assessDwelling(listing).hasDwelling;

console.log("\nNo building — must be refused");
// The listing that exposed this: OneRoof publishes floorAreaString "0m²" on its
// sections, while its schema.org markup still calls the page a
// SingleFamilyResidence. The stated zero has to win.
check("a stated floor area of 0 m²", has({ noBuildingStated: true, propertyType: "house" }), false);
check("stated zero beats a 'house' type", has({ noBuildingStated: true, propertyType: "house", floorAreaSqm: 195 }), false);
check("advertised as a section", has({ propertyType: "section" }), false);
check("floor area of exactly 0", has({ propertyType: "unknown", floorAreaSqm: 0 }), false);
// The bedroom count on the Golf Links Road section was scraped out of page
// furniture. If a bedroom could vouch for a building, the check would fail on
// exactly the listing it exists for.
check("a stray bedroom count doesn't vouch for a building", has({ noBuildingStated: true, bedrooms: 1 }), false);
check("the refusal gives a reason", typeof assessDwelling({ noBuildingStated: true }).reason, "string");

console.log("\nA building — must go through");
// The regression that nearly shipped: OneRoof publishes floorAreaString "0m"
// when it simply does not hold the figure, so a four-bedroom house in Whakatāne
// reads 0m² exactly like a bare paddock. The scraper therefore only sets
// noBuildingStated when the zero is CORROBORATED (portal category "Section", or
// no bedrooms) — never on the zero alone. If that ever regresses, a real house
// gets a land report and its Improvements tab disappears.
check("a house with no floor area published and no zero flag", has({ propertyType: "house", floorAreaSqm: null, bedrooms: 4 }), true);
check("an ordinary house", has({ propertyType: "house", floorAreaSqm: 195, bedrooms: 3 }), true);
check("a house with no floor area published", has({ propertyType: "house", floorAreaSqm: null }), true);
check("nothing known at all", has({}), true);
check("an apartment", has({ propertyType: "apartment", floorAreaSqm: 72 }), true);
check("a lifestyle block with a dwelling", has({ propertyType: "lifestyle", floorAreaSqm: 240 }), true);
// "Set on a large section" is in the copy of half the houses in the country.
// Nothing here reads the description, and this is the reason why.
check("a house on a big section", has({ propertyType: "house", floorAreaSqm: 180, landAreaSqm: 5967 }), true);
check("no reason when there is a building", assessDwelling({ propertyType: "house" }).reason, null);

console.log("\nDoes the address identify ONE property?");
check("street name only", identifiesOneProperty("Golf Links Road"), false);
check("street name with suburb", identifiesOneProperty("Golf Links Road, Westland, West Coast"), false);
check("a highway number is not a street number", identifiesOneProperty("State Highway 6, Hokitika"), false);
check("a marketing title", identifiesOneProperty("Central Fox Glacier Living"), false);
check("empty", identifiesOneProperty(""), false);
check("null", identifiesOneProperty(null), false);
check("a street number", identifiesOneProperty("14 Ferndale Road, Remuera"), true);
check("a letter suffix", identifiesOneProperty("14A Bay Road"), true);
check("a flat number", identifiesOneProperty("2/14 Smith Street"), true);
check("a spelled-out unit", identifiesOneProperty("Unit 3, 14 Smith Street"), true);

console.log("\nCan we stand behind this land value?");
// The reported section: 5,967m² valued at $1.41m against a $195,000 asking price.
// On a land report the valuation IS the report, so an unbounded extrapolation
// from suburb house comps is the whole answer being wrong.
const pub = (landAreaSqm, landValue, askingPrice) =>
  landValuePublishable({ landAreaSqm, landValue, askingPrice }).ok;
check("the 5,967m² section that broke it", pub(5967, 1410467, 195000), false);
check("a section past the size band", pub(LAND_VALUE_MAX_SQM + 1, 300000, 300000), false);
check("an ordinary section near asking", pub(600, 310000, 300000), true);
check("right on the size limit", pub(LAND_VALUE_MAX_SQM, 300000, 300000), true);
check("no asking price to check against", pub(600, 300000, null), true);
// A wide gap is the PRODUCT on a house — here there is no building to explain
// one, and the rate is already stretched, so it means we are wrong.
check("estimate double the asking price", pub(600, 600000, 300000), false);
check("estimate a third of the asking price", pub(600, 100000, 300000), false);
check("a refusal explains itself", typeof landValuePublishable({ landAreaSqm: 5967, landValue: 1410467, askingPrice: 195000 }).reason, "string");

if (failures) {
  console.error(`\n${failures} dwelling check(s) FAILED.\n`);
  process.exit(1);
}
console.log("\nAll dwelling checks passed.\n");
