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

console.log("\nunconsented works");
check("nothing points to it: not shown", a("leg_unconsented", {}, { score: null, confidenceTier: 3 }), false);
check("a Tier 3 guess alone doesn't raise it", a("leg_unconsented", {}, { score: 4, confidenceTier: 3 }), false);
check("a studio or sleepout on the site raises it", a("leg_unconsented", { unconsentedSignal: true }, { score: null, confidenceTier: 3 }), true);
check("the analysis flagging it on a real read raises it", a("leg_unconsented", {}, { score: 5, confidenceTier: 2 }), true);
check("a fix attached raises it", a("leg_unconsented", {}, { score: null, confidenceTier: 3, remediation: { low: 4000 } }), true);
const { unconsentedSignal: sig } = await import(join(root, "lib/scoring/applies.ts"));
check("a floor-area gap is a signal", sig({ extraStructures: 0, floorAreaLarger: true }), true);
check("no structure and no gap is not", sig({ extraStructures: 0, floorAreaLarger: false }), false);

console.log("\neverything else");
check("the LIM always applies", a("leg_lim", { city: "Hokitika" }), true);

console.log(failures === 0 ? "\nApplicability rules hold.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
