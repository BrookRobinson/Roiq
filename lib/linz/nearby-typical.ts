// ============================================================
// What a TYPICAL section looks like around this one — SERVER ONLY.
//
// The land value starts from what a typical section fetches in the suburb, and
// the adjustments measure this section against typical. When "typical" was one
// national figure — 90% usable, 95% workable — every section in a hilly suburb
// was discounted against flat-suburb norms: the market had already priced
// Kelburn's slopes into Kelburn's sales, and then we took the slope off again.
// On 12 Upland Road that was about 40% of the land value.
//
// So typical is measured: residential sections within RADIUS_M of the property,
// read off the same LINZ parcels and elevation model, measured by the same
// rules as the subject, and the MEDIAN taken. Nearby rather than inside a
// suburb boundary on purpose — the suburb's sale prices come from these streets,
// and a hilly suburb can be flat in one valley and steep on the next ridge.
// ============================================================

import { measureSite, type Pt } from "@/lib/scoring/site-shape";
import { measureTerrain } from "@/lib/scoring/site-slope";
import type { NearbyTypical } from "@/lib/scoring/land-value";
import { elevationSampler, type MetreFrame } from "./elevation";

const PARCELS_LAYER = "layer-50772";
export const RADIUS_M = 400;
/** A 3 × 3 grid of areas, five sections from each: 45 sections, spread evenly. */
const GRID = 3;
const PER_CELL = 5;
/** Fewer than this and the median isn't worth more than the national figure. */
const MIN_SAMPLE = 15;

type Feature = {
  properties?: Record<string, unknown>;
  geometry?: { type?: string; coordinates?: unknown } | null;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export async function measureNearbyTypical(
  frame: MetreFrame,
  wfs: (layer: string, cql: string, count?: number) => Promise<Feature[]>
): Promise<NearbyTypical | null> {
  const dLat = RADIUS_M / frame.mPerDegLat;
  const dLon = RADIUS_M / frame.mPerDegLon;
  // Nine small queries on a 3 × 3 grid, in parallel, rather than one big one.
  // One query for 400 parcels took nine seconds; five per cell take well under
  // one, and the sample is spread over the whole neighbourhood rather than
  // whichever streets the server happens to list first.
  // Ordinary residential sections only: not road, not reserve, not a block of
  // farmland or a car-park-sized scrap. The area band is what "a section" is.
  const cells: Promise<Feature[]>[] = [];
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const s = frame.lat - dLat + (2 * dLat * i) / GRID, n = s + (2 * dLat) / GRID;
      const w = frame.lng - dLon + (2 * dLon * j) / GRID, e = w + (2 * dLon) / GRID;
      cells.push(
        wfs(
          PARCELS_LAYER,
          `parcel_intent IN ('Fee Simple Title','DCDB') AND calc_area > 300 AND calc_area < 2000 AND ` +
            `BBOX(shape,${s},${w},${n},${e},'urn:ogc:def:crs:EPSG::4326')`,
          PER_CELL
        ).catch(() => [] as Feature[])
      );
    }
  }
  const picked = (await Promise.all(cells)).flat();
  if (picked.length < MIN_SAMPLE) return null;

  const toM = (c: number[]): Pt => ({ x: (c[0] - frame.lng) * frame.mPerDegLon, y: (c[1] - frame.lat) * frame.mPerDegLat });
  const rings: Pt[][] = [];
  for (const f of picked) {
    const g = f.geometry;
    const raw =
      g?.type === "Polygon" ? (g.coordinates as number[][][])[0]
      : g?.type === "MultiPolygon" ? (g.coordinates as number[][][][])[0][0]
      : null;
    if (raw && raw.length >= 3) rings.push(raw.map(toM));
  }

  const workable: number[] = [];
  for (const r of rings) {
    const m = measureSite(r);
    if (m) workable.push(m.workablePct);
  }

  // Two-metre cells at zoom 16 are plenty for a TYPICAL figure, and the whole
  // neighbourhood is then about four tiles. At zoom 17 it was sixteen, and
  // LINZ serves a cold tile slowly: 3.2 s against 0.3 s.
  const sampler = elevationSampler(16, { signal: AbortSignal.timeout(10_000) });
  const usable: number[] = [];
  await Promise.all(
    rings.map(async (r) => {
      const g = await sampler.grid(frame, r, 2).catch(() => null);
      const t = g ? measureTerrain(g) : null;
      if (t) usable.push(t.usablePct);
    })
  );

  if (workable.length < MIN_SAMPLE) return null;
  return {
    workablePct: median(workable),
    usablePct: usable.length >= MIN_SAMPLE ? median(usable) : null,
    sampled: workable.length,
    radiusM: RADIUS_M,
  };
}
