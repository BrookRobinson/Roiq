// ============================================================
// Property Map — live market rent from MBIE / Tenancy Services.
//
// tenancy.govt.nz backs its public "market rent" tool with two JSON endpoints.
// They need no key, but they reject anything that doesn't look like the widget's
// own XHR, so both calls send the same X-Requested-With + Referer pair the page
// sends. Figures come from bonds actually lodged with MBIE — the same dataset the
// report pipeline's web search goes looking for — so reading it directly gives an
// exact bedroom + dwelling-type match, the quartile spread and the sample size,
// for free and without spending tokens.
//
// SERVER ONLY. Responses are cached for 24h; the underlying data moves in
// six-month windows, so there is nothing to gain from asking more often.
// ============================================================

const BASE = "https://www.tenancy.govt.nz/market-rent-api";
const REFERER = "https://www.tenancy.govt.nz/rent-bond-and-bills/market-rent/";
const TIMEOUT_MS = 15_000;
const TTL_MS = 24 * 60 * 60 * 1000;

/** One row of the market-rent table: a dwelling type at a bedroom count. */
export interface SuburbRent {
  weekly: number;                  // median weekly rent, NZD
  lowerQuartile: number | null;
  upperQuartile: number | null;
  activeBonds: number;             // sample size behind the median
  dwellingType: string;            // "House" | "Flat" | "Apartment" | "All dwellings"
  bedrooms: number | null;         // null = the suburb-wide figure across all sizes
  period: string;                  // e.g. "01 Dec 2025 - 31 May 2026"
  location: string;                // e.g. "Auckland - Remuera"
  source: string;                  // citation for the report
  exactMatch: boolean;             // false = fell back to another type or the suburb median
}

interface Suggestion {
  value: string;                   // "Auckland - Remuera"
  data?: { city?: string };
}

interface RentRow {
  dwellingType: string;
  bedrooms: number;
  activeBonds: number;
  lower: number | null;
  median: number;
  upper: number | null;
}

interface LocationRent {
  location: string;
  period: string;
  rows: RentRow[];
  /** Suburb-wide summary from the Finder panel (all types, all sizes). */
  overall: { activeBonds: number; lower: number | null; median: number | null; upper: number | null };
}

// ── HTTP ────────────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/${path}`, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Referer: REFERER,
        Accept: "application/json, text/javascript, */*; q=0.01",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // never let a rent lookup take down a scoring run
  } finally {
    clearTimeout(timer);
  }
}

// ── Parsing ─────────────────────────────────────────────────────────────────

