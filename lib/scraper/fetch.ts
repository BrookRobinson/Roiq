const TIMEOUT_MS = 20_000;

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-NZ,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

/**
 * Fetches a URL, routing through ScraperAPI when SCRAPER_API_KEY is set.
 * Falls back to a direct fetch if ScraperAPI is not configured.
 */
export async function scrapeFetch(url: string): Promise<string> {
  const apiKey = process.env.SCRAPER_API_KEY;

  const fetchUrl = apiKey
    ? `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=false`
    : url;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(fetchUrl, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extracts all JSON-LD blocks from an HTML string.
 * Real estate portals commonly embed structured data this way.
 */
export function extractJsonLd(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else {
        results.push(parsed);
      }
    } catch {
      // malformed JSON-LD — skip
    }
  }

  return results;
}

/**
 * Extracts a <meta> tag content value by name or property attribute.
 */
export function extractMeta(html: string, nameOrProp: string): string | null {
  const regex = new RegExp(
    `<meta[^>]+(?:name|property)=["']${nameOrProp}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const match = regex.exec(html);
  return match ? match[1].trim() : null;
}

/**
 * Strips HTML tags and collapses whitespace.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses a price string like "$1,150,000" or "1150000" into a number.
 */
export function parsePrice(text: string): number | null {
  const clean = text.replace(/[^0-9.]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) || n === 0 ? null : n;
}

/**
 * Parses an area string like "185 m²" or "612sqm" into a number.
 */
export function parseArea(text: string): number | null {
  const match = text.match(/([0-9,]+(?:\.[0-9]+)?)\s*(?:m²|sqm|m2)/i);
  if (!match) return null;
  const n = parseFloat(match[1].replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function isHectareUnit(unitCode?: string | null, text?: string): boolean {
  // UN/CEFACT: HAR = hectare, MTK = square metre. Also accept a "ha" suffix in text.
  if (/^(HAR|HA)$/i.test((unitCode ?? "").trim())) return true;
  return !!text && /\bha\b|hectares?/i.test(text);
}

/**
 * Parses an area that may arrive as a number (330), a bare numeric string ("330"),
 * a suffixed string ("330 m²", "1,132m²", "0.12 ha"), or a schema.org
 * QuantitativeValue's value. Returns square metres, or null.
 *
 * The plain `parseArea` above REQUIRES a m²/sqm suffix, so it silently drops the
 * bare numeric strings portals embed in JSON-LD (e.g. floorSize.value = "330",
 * unitCode "MTK") — this is the area-aware version used for those fields.
 */
export function parseQuantitativeArea(value: unknown, unitCode?: string | null): number | null {
  if (value == null) return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return isHectareUnit(unitCode) ? Math.round(value * 10_000) : value;
  }

  const text = String(value).trim();
  if (!text) return null;

  const m = text.match(/([0-9][0-9,]*(?:\.[0-9]+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  if (isNaN(n) || n <= 0) return null;

  return isHectareUnit(unitCode, text) ? Math.round(n * 10_000) : n;
}

/**
 * Pulls an area out of an embedded JSON blob by trying a list of likely keys, e.g.
 * "floorArea":330, "floorAreaString":"330m²", "land_area_sqm":612, "lotSize":"1,012 m²".
 * Many portals ship the figures in a Next.js/__INITIAL_STATE__ payload rather than
 * as readable text, so a label-then-number regex over the rendered HTML misses them.
 */
export function extractAreaFromJson(html: string, keys: string[]): number | null {
  for (const key of keys) {
    const re = new RegExp(
      `"${key}"\\s*:\\s*"?([0-9][0-9,]*(?:\\.[0-9]+)?\\s*(?:m²|sqm|m2|ha|hectares?)?)"?`,
      "i"
    );
    const match = html.match(re);
    if (match) {
      const v = parseQuantitativeArea(match[1]);
      if (v) return v;
    }
  }
  return null;
}

/**
 * Parses a year string into a number, returning null if out of realistic range.
 */
export function parseYear(text: string): number | null {
  const match = text.match(/\b(1[89][0-9]{2}|20[0-2][0-9])\b/);
  if (!match) return null;
  return parseInt(match[1], 10);
}
