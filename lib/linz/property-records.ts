// ============================================================
// The official record for a property — SERVER ONLY.
//
// Toitū Te Whenua LINZ publishes, free and openly licensed, two things this
// product had been guessing at:
//
//   • the Record of Title — is it freehold, cross-lease, unit title or
//     leasehold, with its legal description and title area. The report used to
//     infer this from the word "freehold" appearing somewhere in the listing
//     HTML and label it "Indicative".
//   • the District Valuation Roll — the rating valuation. Capital value, land
//     value, improvements value, land area, BUILDING FLOOR AREA and bedrooms.
//
// That floor area is the reason this exists. A bare section was scored as a
// house because the portal's `floorAreaString:"0m²"` was read as "unknown", and
// a web search for a street with no number then supplied a neighbouring house's
// 195m² and $795,000. The valuation roll answers both questions from the public
// record instead of inferring them, and cannot return a different property.
//
// The same discipline as the geocoder applies throughout: an address that could
// mean more than one property returns NOTHING. A wrong record is far worse than
// a missing one — it is the wrong-house failure with an official-looking stamp.
//
// Needs LINZ_API_KEY (free, https://data.linz.govt.nz). Attribution is the only
// licence condition — see the map footer.
// ============================================================

const ADDRESS_LAYER = process.env.LINZ_ADDRESS_LAYER?.trim() || "123113";

/** Address → property. */
const PROPERTY_ADDRESS_TABLE = "table-115638";
/** The District Valuation Roll. */
const VALUATION_TABLE = "table-114085";
/** Property → title number. */
const PROPERTY_TITLE_TABLE = "table-113970";
/** The titles themselves — type, status, estate description. */
const TITLES_LAYER = "layer-50804";
/** Estate, share and legal description per title. */
const TITLE_ESTATES_TABLE = "table-51566";

/**
 * The roll records land area in HECTARES — a 675m² suburban section reads
 * 0.0675. Multiplying the wrong way puts a quarter-acre section at 6.75 km².
 */
const HECTARE_SQM = 10_000;

/** Beyond this the row is not describing a residential property we can use. */
const MAX_PLAUSIBLE_LAND_SQM = 50_000_000; // 5,000 ha

/**
 * The whole lookup is best-effort enrichment, so it gets a budget rather than
 * however long LINZ feels like taking. A prefix scan over 2.4 million addresses
 * has been seen to take tens of seconds, and no property report should wait
 * that long for data it can do without.
 */
const TIMEOUT_MS = 15_000;

/** Addresses repeat constantly in one session — the same listing reopened, the
 *  same suburb analysed twice. The public record does not change hourly. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: LinzPropertyRecord | null }>();

export interface LinzTitle {
  titleNo: string;
  /** "Freehold" | "Cross lease" | "Unit title" | "Leasehold" — LINZ's own wording. */
  type: string | null;
  status: string | null;
  estate: string | null;
  share: string | null;
  legalDescription: string | null;
  areaSqm: number | null;
  /** Cross-lease and unit titles share their spatial extent with the other flats. */
  sharedExtents: boolean | null;
}

export interface LinzValuation {
  capitalValue: number | null;
  landValue: number | null;
  improvementsValue: number | null;
  landAreaSqm: number | null;
  floorAreaSqm: number | null;
  bedrooms: number | null;
  zoning: string | null;
  propertyCategory: string | null;
  legalDescription: string | null;
  effectiveDate: string | null;
}

export interface LinzPropertyRecord {
  address: string;
  title: LinzTitle | null;
  valuation: LinzValuation | null;
}

export const hasLinzKey = (): boolean => !!process.env.LINZ_API_KEY?.trim();

/** CQL string literals escape a quote by doubling it. */
const q = (v: string): string => `'${v.replace(/'/g, "''")}'`;

