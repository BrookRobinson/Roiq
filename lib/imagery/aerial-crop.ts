// SERVER-ONLY. Fetches LINZ aerial tiles for one section, stitches them, cuts
// out the section with its surveyed boundary drawn on, and returns a JPEG the
// analysis can look at beside the listing photos. See aerial-plan.ts for why.
//
// LINZ only, never the Mapbox fallback the map tiles use: LINZ Basemaps is
// CC BY 4.0, so analysing it is plainly allowed, and it is much sharper in New
// Zealand. No LINZ_BASEMAP_KEY, no imagery, or a mostly blank picture → null,
// and the report simply goes without an aerial.

import sharp from "sharp";
import type { SiteGeometry } from "@/lib/linz/site-geometry";
import { planAerialCrop, TILE, type AerialPlan } from "./aerial-plan";

export interface AerialCrop {
  buf: Buffer;
  media: "image/jpeg";
  zoom: number;
  metresPerPixel: number;
}

/** LINZ serves a ~190-byte blank WebP with a 200 outside its coverage. */
const BLANK_TILE_BYTES = 1000;
/** Most of the picture must be real imagery, or it isn't worth showing. */
const MIN_REAL_SHARE = 0.75;
const MAX_OUTPUT_PX = 1024;
const TIMEOUT_MS = 8000;

async function fetchTile(z: number, x: number, y: number, key: string, signal: AbortSignal): Promise<Buffer | null> {
  try {
    const res = await fetch(`https://basemaps.linz.govt.nz/v1/tiles/aerial/EPSG:3857/${z}/${x}/${y}.webp?api=${key}`, { signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length < BLANK_TILE_BYTES ? null : buf;
  } catch {
    return null;
  }
}

async function render(plan: AerialPlan, key: string, signal: AbortSignal): Promise<AerialCrop | null> {
  const jobs: Promise<{ dx: number; dy: number; buf: Buffer | null }>[] = [];
  for (let tx = plan.tileX0; tx <= plan.tileX1; tx++) {
    for (let ty = plan.tileY0; ty <= plan.tileY1; ty++) {
      jobs.push(fetchTile(plan.z, tx, ty, key, signal).then((buf) => ({ dx: (tx - plan.tileX0) * TILE, dy: (ty - plan.tileY0) * TILE, buf })));
    }
  }
  const tiles = await Promise.all(jobs);
  const real = tiles.filter((t) => t.buf);
  if (real.length / tiles.length < MIN_REAL_SHARE) return null;

  const width = (plan.tileX1 - plan.tileX0 + 1) * TILE;
  const height = (plan.tileY1 - plan.tileY0 + 1) * TILE;
  const canvas = await sharp({ create: { width, height, channels: 3, background: { r: 40, g: 40, b: 40 } } })
    .composite(real.map((t) => ({ input: t.buf as Buffer, left: t.dx, top: t.dy })))
    .png()
    .toBuffer();

  const { width: cw, height: ch } = plan.crop;
  const points = plan.outline.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  // The boundary in yellow, so the analysis knows which roof is this one.
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}"><polygon points="${points}" fill="none" stroke="#FFD400" stroke-width="${Math.max(2, Math.round(cw / 400))}" stroke-dasharray="10 6"/></svg>`
  );
  const buf = await sharp(canvas)
    .extract(plan.crop)
    .composite([{ input: svg, left: 0, top: 0 }])
    .resize(MAX_OUTPUT_PX, MAX_OUTPUT_PX, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return { buf, media: "image/jpeg", zoom: plan.z, metresPerPixel: plan.metresPerPixel };
}

/**
 * An aerial picture of this section, or null. Tries the sharpest zoom first
 * (urban LINZ imagery is 5–10 cm) and steps down where a rural area is only
 * flown at lower resolution or the section is too big for one picture.
 */
export async function fetchAerialCrop(site: SiteGeometry | null | undefined): Promise<AerialCrop | null> {
  const key = process.env.LINZ_BASEMAP_KEY?.trim();
  if (!key || !site?.parcel?.length) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    for (const z of [20, 19, 18]) {
      const plan = planAerialCrop(
        { lat: site.anchor.lat, lng: site.anchor.lng, mPerDegLat: site.anchor.mPerDegLat, mPerDegLon: site.anchor.mPerDegLon },
        site.parcel,
        z
      );
      if (!plan) continue;
      const out = await render(plan, key, ctrl.signal);
      if (out) return out;
    }
    return null;
  } catch (err) {
    console.warn("[aerial] crop failed:", (err as Error)?.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
