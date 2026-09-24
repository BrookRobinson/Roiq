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
import { sunTracer, SUN_REACH_M } from "./sun";

type Tracer = NonNullable<Awaited<ReturnType<typeof sunTracer>>>;
import type { NearbyTypical } from "@/lib/scoring/land-value";
import { elevationSampler, type MetreFrame } from "./elevation";

const PARCELS_LAYER = "layer-50772";
export const RADIUS_M = 400;
/** A 3 × 3 grid of areas, five sections from each: 45 sections, spread evenly. */
const GRID = 3;
const PER_CELL = 5;
/** Fewer than this and the median isn't worth more than the national figure. */
const MIN_SAMPLE = 15;

/** Sun is the costly trace, so fewer sections, and the nearest ones. */
const SUN_SAMPLE = 20;
const SUN_MIN = 10;
const SUN_RADIUS_M = 150;

function inside(p: Pt, r: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if (r[i].y > p.y !== r[j].y > p.y && p.x < ((r[j].x - r[i].x) * (p.y - r[i].y)) / (r[j].y - r[i].y) + r[i].x) c = !c;
  }
  return c;
}

/**
 * Midwinter sun on the nearest sections' open ground, through the SAME routine
 * and zoom as the subject's — see sun.ts for why that matters. Only sections
 * within SUN_RADIUS_M, so the few tiles the subject needs cover them too.
 */
async function typicalSun(frame: MetreFrame, rings: Pt[][], shared?: Promise<Tracer | null>): Promise<number[]> {
  const centre = (r: Pt[]) => ({ x: r.reduce((s, p) => s + p.x, 0) / r.length, y: r.reduce((s, p) => s + p.y, 0) / r.length });
  const near = rings
    .map((r) => ({ r, d: Math.hypot(centre(r).x, centre(r).y) }))
    .filter((x) => x.d <= SUN_RADIUS_M)
    .sort((a, b) => a.d - b.d)
    .slice(0, SUN_SAMPLE)
    .map((x) => x.r);
  if (near.length < SUN_MIN) return [];
  const trace = await (shared ?? sunTracer(frame, SUN_REACH_M));
  if (!trace) return [];
  const out: number[] = [];
  for (const r of near) {
    const res = trace(r, 30);
    if (res) out.push(res.sharePct);
  }
  return out;
}

type Feature = {
  properties?: Record<string, unknown>;
  geometry?: { type?: string; coordinates?: unknown } | null;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

async function closeSections(
  frame: MetreFrame,
  wfs: (layer: string, cql: string, count?: number) => Promise<Feature[]>
): Promise<Pt[][]> {
  const dLat = SUN_RADIUS_M / frame.mPerDegLat, dLon = SUN_RADIUS_M / frame.mPerDegLon;
  const fs = await wfs(
    PARCELS_LAYER,
    `parcel_intent IN ('Fee Simple Title','DCDB') AND calc_area > 300 AND calc_area < 2000 AND ` +
      `BBOX(shape,${frame.lat - dLat},${frame.lng - dLon},${frame.lat + dLat},${frame.lng + dLon},'urn:ogc:def:crs:EPSG::4326')`,
    40
  );
  const toM = (c: number[]): Pt => ({ x: (c[0] - frame.lng) * frame.mPerDegLon, y: (c[1] - frame.lat) * frame.mPerDegLat });
  const out: Pt[][] = [];
  for (const f of fs) {
    const g = f.geometry;
    const raw = g?.type === "Polygon" ? (g.coordinates as number[][][])[0] : g?.type === "MultiPolygon" ? (g.coordinates as number[][][][])[0][0] : null;
    if (raw && raw.length >= 3) out.push(raw.map(toM));
  }
  return out;
}

export async function measureNearbyTypical(
  frame: MetreFrame,
  wfs: (layer: string, cql: string, count?: number) => Promise<Feature[]>,
  /** The subject's sun tracer, shared so the same tiles aren't fetched twice. */
  tracer?: Promise<Tracer | null>
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

  // The 3 × 3 grid puts only its centre cell near enough for the sun trace,
  // so the nearest sections are asked for separately.
  const closeRings = await closeSections(frame, wfs).catch(() => [] as Pt[][]);
  const sun = await typicalSun(frame, closeRings, tracer).catch(() => [] as number[]);

  if (workable.length < MIN_SAMPLE) return null;
  return {
    workablePct: median(workable),
    usablePct: usable.length >= MIN_SAMPLE ? median(usable) : null,
    sunSharePct: sun.length >= SUN_MIN ? median(sun) : null,
    sampled: workable.length,
    radiusM: RADIUS_M,
  };
}