async function wfs<T>(typeName: string, cql: string, count = 5, signal?: AbortSignal): Promise<T[]> {
  const key = process.env.LINZ_API_KEY?.trim();
  if (!key) return [];
  const url =
    `https://data.linz.govt.nz/services;key=${key}/wfs` +
    `?service=WFS&version=2.0.0&request=GetFeature` +
    `&typeNames=${typeName}&outputFormat=json&count=${count}` +
    `&cql_filter=${encodeURIComponent(cql)}`;
  try {
    const res = await fetch(url, { cache: "no-store", signal });
    if (!res.ok) {
      console.warn(`[linz] ${typeName} responded ${res.status}`);
      return [];
    }
    const body = (await res.json()) as { features?: { properties?: T }[] };
    return (body.features ?? []).map((f) => f.properties as T).filter(Boolean);
  } catch (err) {
    console.warn(`[linz] ${typeName} failed:`, (err as Error)?.message);
    return [];
  }
}

/** 0 in the roll means "not valued", not "worth nothing". */
const money = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

const positive = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * The LINZ address_id for this address, or null when it can't be pinned to one.
 *
 * Street names repeat across New Zealand towns, so several matches with no
 * locality to separate them is a decline — the same rule the geocoder uses, and
 * for the same reason: the cost of guessing is somebody else's property record.
 */
async function findAddressId(address: string, signal?: AbortSignal): Promise<{ id: number; full: string } | null> {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^new zealand$|^nz$/i.test(p));
  const street = parts[0];
  if (!street) return null;
  const locality = parts[1] ?? null;

  type Row = { address_id?: number; full_address?: string };
  const pick = (rows: Row[], expect: string | null): { id: number; full: string } | null => {
    const usable = rows.filter((r) => typeof r.address_id === "number");
    if (usable.length === 0) return null;
    const chosen =
      usable.length === 1
        ? usable[0]
        : expect
          ? usable.find((r) => (r.full_address ?? "").toLowerCase().includes(expect.toLowerCase()))
          : undefined;
    // Several candidates and nothing to tell them apart — decline.
    return chosen?.address_id != null
      ? { id: chosen.address_id, full: chosen.full_address ?? address }
      : null;
  };

  // Exact match on the indexed number and road-name columns first. A wildcard
  // ILIKE over 2.4 million addresses takes ~4.6s against ~1.0s for this, and
  // the difference decided whether the whole lookup fitted in its budget.
  const m = street.match(/^(\S+)\s+(.+)$/);
  if (m) {
    const [, number, roadName] = m;
    const exact =
      `full_address_number = ${q(number)} AND full_road_name = ${q(roadName)}` +
      (locality ? ` AND suburb_locality = ${q(locality)}` : "");
    const rows = await wfs<Row>(`layer-${ADDRESS_LAYER}`, exact, 10, signal);
    const hit = pick(rows, locality);
    if (hit) return hit;

    // Same street, no suburb filter — the listing's suburb wording and LINZ's
    // don't always agree ("Remuera" vs "Auckland Central").
    if (locality) {
      const wider = await wfs<Row>(
        `layer-${ADDRESS_LAYER}`,
        `full_address_number = ${q(number)} AND full_road_name = ${q(roadName)}`,
        10,
        signal
      );
      const hit2 = pick(wider, locality);
      if (hit2) return hit2;
    }
  }

  // Fallback: the prefix scan. Slower, but it catches the addresses that don't
  // split cleanly into a number and a road name.
  if (locality) {
    const rows = await wfs<Row>(
      `layer-${ADDRESS_LAYER}`,
      `full_address ILIKE ${q(`${street}, ${locality}%`)}`,
      10,
      signal
    );
    const hit = pick(rows, locality);
    if (hit) return hit;
  }

  const rows = await wfs<Row>(`layer-${ADDRESS_LAYER}`, `full_address ILIKE ${q(`${street}%`)}`, 10, signal);
  return pick(rows, locality);
}

async function fetchValuation(propertyId: string, signal?: AbortSignal): Promise<LinzValuation | null> {
  type Row = Record<string, unknown>;
  const rows = await wfs<Row>(VALUATION_TABLE, `unit_of_property_id = ${q(propertyId)}`, 1, signal);
  const r = rows[0];
  if (!r) return null;

  const ha = positive(r.land_area);
  const landAreaSqm = ha != null ? Math.round(ha * HECTARE_SQM) : null;

  return {
    capitalValue: money(r.capital_value),
    landValue: money(r.land_value),
    improvementsValue: money(r.improvements_value),
    landAreaSqm: landAreaSqm != null && landAreaSqm <= MAX_PLAUSIBLE_LAND_SQM ? landAreaSqm : null,
    floorAreaSqm: positive(r.building_total_floor_area),
    bedrooms: positive(r.no_of_bedrooms),
    zoning: typeof r.zoning === "string" ? r.zoning : null,
    propertyCategory: typeof r.property_category === "string" ? r.property_category : null,
    legalDescription: typeof r.legal_description === "string" ? r.legal_description : null,
    effectiveDate:
      typeof r.current_effective_valuation_date === "string" ? r.current_effective_valuation_date : null,
  };
}

