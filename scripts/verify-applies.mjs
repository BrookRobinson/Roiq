#!/usr/bin/env node
// Which legal items apply to a property at all. Run: npm run verify:applies
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { legalItemApplies: a } = await import(join(root, "lib/scoring/applies.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (got === want) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${got}, wanted ${want}`); failures++; }
};

console.log("\nbody corporate");
check("a unit title has one", a("leg_bodycorp", { titleType: "unit_title" }), true);
check("a freehold house never does, whatever the analysis returned", a("leg_bodycorp", { titleType: "freehold", statedBodyCorporate: true }), false);
check("a cross lease only when something says so", a("leg_bodycorp", { titleType: "cross_lease" }), false);
check("…and does when it does", a("leg_bodycorp", { titleType: "cross_lease", statedBodyCorporate: true }), true);

console.log("\nEQC claim history");
check("Christchurch", a("leg_eqc", { city: "Christchurch", region: "Canterbury" }), true);
check("Napier (Gabrielle)", a("leg_eqc", { city: "Napier", region: "Hawke's Bay" }), true);
check("Westport (2021 floods), though the region is the West Coast", a("leg_eqc", { city: "Westport", region: "West Coast" }), true);
check("Hokitika has had no claims event", a("leg_eqc", { city: "Hokitika", region: "West Coast" }), false);
check("Dunedin has had no claims event", a("leg_eqc", { city: "Dunedin", region: "Otago" }), false);

console.log("\neverything else");
check("the LIM always applies", a("leg_lim", { city: "Hokitika" }), true);

console.log(failures === 0 ? "\nApplicability rules hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
