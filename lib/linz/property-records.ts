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

import { lookupEncumbrances, type TitleEncumbrances } from "./encumbrances";
import { lookupSiteGeometry, type SiteGeometry } from "./site-geometry";

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
 *
 * Raised from 15s when the register instruments and the parcel geometry were
 * added: the lookup now makes up to nine calls where it made four, and a budget
 * that fit the old shape silently truncated the new one — the timeout doesn't
 * fail loudly, it just returns whatever finished, so a slow address came back
 * with no title at all and looked like a property LINZ had never heard of.
 */
const TIMEOUT_MS = 25_000;

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
  /** LINZ's own wording for the undivided share, e.g. "1/1", "1/2", "1/3". */
  share: string | null;
  /**
   * That share as a fraction — 0.5 for "1/2". On a cross lease this is the part
   * of the site the owner actually holds, and the denominator is how many flats
   * hold it with them. Null when LINZ words the share in a way we can't parse,
   * which is not the same as 1: a share we can't read is a share we don't know.
   */
  shareFraction: number | null;
  /**
   * The DENOMINATOR of that share — how many parts the land is divided into,
   * which on a cross lease is how many flats sit on it.
   *
   * Carried rather than reconstructed, because `1 / shareFraction` only gives
   * it back when the numerator is 1, and it very often isn't: 2/3, 3/4, 2/5 and
   * 2/7 are all common. An owner holding two of five flats has a 0.4 share, and
   * 1 / 0.4 rounds to 3 — understating the number of parties whose consent they
   * need, which is exactly what the discount is measuring.
   */
  shareDenominator: number | null;
  legalDescription: string | null;
  /** The area of the WHOLE parcel on the title — shared, on a cross lease. */
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
  /** The address point, so the caller can ask a council what it's zoned. */
  lat: number | null;
  lng: number | null;
  /** LINZ's own territorial-authority name — the key into the zoning registry. */
  territorialAuthority: string | null;
  title: LinzTitle | null;
  valuation: LinzValuation | null;
  /**
   * What is currently registered against the title — easements, covenants,
   * caveats. Null means we could not read the register, which is a very
   * different statement from "the title is clear" and must never be rendered as
   * one. See lib/linz/encumbrances.ts.
   */
  encumbrances: TitleEncumbrances | null;
  /**
   * The parcel boundary and what stands on it. Null when the address point
   * doesn't land in a parcel — which is not "an empty section", so nothing
   * downstream may read it as one.
   */
  site: SiteGeometry | null;
}

export const hasLinzKey = (): boolean => !!process.env.LINZ_API_KEY?.trim();

interface AddressRow {
  address_id?: number;
  full_address?: string;
  territorial_authority?: string;
}

interface AddressHit {
  id: number;
  full: string;
  ta: string | null;
  lat: number | null;
  lng: number | null;
}

/** CQL string literals escape a quote by doubling it. */
const q = (v: string): string => `'${v.replace(/'/g, "''")}'`;

/**
 * `srs` is not optional for the spatial layers, and forgetting it fails SILENTLY.
 *
 * The parcel and building layers serve NZTM by default. Ask them for a lat/lng
 * point or bbox without `srsName=EPSG:4326` and they return ZERO ROWS — no
 * error, no warning, indistinguishable from a property with no parcel and no
 * buildings on it. That trap is written up in CLAUDE.md and it still caught this
 * file, because `lookupSiteGeometry` was handed a `wfs` that had no way to say
 * which CRS it wanted: the tables this module was written for have no geometry
 * at all, so the parameter had never been needed.
 */