async function fetchTitle(propertyId: string, signal?: AbortSignal): Promise<LinzTitle | null> {
  const refs = await wfs<{ title_no?: string }>(
    PROPERTY_TITLE_TABLE,
    `unit_of_property_id = ${q(propertyId)}`,
    5,
    signal
  );
  const titleNos = refs.map((r) => r.title_no).filter((t): t is string => !!t);
  if (titleNos.length === 0) return null;

  // In parallel: a property with four titles shouldn't cost four round trips
  // in series when the whole lookup is on a 15-second budget.
  const fetched = await Promise.all(
    titleNos.slice(0, 5).map(async (titleNo) => {
      const rows = await wfs<Record<string, unknown>>(TITLES_LAYER, `title_no = ${q(titleNo)}`, 1, signal);
      return { row: rows[0], titleNo };
    })
  );
  const live = fetched.filter(
    (f): f is { row: Record<string, unknown>; titleNo: string } =>
      !!f.row && String(f.row.status ?? "").toUpperCase() === "LIVE"
  );
  if (live.length === 0) return null;

  // More than one live title on the property (a flat plus its garage, say).
  // Reporting a type is only safe while they agree; if they disagree, the
  // property is more complicated than one label can describe, so we say nothing.
  const types = new Set(live.map(({ row }) => String(row.type ?? "")));
  if (types.size > 1) return null;

  const { row, titleNo } = live[0];
  const estates = await wfs<Record<string, unknown>>(
    TITLE_ESTATES_TABLE,
    `title_no = ${q(titleNo)}`,
    1,
    signal
  );
  const e = estates[0];

  return {
    titleNo,
    type: typeof row.type === "string" ? row.type : null,
    status: typeof row.status === "string" ? row.status : null,
    estate: e && typeof e.type === "string" ? e.type : null,
    share: e && typeof e.share === "string" ? e.share : null,
    legalDescription: e && typeof e.legal_description === "string" ? e.legal_description : null,
    areaSqm: e ? positive(e.area) : null,
    sharedExtents: typeof row.spatial_extents_shared === "boolean" ? row.spatial_extents_shared : null,
  };
}

/**
 * The public record for an address: its title and its rating valuation.
 *
 * Returns null rather than a partial guess whenever the address can't be
 * resolved to exactly one property. Every caller treats null as "we don't
 * know", which leaves the scraped values in place — the same failure mode the
 * app had before, rather than a new and more confident one.
 */
export async function lookupLinzPropertyRecord(
  address: string
): Promise<LinzPropertyRecord | null> {
  if (!hasLinzKey() || !address.trim()) return null;

  const cacheKey = address.trim().toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const value = await resolveRecord(address, controller.signal);
    // A null from a timeout is cached too, deliberately: if LINZ is slow now it
    // will be slow for the next caller, and a report must not queue behind it.
    cache.set(cacheKey, { at: Date.now(), value });
    return value;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveRecord(
  address: string,
  signal: AbortSignal
): Promise<LinzPropertyRecord | null> {
  const hit = await findAddressId(address, signal);
  if (!hit) return null;

  const props = await wfs<{ unit_of_property_id?: string }>(
    PROPERTY_ADDRESS_TABLE,
    `address_id = ${hit.id}`,
    2,
    signal
  );
  const ids = props.map((p) => p.unit_of_property_id).filter((v): v is string => !!v);
  // One address mapping to several properties is a subdivided or multi-unit
  // site; picking one of them would be a guess.
  if (ids.length !== 1) return null;

  const [valuation, title] = await Promise.all([
    fetchValuation(ids[0], signal),
    fetchTitle(ids[0], signal),
  ]);
  if (!valuation && !title) return null;

  return { address: hit.full, title, valuation };
}
