// ============================================================
// Geocoding against LINZ — Toitū Te Whenua, Land Information New Zealand.
//
// Why not Mapbox: we STORE the coordinates on the pin, and Mapbox's default
// geocoder is "temporary" — 100,000 free requests a month, but storing the
// results is outside its terms. The endpoint that permits storage has no free
// tier at all.
//
// LINZ publishes every New Zealand address with coordinates under an open
// Creative Commons licence: free, explicitly storable, and the authority the
// commercial geocoders are themselves approximating for NZ. Attribution is the
// only condition — see the map footer.
//
// Needs LINZ_API_KEY, free from https://data.linz.govt.nz (Account → API keys).
// ============================================================

// Layer 123113, "NZ Addresses" — verified against known Hokitika addresses.
// 105689 and 53353 are NOT valid here; both return InvalidParameterValue.
const LAYER = process.env.LINZ_ADDRESS_LAYER?.trim() || "123113";

export const hasLinzKey = (): boolean => !!process.env.LINZ_API_KEY?.trim();

/**
 * The coordinates LINZ holds for an address, or null.
 *
 * Null covers "no key", "no match" and "service down" alike, because the caller
 * treats all three the same way: leave the pin without coordinates so it stays
 * off the map. A property shown at the wrong place is worse than one that isn't
 * shown at all.
 */
export async function geocodeWithLinz(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.LINZ_API_KEY?.trim();
  if (!key || !address.trim()) return null;

  // LINZ stores an address as "176 Revell Street, Hokitika" — street and
  // locality, nothing more. Callers hand us richer strings ("…, West Coast,
  // New Zealand"), and a prefix match against those finds nothing at all, so
  // the extra parts are dropped before querying rather than after.
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^new zealand$|^nz$/i.test(p));

  const street = parts[0];
  if (!street) return null;
  const locality = parts[1] ?? null;

  // Street plus locality first — precise, and the common case.
  if (locality) {
    const hit = await queryLinz(key, `${street}, ${locality}`);
    if (hit) return hit;
  }

  // Then the street alone, keeping a result only if it's unambiguous or its
  // own locality matches. A street name repeats across New Zealand towns, so
  // taking the first of several would pin the property in the wrong place —
  // and a pin in the wrong town is worse than no pin.
  const byStreet = await queryLinz(key, street, locality);
  if (byStreet) return byStreet;

  // Last resort: drop a letter suffix off the street number. LINZ records
  // "271 Utopia Road" where a portal lists "271A" — the suffix is a
  // subdivision of the same section, so the base number puts the pin on the
  // right piece of land. Close enough for a map; never used for anything that
  // claims precision.
  const base = stripUnitSuffix(street);
  if (base) {
    const hit = locality ? await queryLinz(key, `${base}, ${locality}`) : null;
    return hit ?? (await queryLinz(key, base, locality));
  }

  return null;
}

/** "271A Utopia Road" → "271 Utopia Road". Null when there's no suffix to drop. */
function stripUnitSuffix(street: string): string | null {
  const m = /^(\d+)[a-z]\s+(.+)$/i.exec(street.trim());
  return m ? `${m[1]} ${m[2]}` : null;
}

/**
 * One CQL prefix query.
 *
 * `expectLocality` disambiguates: with several matches we take the one whose
 * own address names that locality, and otherwise nothing.
 */
async function queryLinz(
  key: string,
  prefix: string,
  expectLocality: string | null = null
): Promise<{ lat: number; lng: number } | null> {
  const cql = encodeURIComponent(`full_address ILIKE '${prefix.replace(/'/g, "''")}%'`);
  const url =
    `https://data.linz.govt.nz/services;key=${key}/wfs` +
    `?service=WFS&version=2.0.0&request=GetFeature` +
    `&typeNames=layer-${LAYER}&outputFormat=json&count=10&cql_filter=${cql}`;
  // Deliberately no `propertyName`: restricting the fields drops the geometry
  // from the response too, and the geometry is the entire point.

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`[geocode:linz] responded ${res.status} for "${prefix}"`);
      return null;
    }

    const body = (await res.json()) as {
      features?: {
        properties?: { full_address?: string };
        geometry?: { coordinates?: [number, number] };
      }[];
    };
    const features = body.features ?? [];
    if (features.length === 0) return null;

    const chosen =
      features.length === 1
        ? features[0]
        : expectLocality
          ? features.find((f) =>
              (f.properties?.full_address ?? "")
                .toLowerCase()
                .includes(expectLocality.toLowerCase())
            )
          : undefined;

    // Several candidates and no way to tell them apart — decline.
    if (!chosen) return null;

    const c = chosen.geometry?.coordinates;
    if (!Array.isArray(c) || c.length !== 2) return null;

    // GeoJSON is [lng, lat]; LINZ serves WGS84.
    const [lng, lat] = c;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    // New Zealand, generously bounded including the Chathams. A match outside
    // it means the query hit something unexpected, not a real NZ address.
    if (lat > -33 || lat < -48 || lng < 165 || lng > 180) {
      console.warn(`[geocode:linz] "${prefix}" resolved outside NZ (${lat}, ${lng}) — discarded`);
      return null;
    }

    return { lat, lng };
  } catch (err) {
    console.warn("[geocode:linz] failed:", (err as Error)?.message);
    return null;
  }
}
