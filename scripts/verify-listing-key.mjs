#!/usr/bin/env node
// Listing-match integrity check. Run: npm run verify:listing-key
//
// These rules decide whether two people pasted the same house, which decides
// whether someone gets a saved analysis instead of a fresh one. A miss just
// costs money. A FALSE match shows someone a report for a different property,
// so the tests below lean hard on the cases that must NOT match.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { normaliseListingUrl, normaliseAddress, priceUnchanged, normalisePhotoUrl, photosUnchanged, propertyKey } = await import(
  join(root, "lib/reports/listing-key.ts")
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

const BASE = "https://www.oneroof.co.nz/property/west-coast/hokitika/12-example-street/123456";
const key = normaliseListingUrl(BASE);

console.log("\nnormaliseListingUrl — the same listing, spelled differently");
check("www. is ignored", normaliseListingUrl(BASE.replace("www.", "")), key);
check("http matches https", normaliseListingUrl(BASE.replace("https", "http")), key);
check("a trailing slash is ignored", normaliseListingUrl(BASE + "/"), key);
check("tracking params are ignored", normaliseListingUrl(BASE + "?utm_source=fb&fbclid=x"), key);
check("a #fragment is ignored", normaliseListingUrl(BASE + "#photos"), key);
check("case is ignored", normaliseListingUrl(BASE.toUpperCase().replace("HTTPS", "https")), key);
check("a missing protocol still parses", normaliseListingUrl("oneroof.co.nz/property/x"), "oneroof.co.nz/property/x");

console.log("\nnormaliseListingUrl — things that must NOT match");
check("a different listing id", normaliseListingUrl(BASE.replace("123456", "999999")) === key, false);
check("a different portal", normaliseListingUrl(BASE.replace("oneroof.co.nz", "realestate.co.nz")) === key, false);
check("free text is null", normaliseListingUrl("not a url at all"), null);
check("an empty string is null", normaliseListingUrl(""), null);
check("null in, null out", normaliseListingUrl(null), null);

console.log("\nnormaliseAddress");
check("punctuation and spacing", normaliseAddress("75 Revell Street, Hokitika"), normaliseAddress("75  Revell Street,, Hokitika"));
check("case is ignored", normaliseAddress("75 REVELL STREET, HOKITIKA"), normaliseAddress("75 revell street hokitika"));
check("too short to match on", normaliseAddress("12a"), null);
check("a different street number", normaliseAddress("75 Revell St") === normaliseAddress("76 Revell St"), false);
check("null in, null out", normaliseAddress(null), null);

console.log("\npriceUnchanged — a price move forces a fresh analysis");
check("the same price reuses", priceUnchanged(750_000, 750_000), true);
check("a price drop re-analyses", priceUnchanged(720_000, 750_000), false);
check("a price rise re-analyses", priceUnchanged(780_000, 750_000), false);
check("no price today (auction)", priceUnchanged(null, 750_000), true);
check("no price saved", priceUnchanged(750_000, null), true);
check("no price either side", priceUnchanged(null, null), true);
check("zero counts as no price", priceUnchanged(0, 750_000), true);

console.log("\nphotosUnchanged — the report cites photos by number");
const P = (n) => `https://cdn.example.co.nz/listing/9876/photo-${n}.jpg`;
const THREE = [P(1), P(2), P(3)];
check("identical sets reuse", photosUnchanged(THREE, THREE, 3), true);
check("resize params are ignored", photosUnchanged(THREE.map((u) => u + "?width=1200&v=7"), THREE, 3), true);
check("a new photo added re-analyses", photosUnchanged([...THREE, P(4)], THREE, 3), false);
check("a photo removed re-analyses", photosUnchanged([P(1), P(2)], THREE, 3), false);
check("a photo swapped re-analyses", photosUnchanged([P(1), P(9), P(3)], THREE, 3), false);
check("a REORDER re-analyses (Photo 3 would move)", photosUnchanged([P(3), P(2), P(1)], THREE, 3), false);
check("no photos either side reuses", photosUnchanged([], [], 0), true);
check("saved claims photos but lists none", photosUnchanged(THREE, [], 12), false);
check("listing gained photos since (none saved)", photosUnchanged(THREE, [], 0), false);
check("data: urls are ignored", photosUnchanged(["data:image/jpeg;base64,AAAA", ...THREE], THREE, 3), true);
check("junk entries are ignored", photosUnchanged([null, "", ...THREE], THREE, 3), true);

console.log("\npropertyKey — recognising one house across two pin sources");
check("street + suburb group", propertyKey("12 High Street", "Hokitika"), propertyKey("12 high street", "hokitika"));
check("a scraped address carrying its suburb still matches",
  propertyKey("12 High Street, Hokitika", "Hokitika"), propertyKey("12 High Street", "Hokitika"));
check("same street, different town must NOT match",
  propertyKey("1 High Street", "Hokitika") === propertyKey("1 High Street", "Greymouth"), false);
check("different number must NOT match",
  propertyKey("12 High Street", "Hokitika") === propertyKey("14 High Street", "Hokitika"), false);
check("no suburb is unusable", propertyKey("12 High Street", null), null);
check("no address is unusable", propertyKey(null, "Hokitika"), null);
check("a suburb-only address is unusable", propertyKey("Hokitika", "Hokitika"), null);

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll listing-match checks passed.\n");
process.exit(failures ? 1 : 0);
