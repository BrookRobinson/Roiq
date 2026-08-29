#!/usr/bin/env node
// Title scoring from tenure. Run: npm run verify:title
//
// This exists because the AI was scoring it and would not do so consistently:
// 9/10 tier 1 "Freehold" on one property, "Not assessed — not visible in the
// listing" and no score on another with the same known freehold tenure. A tenure
// is a category, so it is scored by lookup now, and the ordering below is the
// thing worth protecting — it is about what the buyer actually acquires, not
// about how nice the property is.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// title.ts is dependency-free, but the points helpers live in the engine, which
// imports its rubric. Teach the loader the app's two module conventions so the
// card's arithmetic can be checked against the engine's rather than eyeballed.
registerHooks({
  resolve(spec, ctx, next) {
    const from = ctx.parentURL ? dirname(fileURLToPath(ctx.parentURL)) : root;
    const target = spec.startsWith("@/") ? join(root, spec.slice(2)) : spec.startsWith(".") ? join(from, spec) : null;
    if (target && !/\.[a-z]+$/i.test(target)) {
      for (const ext of [".ts", ".tsx"]) {
        if (existsSync(target + ext)) return { url: pathToFileURL(target + ext).href, shortCircuit: true };
      }
    }
    if (target && existsSync(target)) return { url: pathToFileURL(target).href, shortCircuit: true };
    return next(spec, ctx);
  },
});
const { assessTitleType, resolveTenure } = await import(join(root, "lib/scoring/title.ts"));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};
const score = (t) => assessTitleType(t)?.score ?? null;
const ok = (label, cond) => check(label, !!cond, true);

console.log("\nThe ordering — what you actually acquire");
check("freehold is the top of the range", score("freehold"), 10);
check("unit title sits below freehold", score("unit_title") < score("freehold"), true);
check("cross-lease sits below unit title", score("cross_lease") < score("unit_title"), true);
check("leasehold sits below cross-lease", score("leasehold") < score("cross_lease"), true);
check("licence to occupy is the bottom", score("licence_to_occupy") < score("leasehold"), true);

console.log("\nUnknown is not a score");
check("unknown returns null, so the item stays unscored", assessTitleType("unknown"), null);
check("null returns null", assessTitleType(null), null);
check("undefined returns null", assessTitleType(undefined), null);
check("a tenure we don't recognise returns null", assessTitleType("company_share"), null);

console.log("\nEvery known tenure is scored, confidently and completely");
for (const t of ["freehold", "unit_title", "cross_lease", "leasehold", "licence_to_occupy"]) {
  const a = assessTitleType(t);
  check(`${t} is scored 1-10`, a.score >= 1 && a.score <= 10, true);
  check(`${t} is tier 1 — it comes from the register, not a guess`, a.confidenceTier, 1);
  check(`${t} explains itself`, a.finding.length > 10 && a.rationale.length > 80, true);
}

console.log("\nThe warnings a buyer must not miss");
check("leasehold warns about ground-rent reviews", /ground rent/i.test(assessTitleType("leasehold").rationale), true);
check("cross-lease warns the plan must match what's built", /flats plan/i.test(assessTitleType("cross_lease").rationale), true);
check("unit title names the body corporate", /body corporate/i.test(assessTitleType("unit_title").rationale), true);
check("licence to occupy says it is not land ownership", /not an estate in land/i.test(assessTitleType("licence_to_occupy").rationale), true);

console.log("\nDeterminism — the reason this moved out of the model");
check(
  "the same tenure scores the same every time",
  new Set([0, 1, 2, 3, 4].map(() => score("freehold"))).size,
  1
);

