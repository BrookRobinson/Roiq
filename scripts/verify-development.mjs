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

console.log(failures === 0 ? "\nDevelopment potential holds.\n" : `\n${failures} failure${failures === 1 ? "" : "s"}.\n`);
process.exit(failures === 0 ? 0 : 1);
