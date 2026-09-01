// ============================================================
// The actual shape of the section, and what already stands on it — SERVER ONLY.
//
// Development potential was land area minus the house footprint, which puts the
// same sentence on every large section and is wrong about a lot of them. LINZ
// publishes the parcel boundary and a national building-footprint layer, both
// free, so the question can be answered from the property's real geometry
// instead of from a subtraction.
//
//   NZ Primary Parcels   (layer-50772)   the section boundary
//   NZ Building Outlines (layer-101290)  3.2m footprints, aerial-derived
//   NZ Addresses: Roads  (layer-123110)  street geometry, so "the front of the
//                                        section" means something
//
// ── Two traps, both paid for ────────────────────────────────────────────────
//
// The building layer serves NZTM (EPSG:2193) by default, so a lat/lng bbox
// silently matches NOTHING — not an error, just zero rows, which reads exactly
// like a property with no buildings on it. `srsName=EPSG:4326` is not optional.
//
// And the CQL BBOX takes LAT FIRST under the urn-form CRS. Getting that backwards
// is the same silent zero. Both are asserted by the health endpoint rather than
// left to be rediscovered.
//
// ── Coordinates ─────────────────────────────────────────────────────────────
//
// Everything is projected to METRES local to the parcel centroid, by plain
// equirectangular scaling. Over a 100m section that is sub-centimetre against a
// proper projection, and it keeps lib/scoring/site-layout.ts free of geodesy so
// its verifier can hand it squares it drew itself.
// ============================================================

import type { Pt, Ring } from "@/lib/scoring/site-layout";

const PARCELS_LAYER = "layer-50772";
const BUILDINGS_LAYER = "layer-101290";
const ROADS_LAYER = "layer-123110";
/**
 * NZ Non-Primary Parcels — surveyed easements, land covenants, esplanade
 * strips. 784,660 easement polygons and 78,296 covenant ones nationally.
 */
const NON_PRIMARY_LAYER = "layer-50782";

/** Metres per degree of latitude. Constant enough at NZ latitudes. */
const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LON_EQ = 111_320;

/** A surveyed easement or covenant area lying over the section. */
export interface Burden {
  /** LINZ's `parcel_intent` — "Easement", "Covenant - Land", "Esplanade Strip". */
  kind: string;
  /** Its appellation, e.g. "Area C DP 626291" — quotable to a solicitor. */
  appellation: string | null;
  areaSqm: number | null;
  ring: Ring;
}

export interface SiteGeometry {
  /** Where the metre frame is centred, so imagery can be aligned to it. */
  anchor: { lat: number; lng: number; mPerDegLat: number; mPerDegLon: number };
  /** LINZ's appellation for the parcel, e.g. "Lot 9 DP 1195". */
  appellation: string | null;
  /** The parcel's own surveyed area, which beats anything the listing says. */
  parcelAreaSqm: number | null;
  parcel: Ring;
  buildings: Ring[];
  /** A point on the street this property fronts, in the same metre frame. */
  roadPoint: Pt | null;
  /**
   * Surveyed easement and covenant areas lying over this section.
   *
   * EMPTY IS NOT CLEAR. Easements in gross, some service easements and older
   * ones are described in words on the title with no surveyed extent at all, so
   * a section with no polygon here may still be burdened — the same trap as an
   * unpublished register, and it gets the same treatment in the copy.
   */
  burdens: Burden[];
}

type Feature = {
  properties?: Record<string, unknown>;
  geometry?: { type?: string; coordinates?: unknown } | null;
};

/** Every outer ring of a Polygon / MultiPolygon, as raw [lng, lat] pairs. */
function outerRings(geom: Feature["geometry"]): number[][][] {
  if (!geom?.coordinates) return [];
  if (geom.type === "Polygon") return [(geom.coordinates as number[][][])[0]];
  if (geom.type === "MultiPolygon") return (geom.coordinates as number[][][][]).map((p) => p[0]);
  return [];
}

function lineCoords(geom: Feature["geometry"]): number[][] {
  if (!geom?.coordinates) return [];
  if (geom.type === "LineString") return geom.coordinates as number[][];
  if (geom.type === "MultiLineString") return (geom.coordinates as number[][][]).flat();
  return [];
}

function ringCentroid(ring: number[][]): [number, number] {
  const x = ring.reduce((s, c) => s + c[0], 0) / ring.length;
  const y = ring.reduce((s, c) => s + c[1], 0) / ring.length;
  return [x, y];
}

function pointInRing(x: number, y: number, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const yi = r[i].y, yj = r[j].y;
    if (yi > y !== yj > y && x < ((r[j].x - r[i].x) * (y - yi)) / (yj - yi) + r[i].x) inside = !inside;
  }
  return inside;
}

/**
 * The section's geometry, from its address point.
 *
 * Returns null rather than a partial answer: without the parcel boundary there
 * is nothing to place anything inside, and a building list with no section to
 * put it in would be worse than no answer at all.
 */
