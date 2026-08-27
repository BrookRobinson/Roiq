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
const { assessFarm, FARM_LAND_SQM } = await import(join(root, "lib/property/farm.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const isFarm = (propertyType) => assessFarm({ propertyType }).isFarm;
const byLand = (landAreaSqm, propertyType = "house") => assessFarm({ propertyType, landAreaSqm }).isFarm;
const ha = (h) => h * 10_000;

// ── The one that got through ────────────────────────────────────────────
// 217 Poerua Valley Road, Harihari: 489 hectares, advertised by OneRoof as
// "Rural & Lifestyle", 17 mentions of dairy — typed `house` by the scraper,
// analysed as one, scored 607/1000 on the state of its rooms. The label was
// wrong; the land area never is.
console.log("\n217 Poerua Valley Road — the farm that got analysed");
check("489 hectares, typed 'house', is still a farm", byLand(4_893_866, "house"), true);
check("…and it says how much land, in hectares",
  /489 hectares/.test(assessFarm({ propertyType: "house", landAreaSqm: 4_893_866 }).reason), true);
// Its floor area was null too — the label being wrong cascaded into the
// dwelling check assuming a building. Land area doesn't care.
check("…even with no floor area on the listing",
  assessFarm({ propertyType: "house", landAreaSqm: 4_893_866, floorAreaSqm: null }).isFarm, true);

console.log("\nland area is the primary signal");
check(`${FARM_LAND_SQM / 10_000}ha exactly is not yet a farm`, byLand(FARM_LAND_SQM), false);
check("a square metre over is", byLand(FARM_LAND_SQM + 1), true);
check("40 hectares", byLand(ha(40)), true);
check("a 900m² suburban section is never a farm", byLand(900), false);
check("no land area stated doesn't refuse", byLand(null), false);
check("a nonsense land area doesn't refuse", byLand(NaN), false);

console.log("\nrefused");
check("rural", isFarm("rural"), true);
check("…whatever the casing", isFarm("Rural"), true);
check("…and with stray whitespace", isFarm("  rural  "), true);

console.log("\nnot refused — everything else is in scope");
for (const t of ["house", "townhouse", "unit", "apartment", "section", "commercial", "unknown"]) {
  check(t, isFarm(t), false);
}

console.log("\nthe one that must never be refused");
// A house on a few hectares is the customer. These must all pass, whatever
// the portal happens to call them.
check("2ha lifestyle block", byLand(ha(2), "lifestyle"), false);
check("5ha lifestyle block", byLand(ha(5), "lifestyle"), false);
check("10ha lifestyle block", byLand(ha(10), "lifestyle"), false);
check("…even typed as a house", byLand(ha(8), "house"), false);
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
