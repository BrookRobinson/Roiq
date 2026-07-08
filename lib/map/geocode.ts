// Geocode a NZ address to lat/lng for the map. Uses the Mapbox Geocoding API
// with the token already in the project (NEXT_PUBLIC_MAPBOX_TOKEN). Best-effort:
// returns null on any failure so scoring a property never hard-fails on geocode.

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || !address.trim()) return null;
  try {
    const q = encodeURIComponent(address.trim());
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?country=NZ&limit=1&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: { center?: [number, number] }[] };
    const c = data.features?.[0]?.center;
    if (!c || c.length !== 2) return null;
    return { lng: c[0], lat: c[1] };
  } catch {
    return null;
  }
}
