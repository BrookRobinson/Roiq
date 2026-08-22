#!/usr/bin/env node
// Inbox-identity check. Run: npm run verify:email-key
//
// This decides whether two accounts are the same person. Merging two real
// people refuses one of them a free report they never used; missing an alias
// leaves the free tier open. Both are silent, so both are checked here — and
// the "must NOT merge" cases are the ones that matter most.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { emailKey } = await import(join(root, "lib/auth/email-key.ts"));

let failures = 0;
const same = (label, a, b) => {
  const ka = emailKey(a), kb = emailKey(b);
  if (ka !== null && ka === kb) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — ${a} → ${ka}, ${b} → ${kb}`); failures++; }
};
const differ = (label, a, b) => {
  const ka = emailKey(a), kb = emailKey(b);
  if (ka !== kb) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — both → ${ka}`); failures++; }
};
const is = (label, got, want) => {
  if (got === want) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};

console.log("\none inbox, many spellings — these MUST group");
same("case is ignored", "Brook@Gmail.com", "brook@gmail.com");
same("gmail ignores dots", "b.r.o.o.k@gmail.com", "brook@gmail.com");
same("gmail plus-tags", "brook+houses@gmail.com", "brook@gmail.com");
same("googlemail is gmail", "brook@googlemail.com", "brook@gmail.com");
same("dots and a tag together", "b.rook+2@googlemail.com", "brook@gmail.com");
same("outlook plus-tags", "brook+a@outlook.com", "brook@outlook.com");
same("icloud plus-tags", "brook+a@icloud.com", "brook@icloud.com");
same("xtra plus-tags", "brook+a@xtra.co.nz", "brook@xtra.co.nz");
same("surrounding whitespace", "  brook@gmail.com  ", "brook@gmail.com");

console.log("\ndifferent people — these must NOT be merged");
differ("different local parts", "brook@gmail.com", "bruce@gmail.com");
differ("different domains", "brook@gmail.com", "brook@xtra.co.nz");
differ("dots matter outside gmail", "john.smith@xtra.co.nz", "johnsmith@xtra.co.nz");
differ("dots matter on iCloud too", "john.smith@icloud.com", "johnsmith@icloud.com");
differ("an unknown provider keeps its +", "a+b@somenzisp.co.nz", "a@somenzisp.co.nz");
differ("me.com is not icloud.com", "brook@me.com", "brook@icloud.com");

console.log("\nnot an inbox");
is("null in, null out", emailKey(null), null);
is("empty string", emailKey(""), null);
is("no @", emailKey("brook"), null);
is("no domain", emailKey("brook@"), null);
is("no local part", emailKey("@gmail.com"), null);
is("domain with no dot", emailKey("brook@localhost"), null);
is("a tag with no mailbox", emailKey("+tag@gmail.com"), null);

console.log("\nshape");
is("returns the normalised address", emailKey("B.Rook+Houses@GoogleMail.com"), "brook@gmail.com");
is("leaves ordinary addresses alone", emailKey("brook.robbo@icloud.com"), "brook.robbo@icloud.com");

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll inbox-identity checks passed.\n");
process.exit(failures ? 1 : 0);