export async function lookupSiteGeometry(
  lat: number,
  lng: number,
  roadName: string | null,
  /**
   * MUST request EPSG:4326. The parcel and building layers serve NZTM by
   * default and answer a lat/lng filter with zero rows rather than an error —
   * see the note on `wfs` in property-records.ts.
   */
  wfs: (layer: string, cql: string, count?: number) => Promise<Feature[]>
): Promise<SiteGeometry | null> {
  // CONTAINS takes lat first, matching the urn-form axis order used below.
  const parcels = await wfs(PARCELS_LAYER, `CONTAINS(shape, POINT(${lat} ${lng}))`, 3);
  const parcelFeature = parcels[0];
  const parcelRings = outerRings(parcelFeature?.geometry);
  if (parcelRings.length === 0) return null;
  const raw = parcelRings[0];

  const [lon0, lat0] = ringCentroid(raw);
  const mPerLon = M_PER_DEG_LON_EQ * Math.cos((lat0 * Math.PI) / 180);
  const toM = (c: number[]): Pt => ({ x: (c[0] - lon0) * mPerLon, y: (c[1] - lat0) * M_PER_DEG_LAT });
  const parcel = raw.map(toM);

  const lons = raw.map((c) => c[0]);
  const lats = raw.map((c) => c[1]);
  const [minLon, maxLon] = [Math.min(...lons), Math.max(...lons)];
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const bbox = (pad: number) =>
    `BBOX(shape,${minLat - pad},${minLon - pad},${maxLat + pad},${maxLon + pad},'urn:ogc:def:crs:EPSG::4326')`;

  const buildingFeatures = await wfs(BUILDINGS_LAYER, bbox(0), 60);
  const buildings: Ring[] = [];
  for (const f of buildingFeatures) {
    for (const ring of outerRings(f.geometry)) {
      const m = ring.map(toM);
      // The bbox catches the neighbour's garage across the fence. Only a
      // footprint whose CENTRE sits inside this parcel stands on this section —
      // counting the neighbour's would eat the buildable ground with a building
      // that isn't there.
      const c = ringCentroid(ring);
      if (pointInRing((c[0] - lon0) * mPerLon, (c[1] - lat0) * M_PER_DEG_LAT, parcel)) buildings.push(m);
    }
  }

  // The street. Only used to say "behind the house" rather than "to the
  // north-east", so a miss costs a nicety and never a measurement — which is
  // why it is filtered by NAME as well as position: the nearest line to a corner
  // section is often the side street, and a wrong frontage would flip front and
  // back in the copy.
  let roadPoint: Pt | null = null;
  if (roadName) {
    const escaped = roadName.replace(/'/g, "''");
    const roads = await wfs(
      ROADS_LAYER,
      `full_road_name = '${escaped}' AND ${bbox(0.002)}`,
      5
    ).catch(() => []);
    let best: { d: number; p: Pt } | null = null;
    const centre = { x: 0, y: 0 };
    for (const r of roads) {
      for (const c of lineCoords(r.geometry)) {
        const p = toM(c);
        const d = Math.hypot(p.x - centre.x, p.y - centre.y);
        if (!best || d < best.d) best = { d, p };
      }
    }
    roadPoint = best?.p ?? null;
  }

  // Easements and covenants over the section. Kept when they GENUINELY overlap
  // rather than merely sharing a bounding box: a bbox around a suburban section
  // catches the whole subdivision's right-of-way network, and 540 Wairakei Road
  // came back with twenty of them that way. A polygon counts if any of its
  // corners sits inside this parcel, or if it swallows a corner of it.
  const burdens: Burden[] = [];
  const nonPrimary = await wfs(NON_PRIMARY_LAYER, bbox(0), 60).catch(() => []);
  for (const f of nonPrimary) {
    const intent = typeof f.properties?.parcel_intent === "string" ? f.properties.parcel_intent : "";
    if (!/^(easement|covenant)/i.test(intent)) continue;
    for (const ring of outerRings(f.geometry)) {
      const m = ring.map(toM);
      const overlaps =
        m.some((pt) => pointInRing(pt.x, pt.y, parcel)) ||
        parcel.some((pt) => pointInRing(pt.x, pt.y, m));
      if (!overlaps) continue;
      burdens.push({
        kind: intent,
        appellation: typeof f.properties?.appellation === "string" ? f.properties.appellation : null,
        areaSqm: typeof f.properties?.calc_area === "number" ? Math.round(f.properties.calc_area) : null,
        ring: m,
      });
    }
  }

  const props = parcelFeature?.properties ?? {};
  return {
    anchor: { lat: lat0, lng: lon0, mPerDegLat: M_PER_DEG_LAT, mPerDegLon: mPerLon },
    appellation: typeof props.appellation === "string" ? props.appellation : null,
    parcelAreaSqm: typeof props.calc_area === "number" ? Math.round(props.calc_area) : null,
    parcel,
    buildings,
    roadPoint,
    burdens,
  };
}
