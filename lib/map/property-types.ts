// ============================================================
// What KIND of property each listing is.
//
// The for-sale sitemaps give an address and nothing else, so 95% of the map was
// typed "not known yet" and a filter for sections or apartments had nothing to
// filter. OneRoof does publish the type — just not in the sitemap. Their search
// pages carry it in the URL:
//
//   /search/houses-for-sale/region_west-coast-44_property-type_section-9_page_1
//
// Every listing on that page is a section, stated by the portal itself. So the
// type comes from OneRoof's own categorisation rather than anything we infer,
// which is the same standard the rural sitemap already meets.
//
// robots.txt is `Allow: /` with two narrow Disallows that don't cover /search/,
// and these exact URLs are published in sitemap/houses-for-sale-serps-1.xml — a
// sitemap exists to be crawled. Still paced: this is a weekly sweep of static
// search pages, not a scraper hammering an API.
//
// Deliberately dependency-free, like ./discovery — the parsers are pure so they
// can be exercised without a network or a database.
// ============================================================

/** OneRoof's own property-type ids, and what this app calls each one. */
export const ONEROOF_TYPES: Record<string, string> = {
  "house-1": "house",
  "apartment-2": "apartment",
  // Nine listings nationally sit under Studio. It is an apartment without a
  // separate bedroom, and its own filter chip would be a chip nobody uses.
  "studio-3": "apartment",
  "townhouse-4": "townhouse",
  "unit-5": "unit",
  // "Home & Income" describes how a house EARNS, not what it is — a house with a
  // minor dwelling or a converted downstairs. Typed as a house; the second
  // dwelling is what the report's extra-dwelling handling is already for.
  "home-income-6": "house",
  "lifestyle-property-7": "lifestyle",
  "lifestyle-section-8": "lifestyle",
  "section-9": "section",
};

/** OneRoof's region tokens, from sitemap/houses-for-sale-serps-1.xml. */
export const ONEROOF_REGIONS = [
  "auckland-35", "bay-of-plenty-37", "canterbury-45", "central-north-island-55",
  "central-otago-lakes-district-50", "coromandel-48", "gisborne-region-38",
  "hawkes-bay-39", "manawatu-wanganui-56", "marlborough-51", "nelson-bays-43",
  "northland-34", "otago-46", "pacific-islands-54", "southland-47", "taranaki-40",
  "waikato-36", "wairarapa-52", "wellington-42", "west-coast-44",
] as const;

const BASE = "https://www.oneroof.co.nz";

export const searchUrl = (region: string, typeSlug: string, page: number) =>
  `${BASE}/search/houses-for-sale/region_${region}_property-type_${typeSlug}_page_${page}`;

export const regionUrl = (region: string) =>
  `${BASE}/search/houses-for-sale/region_${region}_page_1`;

/** Listing ids on a search page. 40 per page; fewer means the last page. */
export function parseListingIds(html: string): string[] {
  const ids = new Set<string>();
  for (const m of html.matchAll(
    /\/property\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/([A-Za-z0-9]{4,8})(?=["/?])/g
  )) {
    ids.add(m[1]);
  }
  return [...ids];
}

/**
 * How many listings of each type a region holds, from the filter links the
 * search page renders beside each option ("Section (88)").
 *
 * Read first so the crawl knows how many pages to ask for, rather than walking
 * until a page comes back short — the portal has already done the counting, and
 * guessing is either a missed page or a pointless fetch.
 */
export function parseTypeCounts(html: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of html.matchAll(
    /_property-type_([a-z-]+-\d+)_page_1"[^>]*>[^<]*<!-- --> \(<!-- -->(\d+)/g
  )) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

export const PAGE_SIZE = 40;

/** Pages needed for a count, capped so one odd number can't run away. */
export const pagesFor = (count: number, maxPages = 60) =>
  Math.min(maxPages, Math.ceil(count / PAGE_SIZE));

// ── The crawl ────────────────────────────────────────────────────────────────

const CONTACT_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://tectara.co.nz";
const USER_AGENT = `TectaraBot/1.0 (+${CONTACT_URL}; NZ property analysis)`;

async function fetchPage(url: string, attempts = 3): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, cache: "no-store" });
      if (res.ok) return await res.text();
      if (res.status !== 429 && res.status < 500) return null;
    } catch {
      /* transient */
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return null;
}

export interface TypeCrawlResult {
  /** portalId → our type name. */
  types: Map<string, string>;
  pagesRead: number;
  pagesFailed: number;
  /** Regions whose every type paged out cleanly — safe to trust as complete. */
  regionsComplete: string[];
}

/**
 * Read one region's listings, type by type.
 *
 * EVERY type is crawled, house included, rather than tagging the minority types
 * and calling the remainder houses. Elimination would be cheaper and it is the
 * wrong trade: a bare section wrongly recorded as a house is precisely the
 * failure the land-report rule exists to stop — it produces a confident
 * 1,000-point condition report on photographs of an empty paddock.
 */
export async function crawlRegionTypes(
  region: string,
  opts: { delayMs?: number; maxPagesPerType?: number } = {}
): Promise<TypeCrawlResult> {
  const { delayMs = 1200, maxPagesPerType = 300 } = opts;
  const types = new Map<string, string>();
  let pagesRead = 0;
  let pagesFailed = 0;
  let complete = true;

  const first = await fetchPage(regionUrl(region));
  if (!first) return { types, pagesRead: 0, pagesFailed: 1, regionsComplete: [] };
  pagesRead++;
  const counts = parseTypeCounts(first);

  for (const [slug, count] of Object.entries(counts)) {
    const ourType = ONEROOF_TYPES[slug];
    // An id we've never seen is a category OneRoof has added. Skip it rather
    // than guessing what it maps to, and let the listing stay "not known".
    if (!ourType || count === 0) continue;

    const pages = pagesFor(count, maxPagesPerType);
    for (let page = 1; page <= pages; page++) {
      await new Promise((r) => setTimeout(r, delayMs));
      const html = await fetchPage(searchUrl(region, slug, page));
      if (!html) {
        pagesFailed++;
        complete = false;
        continue;
      }
      pagesRead++;
      const ids = parseListingIds(html);
      for (const id of ids) types.set(id, ourType);
      // Stop on an EMPTY page, not a short one. Ids are de-duplicated per page,
      // and a page that links the same property twice comes back with 39 — which
      // read as "last page" and abandoned the rest of that type. West Coast
      // stopped at 12 of the 18 pages its own counts called for and left 177
      // listings untyped. The portal's count decides how many pages to ask for;
      // an empty page is the only reliable end.
      if (ids.length === 0) break;
    }
  }

  return { types, pagesRead, pagesFailed, regionsComplete: complete ? [region] : [] };
}
