// ============================================================
// What is this property zoned? — SERVER ONLY.
//
// The report used to end its development-potential finding with "subject to
// zoning — confirm zoning and coverage before you rely on it", which is the
// product failing at its job. The buyer came here so they would not have to go
// and look things up.
//
// New Zealand has no national district-plan service: zoning is published by
// each of the 67 territorial authorities. 50 of them expose it as a queryable
// ArcGIS REST layer (lib/zoning/councils.ts, generated from district-plans.nz),
// and for those the zone is simply fetched. For the remaining 17 the report
// says plainly that it could not retrieve the zone and links the council's own
// plan — because "we couldn't get this" is honest, while "go and check" is a
// chore handed back to the reader.
//
// Zone values come back CODED — Auckland returns `ZONE: 18`, not a name — so
// the layer's own coded-value domain is fetched and cached to turn 18 into
// "Residential - Mixed Housing Suburban Zone".
// ============================================================

import { ZONING_COUNCILS, type ZoningCouncil } from "@/lib/zoning/councils";

/** Councils are slow more often than LINZ is; a report shouldn't wait on one. */
const TIMEOUT_MS = 8_000;

/** Zones change when a plan changes — measured in years, not hours. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const zoneCache = new Map<string, { at: number; value: ZoneLookup | null }>();
/** Field metadata per layer, so the coded-value domain is fetched once. */
const schemaCache = new Map<string, Promise<ArcGisField[] | null>>();

interface ArcGisField {
  name: string;
  alias?: string;
  type?: string;
  domain?: { codedValues?: { code: string | number; name: string }[] } | null;
}

export interface ZoneLookup {
  /** The zone as the district plan names it, e.g. "Rural - Rural Production Zone". */
  zone: string;
  /** Broader grouping where the council publishes one ("Residential"). */
  group: string | null;
  council: string;
  /** The council's plan page, so the report can cite where this came from. */
  rulesUrl: string | null;
}

/** LINZ writes "Auckland"; the catalogue may write "Auckland Council". */
const normalise = (s: string): string =>
  s.toLowerCase().replace(/\b(council|district|city|region)\b/g, "").replace(/\s+/g, " ").trim();

export function councilFor(territorialAuthority: string | null | undefined): ZoningCouncil | null {
  if (!territorialAuthority) return null;
  const want = normalise(territorialAuthority);
  if (!want) return null;
  return (
    ZONING_COUNCILS.find((c) => normalise(c.territory) === want) ??
    ZONING_COUNCILS.find((c) => normalise(c.territory).startsWith(want)) ??
    null
  );
}

/** Is a zone retrievable for this council at all, or only published as a picture? */
export const hasZoningService = (territorialAuthority: string | null | undefined): boolean =>
  councilFor(territorialAuthority) !== null;

async function getJson(url: string, signal: AbortSignal): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal });
    if (!res.ok) return null;
    const body = (await res.json()) as Record<string, unknown>;
    // ArcGIS answers 200 with an `error` object rather than an HTTP status.
    return body && !body.error ? body : null;
  } catch {
    return null;
  }
}

async function fieldsFor(service: string, layer: number, signal: AbortSignal): Promise<ArcGisField[] | null> {
  const key = `${service}/${layer}`;
  const cached = schemaCache.get(key);
  if (cached) return cached;
  const p = getJson(`${service}/${layer}?f=json`, signal).then(
    (d) => (Array.isArray(d?.fields) ? (d!.fields as ArcGisField[]) : null)
  );
  schemaCache.set(key, p);
  return p;
}

/**
 * Which attribute holds the zone?
 *
 * There is no convention. Auckland returns a coded `ZONE: 18`; Wellington a
 * plain `DPZone: "Special Purpose Tertiary Education Zone"`; Christchurch calls
 * it `Type` with `TypeGroup` beside it — a name with no "zone" in it at all;
 * Dunedin carries both `Zone: "Residential"` and the more useful
 * `Sub_Zone: "General Residential 2"`.
 *
 * Fifty hand-written field mappings would rot silently as councils republish,
 * so candidates are SCORED instead: does the field name look like a zone, does
 * the VALUE read like a zone name, is it more specific than its neighbours.
 * Identifiers, status flags and symbology are pushed down, and anything that
 * won't decode to text is discarded — printing "Zone 18" to a buyer would be
 * worse than admitting we don't know.
 */
const ZONE_WORDS = /residential|rural|commercial|industrial|business|open space|special purpose|mixed use|centre|township|settlement|conservation|recreation|transport|road/i;
const NOT_ZONE_FIELDS = /(id|code|status|symbol|area|length|ref|notes|label|shape|object|created|removed|proposal|public|urban|location|category)/i;