const money = (s: string): number | null => {
  const n = parseInt(s.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const cellText = (html: string): string =>
  html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();

/**
 * Pulls every "<type> × <bedrooms>" row out of the `Table` fragment. Each dwelling
 * type is its own <table>, titled by a `head_type` cell, with rows of
 * Size | Active bonds | Lower Quartile | Median Rent | Upper Quartile.
 */
function parseRentRows(tableHtml: string): RentRow[] {
  const rows: RentRow[] = [];
  for (const table of tableHtml.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const typeMatch = table.match(/class="head_type"[^>]*>([\s\S]*?)<\/td>/i);
    const dwellingType = typeMatch ? cellText(typeMatch[1]) : "";
    if (!dwellingType) continue;

    const body = table.match(/<tbody[\s\S]*?<\/tbody>/i)?.[0] ?? "";
    for (const tr of body.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []).map(cellText);
      if (cells.length < 4) continue;

      // "1 bedroom" / "3 bedrooms" / "5+ bedrooms"
      const beds = parseInt(cells[0].replace(/[^0-9]/g, ""), 10);
      const median = money(cells[3]);
      if (!Number.isFinite(beds) || median == null) continue;

      rows.push({
        dwellingType,
        bedrooms: beds,
        activeBonds: parseInt(cells[1].replace(/[^0-9]/g, ""), 10) || 0,
        lower: money(cells[2]),
        median,
        upper: cells[4] ? money(cells[4]) : null,
      });
    }
  }
  return rows;
}

/** The suburb-wide Bonds / Lower / Median / Upper strip above the tables. */
function parseOverall(finderHtml: string): LocationRent["overall"] {
  const value = (cls: string): number | null => {
    const m = finderHtml.match(new RegExp(`class="value ${cls}"[\\s\\S]*?class="price">([0-9,]+)<`, "i"));
    return m ? money(m[1]) : null;
  };
  // The markup reuses the single-figure classes for the four-up strip, in order:
  // mr_median = Bonds, mr_annual = Lower, mr_type = Median, mr_size = Upper.
  return {
    activeBonds: value("mr_median") ?? 0,
    lower: value("mr_annual"),
    median: value("mr_type"),
    upper: value("mr_size"),
  };
}

const parsePeriod = (html: string): string =>
  cellText(html.match(/class="search_details">([\s\S]*?)<\/span>/i)?.[1] ?? "") ||
  cellText(html.match(/class="text">([\s\S]*?)<\/span>/i)?.[1] ?? "");

// ── Lookup + cache ──────────────────────────────────────────────────────────

const locationCache = new Map<string, { at: number; value: Suggestion | null }>();
const rentCache = new Map<string, { at: number; value: LocationRent | null }>();
const fresh = (at: number) => Date.now() - at < TTL_MS;

/** Resolve a free-text suburb to the exact "City - Suburb" key the API expects. */
export async function resolveLocation(suburb: string, city?: string | null): Promise<Suggestion | null> {
  const query = suburb.trim();
  if (query.length < 3) return null;

  const key = `${query.toLowerCase()}|${(city ?? "").toLowerCase()}`;
  const hit = locationCache.get(key);
  if (hit && fresh(hit.at)) return hit.value;

  const res = await apiGet<{ suggestions?: Suggestion[] }>(
    `suggestLocations?query=${encodeURIComponent(query)}`
  );
  const all = res?.suggestions ?? [];

  // Suggestions come back as "City - Suburb", and picking the wrong one is worse
  // than picking none: suburb names repeat across NZ (Hillsborough is in both
  // Auckland and Christchurch), and MBIE treats some places as their own city, so
  // asking for "Papakura" returns its child suburbs — "Papakura - Ardmore" first
  // and the actual "Papakura - Papakura" further down. Match on the suburb half
  // before falling back to the city, and only then take what's on offer.
  const wanted = query.toLowerCase();
  const wantedCity = (city ?? "").trim().toLowerCase();
  const suburbOf = (s: Suggestion) => {
    const parts = s.value.split(" - ");
    return (parts.length > 1 ? parts.slice(1).join(" - ") : s.value).trim().toLowerCase();
  };
  const cityOf = (s: Suggestion) => (s.data?.city ?? s.value.split(" - ")[0]).trim().toLowerCase();

  const value =
    (wantedCity ? all.find((s) => suburbOf(s) === wanted && cityOf(s) === wantedCity) : undefined) ??
    all.find((s) => suburbOf(s) === wanted) ??
    (wantedCity ? all.find((s) => cityOf(s) === wantedCity) : undefined) ??
    all[0] ??
    null;

  locationCache.set(key, { at: Date.now(), value });
  return value;
}

async function fetchLocationRent(location: Suggestion): Promise<LocationRent | null> {
  const hit = rentCache.get(location.value);
  if (hit && fresh(hit.at)) return hit.value;

  // "Auckland - Remuera" → suburb "Remuera", city "Auckland".
  const [cityPart, ...suburbParts] = location.value.split(" - ");
  const suburb = suburbParts.join(" - ").trim() || cityPart.trim();
  const city = location.data?.city ?? cityPart.trim();

  const res = await apiGet<{ Finder?: string; Table?: string }>(
    `updateMarketValueLocation?ajax_suburb=${encodeURIComponent(suburb)}&ajax_city=${encodeURIComponent(city)}`
  );

  let value: LocationRent | null = null;
  if (res?.Table || res?.Finder) {
    value = {
      location: location.value,
      period: parsePeriod(res.Table ?? "") || parsePeriod(res.Finder ?? ""),
      rows: parseRentRows(res.Table ?? ""),
      overall: parseOverall(res.Finder ?? ""),
    };
  }

  rentCache.set(location.value, { at: Date.now(), value });
  return value;
}

/** The table caps out at "5+ bedrooms", so anything larger reads off that row. */
const bedKey = (beds: number): number => Math.min(Math.max(beds, 1), 5);

/**
 * Map our listing property types onto MBIE's bond dwelling types. Townhouses are
 * lodged under both Flat and House depending on the agent, so they get a
 * preference order rather than a single answer.
 */
function typePreference(propertyType: string | null | undefined): string[] {
  switch ((propertyType ?? "").toLowerCase()) {
    case "apartment":
    case "unit":
      return ["Apartment", "Flat", "House"];
    case "townhouse":
      return ["Flat", "House", "Apartment"];
    default:
      return ["House", "Flat", "Apartment"];
  }
}

/**
 * Live median weekly rent for a suburb, matched to the property's size and type.
 *
 * Falls back the way a valuer would, and says so via `exactMatch`:
 *   1. the right dwelling type at the right size
 *   2. another dwelling type at the right size (deepest bond sample wins)
 *   3. the right dwelling type at the NEAREST size MBIE has
 *   4. any dwelling type at the nearest size
 *   5. the suburb-wide median across all dwellings
 *
 * Step 3 matters: thin suburbs often stop at 3 bedrooms, and a 3-bed house median
 * is a far better read on a 4-bed house than a suburb-wide figure that averages in
 * one-bedroom apartments. Returns null when MBIE has nothing for the suburb at
 * all, so callers fall back to their own estimate instead of showing a made-up
 * number.
 */
export async function fetchMarketRent(
  suburb: string,
  opts: { city?: string | null; bedrooms?: number | null; propertyType?: string | null } = {}
): Promise<SuburbRent | null> {
  if (!suburb?.trim()) return null;

  const location = await resolveLocation(suburb, opts.city);
  if (!location) return null;

  const data = await fetchLocationRent(location);
  if (!data) return null;

  const beds = opts.bedrooms != null ? bedKey(opts.bedrooms) : null;
  const types = typePreference(opts.propertyType);

  const toRent = (row: RentRow, exactMatch: boolean): SuburbRent => {
    const size = `${row.bedrooms}${row.bedrooms === 5 ? "+" : ""} bed`;
    const asked = beds != null && row.bedrooms !== beds ? ` — nearest to ${beds} bed` : "";
    return {
      weekly: row.median,
      lowerQuartile: row.lower,
      upperQuartile: row.upper,
      activeBonds: row.activeBonds,
      dwellingType: row.dwellingType,
      bedrooms: row.bedrooms,
      period: data.period,
      location: data.location,
      source: `Tenancy Services market rent — ${data.location}, ${row.dwellingType.toLowerCase()}, ${size}${asked}, $${row.median}/wk from ${row.activeBonds} bonds${data.period ? ` (${data.period})` : ""}`,
      exactMatch,
    };
  };

  if (beds != null && data.rows.length) {
    // 1 + 2 — right size, best available type.
    const atSize = data.rows.filter((r) => r.bedrooms === beds);
    if (atSize.length) {
      for (const [i, type] of types.entries()) {
        const row = atSize.find((r) => r.dwellingType.toLowerCase() === type.toLowerCase());
        if (row) return toRent(row, i === 0);
      }
      return toRent([...atSize].sort((a, b) => b.activeBonds - a.activeBonds)[0], false);
    }

    // 3 + 4 — nearest size. Ties break to the LARGER row, which is the safer read
    // for a bigger house than averaging down.
    const nearest = (rows: RentRow[]): RentRow | undefined =>
      [...rows].sort(
        (a, b) =>
          Math.abs(a.bedrooms - beds) - Math.abs(b.bedrooms - beds) ||
          b.bedrooms - a.bedrooms ||
          b.activeBonds - a.activeBonds
      )[0];

    for (const type of types) {
      const row = nearest(data.rows.filter((r) => r.dwellingType.toLowerCase() === type.toLowerCase()));
      if (row) return toRent(row, false);
    }
    const any = nearest(data.rows);
    if (any) return toRent(any, false);
  }

  // 5 — no size given, or no rows at all. The suburb-wide median is still real data.
  if (data.overall.median != null) {
    return {
      weekly: data.overall.median,
      lowerQuartile: data.overall.lower,
      upperQuartile: data.overall.upper,
      activeBonds: data.overall.activeBonds,
      dwellingType: "All dwellings",
      bedrooms: null,
      period: data.period,
      location: data.location,
      source: `Tenancy Services market rent — ${data.location}, all dwellings, $${data.overall.median}/wk from ${data.overall.activeBonds} bonds${data.period ? ` (${data.period})` : ""}`,
      exactMatch: false,
    };
  }

  return null;
}
