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

const LAYER = process.env.LINZ_ADDRESS_LAYER?.trim() || "105689"; // NZ Street Address

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
  const q = address.trim();
  if (!key || !q) return null;

  // LINZ matches on the full address string. Quotes are escaped for CQL by
  // doubling them, the same rule SQL uses.
  const cql = encodeURIComponent(`full_address ILIKE '${q.replace(/'/g, "''")}%'`);
  const url =
    `https://data.linz.govt.nz/services;key=${key}/wfs` +
    `?service=WFS&version=2.0.0&request=GetFeature` +
    `&typeNames=layer-${LAYER}&outputFormat=json&count=1&cql_filter=${cql}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`[geocode:linz] responded ${res.status}`);
      return null;
    }

    const body = (await res.json()) as {
      features?: { geometry?: { type?: string; coordinates?: [number, number] } }[];
    };
    const c = body.features?.[0]?.geometry?.coordinates;
    if (!Array.isArray(c) || c.length !== 2) return null;

    // GeoJSON is [lng, lat]; LINZ serves WGS84.
    const [lng, lat] = c;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    // New Zealand, generously bounded including the Chathams. A match outside
    // it means the query matched something unexpected, not a real NZ address.
    if (lat > -33 || lat < -48 || lng < 165 || lng > 180) {
      console.warn(`[geocode:linz] "${q}" resolved outside NZ (${lat}, ${lng}) — discarded`);
      return null;
    }

    return { lat, lng };
  } catch (err) {
    console.warn("[geocode:linz] failed:", (err as Error)?.message);
    return null;
  }
}
