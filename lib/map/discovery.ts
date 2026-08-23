// ============================================================
// Finding listings that exist, without analysing them.
//
// The map used to only know about properties someone had already paid to
// analyse, which meant it was empty everywhere nobody had looked. This fills
// in the rest: what's for sale, where, and when the portal last touched it.
// No Claude, no scoring — discovery is nearly free, and analysis is the part
// that costs $1.45 a go.
//
// ── Why only OneRoof ────────────────────────────────────────────────────────
// OneRoof's robots.txt is `Allow: /` and they publish a sitemap built for
// exactly this: https://www.oneroof.co.nz/sitemap/index/residential-for-sale-listings.xml
//
// realestate.co.nz is deliberately NOT crawled. Their robots.txt prohibits
// automated access in plain English, and names this business model outright:
// "This does not include any such access by websites that specifically
// aggregate property listings and/or information as part of their business."
// A user pasting one link and us fetching that page for them is a different
// act; harvesting their index nightly is the thing they've said not to do.
//
// Trade Me blocks automated access altogether — see lib/scraper/portals/trademe.
// ============================================================

export const ONEROOF_SITEMAP_INDEX =
  "https://www.oneroof.co.nz/sitemap/index/residential-for-sale-listings.xml";

/**
 * Identifies us honestly, so OneRoof can see who's asking and block us if they'd
 * rather. The URL has to be one that actually resolves — a contact address
 * nobody can reach is the same as not leaving one.
 */
// Built from the env var directly rather than importing lib/brand: the parsers
// below are deliberately dependency-free so scripts/verify-discovery.mjs can
// load this module with plain node, and one `@/` import would end that.
const CONTACT_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://tectara.co.nz";
const USER_AGENT = `TectaraBot/1.0 (+${CONTACT_URL}; NZ property analysis)`;

export interface DiscoveredListing {
  /** The listing page, canonical form. */
  url: string;
  /** OneRoof's own id from the URL tail — stable across re-listings of the page. */
  portalId: string;
  /** Street address, rebuilt from the URL slug: "53 Cowper Street". */
  address: string | null;
  /** "Greymouth" — OneRoof's town/suburb segment. */
  town: string | null;
  /** "West Coast". */
  region: string | null;
  /** The date the portal last changed the page, from <lastmod>. */
  lastModified: string | null;
}

// ── Pure parsers ────────────────────────────────────────────────────────────

/** Shard URLs out of a <sitemapindex>. One shard per region (Auckland has four). */
export function parseSitemapIndex(xml: string): string[] {
  return [...xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

/** <url> entries out of a shard, with their lastmod where present. */
export function parseUrlSet(xml: string): { url: string; lastModified: string | null }[] {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].flatMap((m) => {
    const block = m[1];
    const loc = /<loc>([^<]+)<\/loc>/.exec(block)?.[1]?.trim();
    if (!loc) return [];
    const lastmod = /<lastmod>([^<]+)<\/lastmod>/.exec(block)?.[1]?.trim() ?? null;
    return [{ url: loc, lastModified: lastmod }];
  });
}

/**
 * Pull what the URL already tells us, so a listing can be indexed without
 * fetching its page at all.
 *
 *   /property/west-coast/greymouth/53-cowper-street/0O51V
 *              region      town      street          id
 *
 * Returns null for anything that isn't a property page — the sitemaps are
 * clean today, but a shape change should drop the row rather than store a
 * mangled address that later looks like a real property.
 */
export function parseOneRoofUrl(raw: string): Omit<DiscoveredListing, "lastModified"> | null {
  let path: string;
  try {
    const u = new URL(raw);
    if (!/(^|\.)oneroof\.co\.nz$/i.test(u.hostname)) return null;
    path = u.pathname;
  } catch {
    return null;
  }

  const parts = path.split("/").filter(Boolean);
  // property / <region> / <town> / <street-slug> / <id>
  if (parts.length !== 5 || parts[0] !== "property") return null;

  const [, region, town, street, portalId] = parts;
  if (!portalId || !street) return null;

  return {
    url: `https://www.oneroof.co.nz${path}`,
    portalId,
    address: titleiseSlug(street),
    town: titleiseSlug(town),
    region: titleiseSlug(region),
  };
}

/** "53-cowper-street" → "53 Cowper Street"; "west-coast" → "West Coast". */
function titleiseSlug(slug: string): string | null {
  const words = decodeURIComponent(slug).split("-").filter(Boolean);
  if (words.length === 0) return null;
  return words
    .map((w) => (/^\d+[a-z]?$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

// ── Fetching ────────────────────────────────────────────────────────────────

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, cache: "no-store" });
    if (!res.ok) {
      console.warn(`[discovery] ${url} responded ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[discovery] ${url} failed:`, (err as Error)?.message);
    return null;
  }
}

export interface DiscoveryOptions {
  /**
   * Only return listings the portal touched on or after this date (YYYY-MM-DD).
   * The whole point of the nightly run — yesterday's date means "what's new".
   */
  since?: string | null;
  /** Restrict to regions whose shard URL contains one of these (e.g. "west-coast"). */
  regions?: string[] | null;
  /** Safety valve so a bad run can't fetch the entire country by accident. */
  maxShards?: number;
  /** Politeness gap between shard requests, ms. */
  delayMs?: number;
}

/**
 * One pass over OneRoof's for-sale index.
 *
 * Sequential with a pause between shards, deliberately. These are static files
 * served for crawlers and there are only about two dozen of them, so there is
 * nothing to gain from hammering — and being a well-behaved client is what
 * keeps `Allow: /` pointed at us.
 */
export async function discoverListings(
  opts: DiscoveryOptions = {}
): Promise<{ listings: DiscoveredListing[]; shardsRead: number; shardsFailed: number }> {
  const { since = null, regions = null, maxShards = 40, delayMs = 400 } = opts;

  const indexXml = await fetchText(ONEROOF_SITEMAP_INDEX);
  if (!indexXml) return { listings: [], shardsRead: 0, shardsFailed: 1 };

  let shards = parseSitemapIndex(indexXml);
  if (regions?.length) {
    shards = shards.filter((s) => regions.some((r) => s.includes(r)));
  }
  shards = shards.slice(0, maxShards);

  const listings: DiscoveredListing[] = [];
  const seen = new Set<string>();
  let shardsRead = 0;
  let shardsFailed = 0;

  for (const shard of shards) {
    const xml = await fetchText(shard);
    if (!xml) {
      shardsFailed++;
      continue;
    }
    shardsRead++;

    for (const entry of parseUrlSet(xml)) {
      if (since && (!entry.lastModified || entry.lastModified < since)) continue;

      const parsed = parseOneRoofUrl(entry.url);
      if (!parsed || seen.has(parsed.portalId)) continue;

      seen.add(parsed.portalId);
      listings.push({ ...parsed, lastModified: entry.lastModified });
    }

    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  return { listings, shardsRead, shardsFailed };
}