console.log("\nWhose answer about the tenure wins");
// The register used to LOSE this, and to the weakest source in the app: the
// model's read was taken first, so a LINZ Record of Title saying cross lease
// was overruled by a guess made from marketing photographs. The resolved tenure
// decides which conditional items are scored, what the header prints, and —
// since a cross lease became a house — which valuation method runs at all.
check("LINZ beats the model", resolveTenure({ register: "cross_lease", model: "freehold", page: "freehold" }), "cross_lease");
check("LINZ beats the page scan", resolveTenure({ register: "cross_lease", page: "freehold" }), "cross_lease");
// The page scan matches the word "freehold" ANYWHERE in the HTML — a related
// listing, or a line about the other sections this agency has for sale, will
// satisfy it. A model that actually read the listing outranks that.
check("the model beats the page scan where the register is silent", resolveTenure({ model: "cross_lease", page: "freehold" }), "cross_lease");
check("the page scan is used when it is all there is", resolveTenure({ page: "freehold" }), "freehold");
check("nothing known stays unknown", resolveTenure({}), "unknown");
// "unknown" is an absence, not an answer, and must not block a real one.
check("an unknown register does not outrank a known model", resolveTenure({ register: "unknown", model: "cross_lease" }), "cross_lease");
check("an unknown model does not outrank a known page scan", resolveTenure({ register: null, model: "unknown", page: "leasehold" }), "leasehold");
check("every source unknown is still unknown", resolveTenure({ register: "unknown", model: "unknown", page: "unknown" }), "unknown");

console.log("\nLegal cards print POINTS, and they must be the engine's points");
// Out of ten was never the scale anything is decided on. The title carries 28 of
// a buyer's 1,000 and 30 of an investor's, and "5/10" states neither — it also
// printed the SAME number for two readers the item is worth different amounts
// to. The card does the arithmetic itself, so it is checked against the engine
// here: a card that disagrees with the score beside it is worse than no card.
const { itemMaxPoints, scoredItemPoints } = await import(join(root, "lib/scoring/engine.ts"));

check("the title is 28 points to a buyer", itemMaxPoints("leg_title", "buyer"), 28);
check("and 30 to an investor — the /10 hid this", itemMaxPoints("leg_title", "investor"), 30);
check("an unknown id has no points", itemMaxPoints("not_an_item", "buyer"), null);

for (const [tenure, buyerPts] of [["freehold", 28], ["unit_title", 20], ["cross_lease", 14], ["leasehold", 8]]) {
  const score = assessTitleType(tenure).score;
  check(`${tenure} → ${buyerPts}/28`, scoredItemPoints("leg_title", score, "buyer").earned, buyerPts);
}

// The rounding has to match the engine's, or the cards won't sum to the bar
// above them. Every tenure score, both personas, against the engine's own sum.
for (const persona of ["buyer", "investor"]) {
  for (let score = 1; score <= 10; score++) {
    const p = scoredItemPoints("leg_title", score, persona);
    const engineWay = Math.round((score / 10) * itemMaxPoints("leg_title", persona));
    if (p.earned !== engineWay) { console.error(`  ✗ ${persona} ${score}/10 → ${p.earned}, engine says ${engineWay}`); failures++; }
  }
}
check("every score, both personas, matches the engine", true, true);

// Unassessed is not zero. A Tier 3 item and one nobody scored belong to the
// unassessed pile, and "0 of 28" would read as a property that failed rather
// than a question nobody could answer.
check("an unscored item shows no points", scoredItemPoints("leg_title", null, "buyer"), null);
check("a zero score shows no points", scoredItemPoints("leg_title", 0, "buyer"), null);
// Improvements have their own tiered arithmetic and must not come through here.
check("improvements are left to their own helper", scoredItemPoints("ext_roof", 8, "buyer"), null);

console.log("\nA cross lease is graded on how shared the site actually is");
// It used to hand every cross lease in the country a flat 5 — the well-separated
// pair with their own driveways and the rear flat up a shared right-of-way,
// identical. The valuation had already learned to tell them apart (5% against
// 8%), so the HEADLINE number was the less informed of the two, off data
// already in hand.
const xl = (coOwners, sharing) => assessTitleType("cross_lease", { coOwners, sharing }).score;
const SEPARATE = { separateDriveway: true, detached: true, exclusiveYard: true };
const TANGLED = { separateDriveway: false, detached: false, exclusiveYard: false };