function readZone(
  attrs: Record<string, unknown>,
  fields: ArcGisField[] | null
): { zone: string | null; group: string | null } {
  const byName = new Map((fields ?? []).map((f) => [f.name.toLowerCase(), f]));

  const decode = (name: string): string | null => {
    const raw = attrs[name];
    if (raw == null || raw === "") return null;
    const coded = byName.get(name.toLowerCase())?.domain?.codedValues;
    if (coded?.length) {
      const hit = coded.find((c) => String(c.code) === String(raw));
      return hit ? hit.name : null;
    }
    // An undecoded number names nothing a reader can use.
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  };

  const scored = Object.keys(attrs)
    .map((name) => {
      const value = decode(name);
      if (!value) return null;
      const field = byName.get(name.toLowerCase());
      const label = `${name} ${field?.alias ?? ""}`;
      let score = 0;
      if (/zon/i.test(label)) score += 3;
      if (/zone/i.test(value)) score += 2;
      if (ZONE_WORDS.test(value)) score += 1;
      if (NOT_ZONE_FIELDS.test(name)) score -= 3;
      if (/group|category/i.test(label)) score -= 2;
      // "Category: Zone" says what the layer is, not what this property is.
      if (/^zone$/i.test(value)) score -= 4;
      // Between a zone and its sub-zone, the specific one is the useful one.
      if (/sub/i.test(label)) score += 1;
      return { name, value, score, label };
    })
    .filter((c): c is { name: string; value: string; score: number; label: string } => c !== null)
    .sort((a, b) => b.score - a.score || b.value.length - a.value.length);

  const best = scored.find((c) => c.score > 0) ?? null;
  const group =
    scored.find(
      (c) => c !== best && /group|category|^zone$/i.test(c.label) && !/^zone$/i.test(c.value)
    ) ?? null;

  return { zone: best?.value ?? null, group: group?.value ?? null };
}

/** Layer indices per service, once discovered. */
const layerIndexCache = new Map<string, number | null>();

/**
 * Find the zone layer's index when the catalogue only gave its name.
 *
 * Matched on the layer's own name so a service that reorders its layers doesn't
 * quietly start returning a different dataset — an index alone would.
 */
async function discoverLayer(service: string, layerName: string): Promise<number | null> {
  const cached = layerIndexCache.get(service);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const meta = await getJson(`${service}?f=json`, controller.signal);
    const layers = (meta?.layers as { id?: number; name?: string }[] | undefined) ?? [];
    const want = layerName.trim().toLowerCase();
    const exact = layers.find((l) => (l.name ?? "").trim().toLowerCase() === want);
    const loose = layers.find((l) => /zon/i.test(l.name ?? ""));
    const found = (exact ?? loose)?.id ?? null;
    layerIndexCache.set(service, found);
    return found;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The district-plan zone at a point, or null when it genuinely can't be had.
 *
 * Null means one of: this council doesn't publish a queryable layer, the
 * service didn't answer inside its budget, or the point falls outside every
 * zone polygon. Callers must say which of those it is in the report — never
 * ask the reader to go and look it up.
 */
export async function lookupZone(
  lat: number,
  lng: number,
  territorialAuthority: string | null | undefined
): Promise<ZoneLookup | null> {
  const council = councilFor(territorialAuthority);
  if (!council) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // The catalogue names the layer but not always its index. Ask the service.
  const layer = council.layer ?? (await discoverLayer(council.service, council.layerName));
  if (layer == null) return null;

  const cacheKey = `${council.territory}:${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = zoneCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const query =
      `${council.service}/${layer}/query?` +
      new URLSearchParams({
        geometry: `${lng},${lat}`,
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        outFields: "*",
        returnGeometry: "false",
        f: "json",
      }).toString();

    const [data, fields] = await Promise.all([
      getJson(query, controller.signal),
      fieldsFor(council.service, layer, controller.signal),
    ]);

    const feature = (data?.features as { attributes?: Record<string, unknown> }[] | undefined)?.[0];
    const attrs = feature?.attributes;
    if (!attrs) {
      zoneCache.set(cacheKey, { at: Date.now(), value: null });
      return null;
    }

    const { zone, group } = readZone(attrs, fields);
    const value: ZoneLookup | null = zone
      ? { zone, group, council: council.territory, rulesUrl: council.rulesUrl }
      : null;
    zoneCache.set(cacheKey, { at: Date.now(), value });
    return value;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
