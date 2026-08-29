#!/usr/bin/env node
// Development potential, and what the TITLE has to say about it.
// Run: npm run verify:development
//
// The Land tab puts a dollar figure on adding a dwelling — "+$122,000–$217,000
// potential value · +6 to your buyer score" — and until the register was being
// read, that finding had never heard of a covenant. A no-second-dwelling or
// no-further-subdivision covenant is common on subdivision titles and is
// precisely the thing that stops it, so the report could show six figures of
// upside on a property whose own title may forbid it, and say nothing.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
registerHooks({
  resolve(spec, ctx, next) {
    const from = ctx.parentURL ? dirname(fileURLToPath(ctx.parentURL)) : root;
    const target = spec.startsWith("@/") ? join(root, spec.slice(2)) : spec.startsWith(".") ? join(from, spec) : null;
    if (target && !/\.[a-z]+$/i.test(target)) {
      for (const ext of [".ts", ".tsx"]) if (existsSync(target + ext)) return { url: pathToFileURL(target + ext).href, shortCircuit: true };
    }
    if (target && existsSync(target)) return { url: pathToFileURL(target).href, shortCircuit: true };
    return next(spec, ctx);
  },
});

const { assessDevelopment, developmentBonus } = await import(join(root, "lib/scoring/development.ts"));
const { readSiteLayout, NES_BOUNDARY_SETBACK_M, NES_MAX_COVERAGE, NES_MAX_FLOOR_SQM } =
  await import(join(root, "lib/scoring/site-layout.ts"));
const rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const ok = (label, cond) => check(label, !!cond, true);

// A section with plenty of room — the case that earns a bonus.
const roomy = { landAreaSqm: 900, floorAreaSqm: 160, suburbMedianPerSqm: 5200 };
const COVENANT = [{ instrumentNo: "5638539.1", label: "Land Transfer Plan Land Covenant", kind: "covenant" }];
const EASEMENT = [{ instrumentNo: "9246474.9", label: "Easement Instrument", kind: "easement" }];

console.log("\nnothing registered — the finding is unchanged");
const clear = assessDevelopment({ ...roomy, titleRestrictions: [] });
ok("a roomy section still finds potential", clear.tier !== "none");
check("nothing is flagged", clear.restrictedByTitle, false);
ok("and it keeps its score bonus", developmentBonus(clear.tier, "buyer", clear.restrictedByTitle) > 0);

console.log("\na covenant on the title changes what may be claimed");
const covenanted = assessDevelopment({ ...roomy, titleRestrictions: COVENANT });
check("the section is still the same size", covenanted.tier, clear.tier);
check("but it is flagged", covenanted.restrictedByTitle, true);
// "Likely" is a claim the register no longer supports — the section is big
// enough, which was never the question.
check("confidence can no longer be 'likely'", covenanted.confidence, "possible");
check("THE SCORE BONUS IS WITHHELD", developmentBonus(covenanted.tier, "buyer", covenanted.restrictedByTitle), 0);
check("for the investor too, who is weighted higher", developmentBonus(covenanted.tier, "investor", covenanted.restrictedByTitle), 0);

console.log("\nbut the VALUE range is still shown");
// "This might be worth $122,000 — go and read covenant 5638539.1" is useful;
// silence is not. The bonus is a settled claim about the property and must go;
// the range is explicitly indicative and earns its place.
check("the uplift is unchanged", covenanted.valueUpliftHigh, clear.valueUpliftHigh);
ok("and the summary says the title might forbid it", /record of title/i.test(covenanted.summary));
ok("naming the instrument the solicitor must read", covenanted.summary.includes("5638539.1"));
ok("and saying plainly that we can't read it", /isn't public|can't tell you/i.test(covenanted.summary));
ok("it reaches the blockers list too", covenanted.blockers.some((b) => b.includes("5638539.1")));

console.log("\nan easement counts as well — for a different reason");
const eased = assessDevelopment({ ...roomy, titleRestrictions: EASEMENT });
check("also flagged", eased.restrictedByTitle, true);
ok("and says WHERE it runs is the problem", eased.blockers.some((b) => /where it runs/i.test(b)));

console.log("\nAN UNREAD REGISTER IS NOT A CLEAR TITLE");
// null means the register was never read, or LINZ publishes none for this
// title (~17% of live ones). Neither may present as "nothing registered".
const unread = assessDevelopment({ ...roomy, titleRestrictions: null });
check("nothing to flag, because nothing was read", unread.restrictedByTitle, false);
check("and no instruments are claimed", unread.titleRestrictions.length, 0);
ok("the summary makes no claim about the title either way", !/record of title/i.test(unread.summary));

console.log("\na section with no room is unaffected by any of it");
// There is no opportunity to withhold, so a covenant changes nothing here and
// must not manufacture a blocker about one.
const tiny = assessDevelopment({ landAreaSqm: 300, floorAreaSqm: 180, titleRestrictions: COVENANT });
check("tier is none", tiny.tier, "none");
check("nothing flagged", tiny.restrictedByTitle, false);
check("no bonus to withhold", developmentBonus(tiny.tier, "buyer", tiny.restrictedByTitle), 0);

console.log("\nWHERE the house sits, not just how much land is left over");
// The complaint that started this: "land minus footprint" writes the same
// sentence on every large section. A 20m × 35m section with a 12m × 10m house
// has ~500m² spare wherever that house stands — and only one arrangement can
// take a second dwelling.
const PARCEL = rect(0, 0, 20, 35);
const ROAD = { x: 10, y: -5 };
const layoutOf = (bld) => readSiteLayout({ parcel: PARCEL, buildings: bld, roadPoint: ROAD });

