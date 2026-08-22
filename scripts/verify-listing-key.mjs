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
const { normaliseListingUrl, normaliseAddress, priceUnchanged } = await import(
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

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll listing-match checks passed.\n");
process.exit(failures ? 1 : 0);