check("the most separate two-flat pair scores best", xl(2, SEPARATE), 6);
check("two flats, nothing observed, is unchanged at 5", xl(2), 5);
check("a shared drive, shared grounds and a shared wall drops it", xl(2, TANGLED), 4);
check("more flats sharing the title is worse", xl(6, SEPARATE) <= xl(2, SEPARATE), true);
ok("separate always beats tangled at the same flat count", xl(3, SEPARATE) > xl(3, TANGLED));

console.log("\nand it never leaves its lane");
// Whatever is observed, a cross lease stays strictly between the two tenures
// either side of it. However tangled, the owner still holds a share of the fee
// simple, where a leaseholder owns no land at all. However tidy, the flats plan
// can still be defective and every footprint change still needs the neighbours.
const FIELDS = ["separateDriveway", "detached", "exclusiveYard", "sharedStructures", "rearFlat"];
let out = 0, seen = new Set();
for (let n = 2; n <= 12; n++) {
  for (let mask = 0; mask < 3 ** FIELDS.length; mask++) {
    const sharing = {}; let m = mask;
    for (const f of FIELDS) { const v = m % 3; m = Math.floor(m / 3); if (v === 1) sharing[f] = true; if (v === 2) sharing[f] = false; }
    const sc = xl(n, sharing);
    seen.add(sc);
    if (sc <= assessTitleType("leasehold").score || sc >= assessTitleType("unit_title").score) out++;
  }
}
check("no arrangement reaches leasehold or unit title", out, 0);
check("the full range is used", [...seen].sort().join(","), "4,5,6");

console.log("\nthe score and the valuation discount tell ONE story");
// Two expressions of the same finding. If they can disagree, one of them is
// lying to a reader looking at both on the same page.
const { crossLeaseDiscount } = await import(join(root, "lib/scoring/cross-lease.ts"));
for (const [label, sharing] of [["separate", SEPARATE], ["tangled", TANGLED], ["unobserved", undefined]]) {
  const a = xl(2, sharing), b = xl(2, sharing === SEPARATE ? TANGLED : SEPARATE);
  const da = crossLeaseDiscount(2, sharing).pct;
  const db = crossLeaseDiscount(2, sharing === SEPARATE ? TANGLED : SEPARATE).pct;
  // A bigger discount must never come with a better score.
  if ((da < db && a < b) || (da > db && a > b)) { console.error(`  ✗ ${label}: discount and score disagree`); failures++; }
}
check("a bigger discount never comes with a better score", true, true);