const front = layoutOf([rect(4, 2, 12, 10)]);
const middle = layoutOf([rect(4, 12, 12, 11)]);
const crowded = layoutOf([rect(4, 2, 12, 10), rect(2, 15, 16, 17)]);

check("house at the front reads as at the front", front.housePosition, "toward the front of the section, near the road");
check("house in the middle reads as central", middle.housePosition, "centrally on the section");
// Distance-to-a-road-POINT put a dead-centre house at 0.377 of the range and
// called it "toward the front", because the far corners of the section are
// further from the road than the middle of the back fence. It projects now.
ok("the two are not described the same way", front.housePosition !== middle.housePosition);

check("the front-house back yard takes a dwelling", front.unitFits, true);
check("and it goes behind the house", front.placement, "behind the house, away from the road");
// The middle house still fits one — in the FRONT yard, which is the honest
// answer and one a buyer reads very differently from "in the back yard".
check("the middle house only leaves the front yard", middle.placement, "between the house and the road");
check("a section built out end to end fits nothing", crowded.unitFits, false);

console.log("\nthe geometry OVERRIDES the area arithmetic");
// 700m² clears every area threshold in the table. It is not the question.
const big = { landAreaSqm: 700, floorAreaSqm: 120, suburbMedianPerSqm: 5200 };
const byArea = assessDevelopment(big);
const byGeometry = assessDevelopment({ ...big, layout: crowded });
ok("on area alone it finds potential", byArea.tier !== "none");
check("with the real layout it does not", byGeometry.tier, "none");
check("and no money is put on it", byGeometry.valueUpliftHigh, 0);
check("nor any score bonus", developmentBonus(byGeometry.tier, "investor", byGeometry.restrictedByTitle), 0);

console.log("\nand the reader is told which of the two it was");
check("measured, when the parcel was read", byGeometry.measured, true);
check("estimated, when it wasn't", byArea.measured, false);
ok("the measured summary names the largest clear piece", /largest unbroken piece/i.test(byGeometry.summary));
ok("and says the spare-area figure is misleading here", /misleading/i.test(byGeometry.summary));
ok("and states the margins as OUR assumptions", /our assumptions, not the council/i.test(byGeometry.summary));
ok("the fitting case says where it goes", /behind the house/.test(assessDevelopment({ ...big, layout: front }).summary));
// The old sentence was true of every large section in the country.
ok("the generic 'feasible on section size' line is gone when measured", !/feasible on section size/.test(byGeometry.summary));

console.log("\nthe rules are the NES-DMRU's, not ours");
// The first version used an invented 1.5m setback — not a number anybody can
// check. The National Environmental Standards for Detached Minor Residential
// Units have been in force since 15 January 2026 and say 70m², 2m from
// boundaries and buildings, 50% maximum coverage in residential zones.
check("the boundary setback is the NES 2m", NES_BOUNDARY_SETBACK_M, 2);
check("the coverage cap is the NES 50%", NES_MAX_COVERAGE, 0.5);
check("the unit is the NES 70m² ceiling", NES_MAX_FLOOR_SQM, 70);
const std = layoutOf([rect(4, 2, 12, 10)]);
check("and the layout reports them back", std.assumed.boundarySetback, 2);
check("70m² exactly, not a rounder number", std.assumed.unit.width * std.assumed.unit.length, NES_MAX_FLOOR_SQM);

console.log("\nFITTING IS NOT THE SAME AS BEING ALLOWED");
// A big house on a modest section can have a clear back lawn and still be over
// 50% built the moment anything is added. 570 Wairakei Road is real: 896m² with
// a single 521m² building, an 8m x 17m clear area, and no room under the rule.
const heavy = readSiteLayout({
  parcel: rect(0, 0, 20, 35),            // 700m²
  buildings: [rect(1, 1, 18, 17)],       // 306m², plus 70 = 53.7%
  roadPoint: ROAD,
});
ok("there is physically space for it", !!heavy.largestClear && heavy.largestClear.length >= 10);
check("coverage would breach the cap", heavy.coverageExceeded, true);
check("so it does NOT fit", heavy.unitFits, false);
check("and nothing is drawn where it can't go", heavy.plan.unit, null);
const light = readSiteLayout({ parcel: rect(0, 0, 20, 35), buildings: [rect(4, 2, 12, 10)], roadPoint: ROAD });
check("a normal house stays well under", light.coverageExceeded, false);

console.log("\nthe drawing is the finding, so it has to be there");
ok("the parcel is drawn", light.plan.parcel.length >= 4);
ok("so is the house", light.plan.buildings.length === 1);
ok("and the unit, where it fits", !!light.plan.unit);
check("the drawn unit is the right size", [
  Math.round(light.plan.unit[1].x - light.plan.unit[0].x),
  Math.round(light.plan.unit[2].y - light.plan.unit[1].y),
].sort((a, b) => a - b), [7, 10]);
ok("the extent matches the section", Math.round(light.plan.extent.width) === 20 && Math.round(light.plan.extent.length) === 35);
// Origin at the south-west corner, so a viewBox needs no second pass.
ok("coordinates start at zero", Math.min(...light.plan.parcel.map((p) => p.x)) === 0);

console.log(failures === 0 ? "\nDevelopment potential holds.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