async function wfs<T>(typeName: string, cql: string, count = 5, signal?: AbortSignal, srs?: string): Promise<T[]> {
  const key = process.env.LINZ_API_KEY?.trim();
  if (!key) return [];
  const url =
    `https://data.linz.govt.nz/services;key=${key}/wfs` +
    `?service=WFS&version=2.0.0&request=GetFeature` +
    `&typeNames=${typeName}&outputFormat=json&count=${count}` +
    (srs ? `&srsName=${srs}` : "") +
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

/**
 * Same query, keeping the geometry.
 *
 * `wfs` throws the geometry away because the tables it reads have none. The
 * address layer's point is the reason zoning can be looked up without a second
 * geocode, so that one query keeps it.
 */
async function wfsFeatures<T>(
  typeName: string,
  cql: string,
  count = 5,
  signal?: AbortSignal,
  srs?: string
): Promise<{ properties: T; geometry?: { type?: string; coordinates?: unknown } | null }[]> {
  const key = process.env.LINZ_API_KEY?.trim();
  if (!key) return [];
  const url =
    `https://data.linz.govt.nz/services;key=${key}/wfs` +
    `?service=WFS&version=2.0.0&request=GetFeature` +
    `&typeNames=${typeName}&outputFormat=json&count=${count}` +
    (srs ? `&srsName=${srs}` : "") +
    `&cql_filter=${encodeURIComponent(cql)}`;
  try {
    const res = await fetch(url, { cache: "no-store", signal });
    if (!res.ok) {
      console.warn(`[linz] ${typeName} responded ${res.status}`);
      return [];
    }
    const body = (await res.json()) as {
      features?: { properties?: T; geometry?: { type?: string; coordinates?: unknown } | null }[];
    };
    return (body.features ?? [])
      .filter((f) => f.properties)
      .map((f) => ({ properties: f.properties as T, geometry: f.geometry ?? null }));
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
async function findAddressId(address: string, signal?: AbortSignal): Promise<AddressHit | null> {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^new zealand$|^nz$/i.test(p));
  const street = parts[0];
  if (!street) return null;
  const locality = parts[1] ?? null;

  type Row = AddressRow;
  const pick = (
    features: { properties: Row; geometry?: { type?: string; coordinates?: unknown } | null }[],
    expect: string | null
  ): AddressHit | null => {
    const usable = features.filter((f) => typeof f.properties?.address_id === "number");
    if (usable.length === 0) return null;
    const chosen =
      usable.length === 1
        ? usable[0]
        : expect
          ? usable.find((f) =>
              (f.properties.full_address ?? "").toLowerCase().includes(expect.toLowerCase())
            )
          : undefined;
    // Several candidates and nothing to tell them apart — decline.
    const p = chosen?.properties;
    if (p?.address_id == null) return null;
    // The address layer serves a Point, so its coordinates are a flat [lng, lat]
    // — narrowed here rather than in the fetcher's type, which had to widen to
    // carry the parcel and building polygons as well.
    const coords = chosen?.geometry?.coordinates;
    const pt = Array.isArray(coords) && coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number"
      ? (coords as number[])
      : null;
    return {
      id: p.address_id,
      full: p.full_address ?? address,
      ta: p.territorial_authority ?? null,
      lat: pt ? pt[1] : null,
      lng: pt ? pt[0] : null,
    };
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
    const rows = await wfsFeatures<Row>(`layer-${ADDRESS_LAYER}`, exact, 10, signal);
    const hit = pick(rows, locality);
    if (hit) return hit;

    // Same street, no suburb filter — the listing's suburb wording and LINZ's
    // don't always agree ("Remuera" vs "Auckland Central").
    if (locality) {
      const wider = await wfsFeatures<Row>(
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
    const rows = await wfsFeatures<Row>(
      `layer-${ADDRESS_LAYER}`,
      `full_address ILIKE ${q(`${street}, ${locality}%`)}`,
      10,
      signal
    );
    const hit = pick(rows, locality);
    if (hit) return hit;
  }

  const rows = await wfsFeatures<Row>(
    `layer-${ADDRESS_LAYER}`,
    `full_address ILIKE ${q(`${street}%`)}`,
    10,
    signal
  );
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

/**
 * "1/2" → 0.5. Null for anything that isn't a plain fraction of one.
 *
 * Null rather than 1 on purpose. A share we cannot read is a share we do not
 * know, and defaulting it to the whole title would hand a cross-lease flat the
 * entire site — the exact overstatement this field exists to prevent.
 */
function parseShare(share: string): { fraction: number; denominator: number } | null {
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(share);
  if (!m) return null;
  const num = Number(m[1]);
  const den = Number(m[2]);
  if (!num || !den || num > den) return null;
  return { fraction: num / den, denominator: den };
}

/** "230 Sewell Street, Hokitika" → "Sewell Street", for the road-frontage lookup. */
function roadNameOf(address: string): string | null {
  const first = address.split(",")[0]?.trim() ?? "";
  const m = /^[0-9]+[A-Za-z]?\s+(.+)$/.exec(first);
  return m ? m[1].trim() : null;
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

  // EVERY estate on the title, not the first one LINZ happens to hand back.
  //
  // A cross lease carries two or more: a Fee Simple share in the whole site,
  // and a Leasehold estate in the flat itself. LINZ returns the leasehold row
  // FIRST, so asking for one row and taking it meant every cross-lease in the
  // country read back as `share: "1/1", area: null` — the ½ share and the site
  // area discarded before anything downstream could see them. NA89C/519:
  //
  //   Leasehold,  1/1, area —,    Flat 2 Deposited Plan 148763      ← we took this
  //   Fee Simple, 1/2, area 1200, Lot 39 Deposited Plan 134051      ← the land
  //
  // The fee simple estate is the one that owns ground, so it is the one that
  // can answer "how much land is this?" and "what fraction of it is theirs?".
  // A freehold title has exactly one, share 1/1, and is unaffected.
  const estates = await wfs<Record<string, unknown>>(
    TITLE_ESTATES_TABLE,
    `title_no = ${q(titleNo)}`,
    10,
    signal
  );
  const e = estates.find((r) => String(r.type ?? "").toLowerCase() === "fee simple") ?? estates[0];

  return {
    titleNo,
    type: typeof row.type === "string" ? row.type : null,
    status: typeof row.status === "string" ? row.status : null,
    estate: e && typeof e.type === "string" ? e.type : null,
    share: e && typeof e.share === "string" ? e.share : null,
    shareFraction: e && typeof e.share === "string" ? parseShare(e.share)?.fraction ?? null : null,
    shareDenominator: e && typeof e.share === "string" ? parseShare(e.share)?.denominator ?? null : null,
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

  // EVERYTHING THAT CAN RUN AT ONCE, RUNS AT ONCE.
  //
  // These used to go in series: valuation+title, then encumbrances, then the
  // site geometry. Each of the last two is two or three more round trips, and
  // adding five sequential calls to a 15-second budget that had nothing spare
  // pushed the WHOLE lookup over — 156 Buchanans Road came back at 15,004ms
  // with a null title, so a change made to add a picture quietly cost the
  // report its record of title.
  //
  // Only the encumbrances genuinely need the title number. The site geometry
  // needs the address point, which we already have, so it starts immediately.
  const sitePromise =
    hit.lat != null && hit.lng != null
      ? lookupSiteGeometry(hit.lat, hit.lng, roadNameOf(address), (layer, cql, count) =>
          // wfsFeatures, NOT wfs. `wfs` discards the geometry — deliberately,
          // because every table this module was written for is attribute-only —
          // so injecting it handed the parcel lookup a row with no polygon on
          // it. One row came back, `outerRings` found nothing to read, and the
          // section silently had no shape. And EPSG:4326 explicitly, or the
          // spatial layers answer in NZTM and match nothing at all.
          wfsFeatures<Record<string, unknown>>(layer, cql, count, signal, "EPSG:4326")
        ).catch((err) => {
          console.warn("[linz] site geometry failed:", (err as Error)?.message);
          return null;
        })
      : Promise.resolve(null);

  const [valuation, title] = await Promise.all([
    fetchValuation(ids[0], signal),
    fetchTitle(ids[0], signal),
  ]);
  if (!valuation && !title) {
    void sitePromise; // let it settle rather than leaving an unhandled rejection
    return null;
  }

  // The instruments need the title number, so this is the one thing that has to
  // wait — and it waits alongside the geometry rather than after it. A failure
  // is null rather than a throw: the rest of the record is worth having without
  // it, and "we couldn't read the register" must never render as "clear title".
  const [encumbrances, site] = await Promise.all([
    title
      ? lookupEncumbrances(title.titleNo, (table, cql, count) => wfs(table, cql, count, signal)).catch(
          (err) => {
            console.warn("[linz] encumbrances failed:", (err as Error)?.message);
            return null;
          }
        )
      : Promise.resolve(null),
    sitePromise,
  ]);

  return {
    address: hit.full,
    lat: hit.lat,
    lng: hit.lng,
    territorialAuthority: hit.ta,
    title,
    valuation,
    encumbrances,
    site,
  };
}