// The unknown-share case: no LINZ share means no co-owner count, and the score
// falls back to the flat base rather than guessing at how shared the site is.
check("no share known falls back to the base", assessTitleType("cross_lease", { coOwners: null }).score, 5);
check("no context at all is the base", assessTitleType("cross_lease").score, 5);
ok("the flats-plan warning survives the grading", /flats plan/i.test(assessTitleType("cross_lease", { coOwners: 2, sharing: SEPARATE }).rationale));
ok("and the rationale says what it saw", /driveway/i.test(assessTitleType("cross_lease", { coOwners: 2, sharing: SEPARATE }).rationale));
ok("or admits it saw nothing", /didn't show/.test(assessTitleType("cross_lease", { coOwners: 2 }).rationale));

console.log("\nWhat is registered against the title — read, not guessed");
// This item came back 2/2 "Low concern", badged "Confirmed from the public
// record", against a record nobody had read. LINZ publishes the instruments, so
// it is scored from them now.
const { assessEncumbrances, assessEasements } = await import(join(root, "lib/scoring/title.ts"));
const { classifyInstrument, burdens } = await import(join(root, "lib/linz/encumbrances.ts"));
const k = (...kinds) => kinds.map((kind) => ({ kind }));

check("a clean title is a real finding, and scores like one", assessEncumbrances([]).score, 10);
check("a caveat is the serious one", assessEncumbrances(k("caveat")).score, 2);
check("a statutory charge sits between", assessEncumbrances(k("statutory")).score, 6);
// A mortgage is discharged on settlement; on a cross lease the flat lease IS
// the tenure. Counting either would make every ordinary house look encumbered.
check("a mortgage is not the buyer's burden", assessEncumbrances(k("mortgage")).score, 10);
check("nor is a flat lease", assessEncumbrances(k("lease", "lease")).score, 10);

check("no easements or covenants scores full", assessEasements([]).score, 10);
check("one easement is the ordinary case", assessEasements(k("easement")).score, 8);
check("two is worth a closer read", assessEasements(k("easement", "covenant")).score, 7);
// FLOORED AT 6. "There is a covenant here and we cannot read it" is a caution,
// not a fault — it might ban a second dwelling or specify a letterbox, and
// scoring as though we knew which would be invention.
check("many still floors at 6, because we can't read them", assessEasements(k("covenant","covenant","covenant","easement","easement")).score, 6);
ok("and it says the terms aren't readable", /NOT its terms|not public|paid download|not on the register/i.test(assessEasements(k("covenant")).rationale));
ok("a clean title explains what it checked", /memorials/i.test(assessEasements([]).rationale));
ok("a caveat tells the reader what to do about it", /solicitor/i.test(assessEncumbrances(k("caveat")).rationale));

console.log("\nAN UNPUBLISHED REGISTER IS NOT A CLEAN TITLE");
// Roughly 17% of LIVE titles carry no memorial rows at all — CB390/291 is live,
// freehold and 1,960m² with none. From out here that is indistinguishable from
// a title with nothing registered, and reading the absence of DATA as an absence
// of ENCUMBRANCES is how a buyer ends up reassured about a covenant nobody
// looked for. The report leaves the item unscored instead; these assert the flag
// that lets it tell the two apart.
const unpublished = { live: [], historicCount: 0, memorialsFound: 0 };
const clean = { live: [{ kind: "mortgage" }], historicCount: 4, memorialsFound: 5 };
ok("an unpublished register is flagged by memorialsFound", unpublished.memorialsFound === 0);
ok("a register that WAS read is not", clean.memorialsFound > 0);
// Both have an empty burden list; only one of them is an all-clear.
check("both look identically empty of burdens", burdens(unpublished).length, burdens(clean).length);

console.log("\nclassifying LINZ's own wording");
// The code list is 525 long and grows; classifying by LINZ's description rather
// than by a hand-written code map is what stops it rotting.
check("Easement Instrument", classifyInstrument("Easement Instrument"), "easement");
check("Land Transfer Plan Land Covenant", classifyInstrument("Land Transfer Plan Land Covenant"), "covenant");
check("Building Line Restriction", classifyInstrument("Building Line Restriction"), "covenant");
check("Caveat", classifyInstrument("Caveat against dealings"), "caveat");
check("Mortgage", classifyInstrument("Mortgage"), "mortgage");
check("Lease", classifyInstrument("Lease"), "lease");
// A removal must land in the same family as the thing it removes, or the
// counting stops being honest.
check("Discharge of Mortgage is still a mortgage instrument", classifyInstrument("Discharge of Mortgage"), "mortgage");
check("Partial Withdrawal of Caveat is still a caveat instrument", classifyInstrument("Partial Withdrawal of Caveat"), "caveat");

check("burdens exclude mortgages and leases",
  burdens({ live: [{ kind: "mortgage" }, { kind: "lease" }, { kind: "easement" }], historicCount: 0 }).length, 1);

if (failures) { console.error(`\n${failures} title check(s) FAILED.\n`); process.exit(1); }
console.log("\nAll title checks passed.\n");
