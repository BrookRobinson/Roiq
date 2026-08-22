#!/usr/bin/env node
// Listing-discovery parser check. Run: npm run verify:discovery
//
// These parsers turn a URL into an address that goes on a map and, later, into
// a report. A mangled parse doesn't throw — it stores a plausible-looking
// property that was never real, which is the failure CLAUDE.md warns about for
// seed listings. So the "must return null" cases matter as much as the rest.
//
// Imports the TypeScript module directly; needs Node 22.6+ for type stripping.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { parseSitemapIndex, parseUrlSet, parseOneRoofUrl } = await import(
  join(root, "lib/map/discovery.ts")
);

let failures = 0;
const is = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log("  ✓ " + label);
  else { console.error(`  ✗ ${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); failures++; }
};

console.log("\nparseSitemapIndex");
const INDEX = `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://www.oneroof.co.nz/sitemap/a-1.xml</loc></sitemap><sitemap><loc>https://www.oneroof.co.nz/sitemap/b-1.xml</loc></sitemap></sitemapindex>`;
is("pulls every shard", parseSitemapIndex(INDEX).length, 2);
is("keeps the URL intact", parseSitemapIndex(INDEX)[0], "https://www.oneroof.co.nz/sitemap/a-1.xml");
is("empty document is empty", parseSitemapIndex("<sitemapindex/>"), []);

console.log("\nparseUrlSet");
const SET = `<urlset><url><loc>https://www.oneroof.co.nz/property/west-coast/greymouth/53-cowper-street/0O51V</loc><lastmod>2026-08-20</lastmod></url><url><loc>https://www.oneroof.co.nz/property/otago/dunedin/9-high-st/AB12</loc></url></urlset>`;
is("reads both entries", parseUrlSet(SET).length, 2);
is("captures lastmod", parseUrlSet(SET)[0].lastModified, "2026-08-20");
is("a missing lastmod is null, not dropped", parseUrlSet(SET)[1].lastModified, null);

console.log("\nparseOneRoofUrl — the real shape");
const P = parseOneRoofUrl("https://www.oneroof.co.nz/property/west-coast/greymouth/53-cowper-street/0O51V");
is("street number stays a number", P?.address, "53 Cowper Street");
is("town is title case", P?.town, "Greymouth");
is("region is title case", P?.region, "West Coast");
is("portal id is the tail", P?.portalId, "0O51V");
is("url is canonicalised", P?.url, "https://www.oneroof.co.nz/property/west-coast/greymouth/53-cowper-street/0O51V");
is("a unit number keeps its letter", parseOneRoofUrl("https://www.oneroof.co.nz/property/otago/dunedin/12a-bay-road/XY9")?.address, "12A Bay Road");
is("www is optional", parseOneRoofUrl("https://oneroof.co.nz/property/otago/dunedin/9-high-street/AB1")?.portalId, "AB1");

console.log("\nparseOneRoofUrl — must return null, never a guess");
is("another portal", parseOneRoofUrl("https://www.realestate.co.nz/4567/residential/sale/9-high-st"), null);
is("a news article", parseOneRoofUrl("https://www.oneroof.co.nz/news/some-article-12345"), null);
is("a suburb page, not a property", parseOneRoofUrl("https://www.oneroof.co.nz/property/west-coast/greymouth"), null);
is("too many segments", parseOneRoofUrl("https://www.oneroof.co.nz/property/a/b/c/d/e"), null);
is("not a url", parseOneRoofUrl("53 Cowper Street, Greymouth"), null);
is("empty", parseOneRoofUrl(""), null);
is("a lookalike domain", parseOneRoofUrl("https://oneroof.co.nz.evil.com/property/a/b/c/D1"), null);

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll discovery-parser checks passed.\n");
process.exit(failures ? 1 : 0);
