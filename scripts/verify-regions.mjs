#!/usr/bin/env node
// Regional labour rates: which region a listing resolves to, and what it costs.
// Run: npm run verify:regions
//
// Materials are FLAT nationwide and only labour carries a regional multiplier,
// which is the right model: Gib is Gib in Gore and in Remuera, and a $3m section
// does not make the timber on it cost more. Build cost must never track land
// value — deriving one from the other is the same class of mistake as the rival
// valuation formulas this codebase has already deleted twice.
//
// What DOES vary is the labour market, and Queenstown is the case that proves
// the table has to be checked rather than reasoned about: it was filed under
// "Remote / Rural" at 0.77, the cheapest band available, for one of the two most
// expensive districts in the country to build in.

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
registerHooks({
  resolve(spec, ctx, next) {
    const from = ctx.parentURL ? dirname(fileURLToPath(ctx.parentURL)) : root;
    const t = spec.startsWith("@/") ? join(root, spec.slice(2)) : spec.startsWith(".") ? join(from, spec) : null;
    if (t && !/\.[a-z]+$/i.test(t)) for (const e of [".ts", ".tsx"]) if (existsSync(t + e)) return { url: pathToFileURL(t + e).href, shortCircuit: true };
    if (t && existsSync(t)) return { url: pathToFileURL(t).href, shortCircuit: true };
    return next(spec, ctx);
  },
});

const { resolveRegion, REGIONAL_MULTIPLIERS, NZ_MEDIAN_REGION } =
  await import(join(root, "lib/labour-rates/index.ts"));

let failures = 0;
const check = (l, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + l);
  else { console.error(`  ✗ ${l} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const ok = (l, c) => check(l, !!c, true);
const R = (s) => resolveRegion(s);

console.log("\nQueenstown Lakes is expensive, and was filed as the cheapest band");
ok("Queenstown is at or above Auckland", R("Queenstown").multiplier >= REGIONAL_MULTIPLIERS["Auckland"]);
ok("and nowhere near Remote / Rural", R("Queenstown").multiplier > REGIONAL_MULTIPLIERS["Remote / Rural"]);
check("Wānaka is the same district", R("Wānaka").region, "Queenstown Lakes");
check("so is Wanaka without the macron", R("Wanaka").region, "Queenstown Lakes");
check("and Arrowtown", R("Arrowtown").region, "Queenstown Lakes");

console.log("\nTHE TOWN BEATS THE REGION BEHIND IT");
// A listing's region field says "Otago" for a Queenstown property, and the
// resolver used to read only the LAST token — so the fix above would have been
// inert in production, resolving on "otago" and pricing it as Dunedin.
check("Queenstown, Otago resolves on the town", R("Queenstown, Otago").region, "Queenstown Lakes");
check("Otago alone is still Dunedin", R("Otago").region, "Dunedin");
check("Dunedin, Otago is Dunedin", R("Dunedin, Otago").region, "Dunedin");
check("Tauranga beats Bay of Plenty behind it", R("Tauranga, Bay of Plenty").region, "Tauranga");
// A suburb we don't know must fall through to the region, not to the median.
check("an unknown suburb falls through to its region", R("Remuera, Auckland").region, "Auckland");
check("multi-word regions still resolve whole", R("Bay of Plenty").region, "Bay of Plenty");
check("and multi-word towns", R("New Plymouth, Taranaki").region, "Taranaki");
check("Hokitika still finds the West Coast", R("Hokitika, Westland").region, "West Coast");

console.log("\nunknown is the national median, never Auckland");
// Falling back to Auckland would silently price a Hokitika reroof at
// metropolitan rates, which is the expensive direction to be wrong in.
check("nothing given", R(null).region, NZ_MEDIAN_REGION);
check("gibberish", R("Atlantis").region, NZ_MEDIAN_REGION);
check("empty string", R("").region, NZ_MEDIAN_REGION);
ok("the median is below Auckland", R(null).multiplier < REGIONAL_MULTIPLIERS["Auckland"]);

console.log("\nthe table itself stays sane");
const vals = Object.values(REGIONAL_MULTIPLIERS);
ok("every multiplier is in a believable band", vals.every((v) => v >= 0.7 && v <= 1.3));
check("Auckland is the reference at 1.00", REGIONAL_MULTIPLIERS["Auckland"], 1.0);
ok("no region is priced below Remote / Rural", vals.every((v) => v >= REGIONAL_MULTIPLIERS["Remote / Rural"]));

console.log(failures === 0 ? "\nRegional labour rates hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
