#!/usr/bin/env node
// The viewing gate. Run: npm run verify:viewing
//
// Two rules, and both are silent when they break.
//
// The gate decides whether the "For the agent" tab opens. It exists because the
// letter used to build itself the moment the report did — a costed schedule of
// defects, read off marketing photographs, ready to send to a vendor before
// anybody had walked through the house. If this returns `complete` a line too
// early, that is exactly what goes out again.
//
// The disposition decides what the letter may say about each item once the
// buyer HAS been. The dangerous cells are the two that used to be the only
// behaviour: an item nobody could reach, and an item nobody answered, both of
// which went out as costed claims.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { checklistStatus, dispositionFor, EMPTY_VIEWING } = await import(
  join(root, "lib/viewing/status.ts")
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

const items = (...keys) => keys.map((key) => ({ key }));
const answered = (viewedOn, map, photos = {}) => ({
  viewedOn,
  answers: Object.fromEntries(
    Object.entries(map).map(([k, answer]) => [k, { answer, answeredAt: "2026-08-24T00:00:00.000Z" }])
  ),
  photos: Object.fromEntries(
    Object.entries(photos).map(([k, score]) => [
      k,
      { itemId: k, showsItem: true, score, confidenceTier: 1, photoCount: 2 },
    ])
  ),
});

const THREE = items("ext_foundation", "leg_lim", "liv_insulation");

console.log("\nThe gate — nothing opens until every line is answered AND a date is recorded");
check("a fresh report is locked", checklistStatus(THREE, EMPTY_VIEWING).complete, false);
check(
  "two of three answered is locked",
  checklistStatus(THREE, answered("2026-08-24", { ext_foundation: "ok", leg_lim: "no_access" })).complete,
  false
);
check(
  "all three answered but no date is locked",
  checklistStatus(THREE, answered(null, { ext_foundation: "ok", leg_lim: "ok", liv_insulation: "ok" })).complete,
  false
);
check(
  "a date with nothing answered is locked",
  checklistStatus(THREE, answered("2026-08-24", {})).complete,
  false
);
check(
  "all three answered plus a date opens it",
  checklistStatus(THREE, answered("2026-08-24", { ext_foundation: "ok", leg_lim: "no_access", liv_insulation: "problem" })).complete,
  true
);
check(
  "\"couldn't inspect\" counts as an answer — a buyer who did all they could is not deadlocked",
  checklistStatus(THREE, answered("2026-08-24", { ext_foundation: "no_access", leg_lim: "no_access", liv_insulation: "no_access" })).complete,
  true
);
check(
  "a property with nothing to check still needs the date",
  checklistStatus([], EMPTY_VIEWING).complete,
  false
);
check("a property with nothing to check opens on the date alone", checklistStatus([], answered("2026-08-24", {})).complete, true);

console.log("\nThe gate counts what's left, so the tab can say it");
const partial = checklistStatus(THREE, answered(null, { ext_foundation: "problem" }));
check("outstanding", partial.outstanding, 2);
check("answered", partial.answered, 1);
check("problems", partial.problems, 1);
check("missingViewingDate is false while lines are still open", partial.missingViewingDate, false);
check(
  "missingViewingDate is true once they aren't",
  checklistStatus(THREE, answered(null, { ext_foundation: "ok", leg_lim: "ok", liv_insulation: "ok" })).missingViewingDate,
  true
);

console.log("\nA photograph the buyer took is an answer in itself");
check(
  "a photographed item needs no tick",
  checklistStatus(THREE, answered("2026-08-24", { leg_lim: "ok", liv_insulation: "ok" }, { ext_foundation: 3 })).complete,
  true
);
check(
  "and it still needs the viewing date",
  checklistStatus(THREE, answered(null, { leg_lim: "ok", liv_insulation: "ok" }, { ext_foundation: 3 })).complete,
  false
);
check(
  "a bad photo score counts as a problem found",
  checklistStatus(THREE, answered("2026-08-24", {}, { ext_foundation: 3 })).problems,
  1
);
check(
  "a good photo score does not",
  checklistStatus(THREE, answered("2026-08-24", {}, { ext_foundation: 8 })).problems,
  0
);
check(
  "a photo on an unrelated item doesn't answer this list",
  checklistStatus(THREE, answered("2026-08-24", {}, { ext_roof: 4 })).complete,
  false
);

console.log("\nWhat the letter may do with each item");
check("found sound → dropped from the case", dispositionFor("ok", true), "drop");
check("found sound, never scored → still dropped", dispositionFor("ok", false), "drop");
check("problem confirmed on a scored item → claimed", dispositionFor("problem", true), "claim");
check("problem found on something never scored → observed, not costed", dispositionFor("problem", false), "observe");
check("couldn't inspect a scored item → unverified, NOT claimed", dispositionFor("no_access", true), "unverified");
check("couldn't inspect an unscored item → unverified", dispositionFor("no_access", false), "unverified");
check("no answer on a Tier 1 photo finding → claimed", dispositionFor(undefined, true), "claim");
check("no answer on an unscored item → nothing to say", dispositionFor(undefined, false), "drop");

console.log("\nThe rule that started all this");
check(
  "nothing anyone failed to inspect can ever be costed",
  ["no_access"].every((a) => [true, false].every((scored) => dispositionFor(a, scored) === "unverified")),
  true
);
check(
  "the only route to a costed claim is a scored item that was seen, or never needed seeing",
  [undefined, "ok", "problem", "no_access"]
    .filter((a) => dispositionFor(a, true) === "claim")
    .map((a) => a ?? "unanswered"),
  ["unanswered", "problem"]
);

if (failures) {
  console.error(`\n${failures} viewing check(s) FAILED.\n`);
  process.exit(1);
}
console.log("\nAll viewing checks passed.\n");
