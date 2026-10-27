// ============================================================
// Planning an aerial crop of ONE section: which map tiles to fetch, where to
// cut, and where the surveyed boundary falls on the picture.
//
// Pure, no imports — scripts/verify-photo-evidence.mjs loads it directly. The
// fetching and drawing live in aerial-crop.ts (server-only, needs sharp).
//
// Why an aerial at all: every listing photo is chosen by the agent. A roof seen
// from directly above is not — rust, moss, patched or mismatched sheets, an
// extension, a deck, a pool all show, and nobody stages a roof for a plane.
// ============================================================

/** The aerial picture, stored with a report so the reader can see what was read. */
export interface AerialPhoto {
  /** Its number in the analysis, one after the last listing photo. */
  number: number;
  /** A small JPEG as a data: URL. Credit: LINZ Basemaps, CC BY 4.0. */
  dataUrl: string;
}

/** Web-Mercator tile size in pixels. */
export const TILE = 256;

export interface AerialAnchor {
  lat: number;
  lng: number;
  /** Metres per degree, at the anchor (site-geometry.ts supplies these). */
  mPerDegLat: number;
  mPerDegLon: number;
}

export interface MetrePt {
  x: number; // metres east of the anchor
  y: number; // metres north of the anchor
}

export interface AerialPlan {
  z: number;
  /** Inclusive tile ranges to fetch. */
  tileX0: number;
  tileX1: number;
  tileY0: number;
  tileY1: number;
  /** The crop, in pixels of the stitched tile canvas. */
  crop: { left: number; top: number; width: number; height: number };
  /** The surveyed boundary, in pixels of the CROPPED image. */
  outline: { x: number; y: number }[];
  /** Ground metres per pixel at this zoom and latitude (before any resize). */
  metresPerPixel: number;
}

/** Margin round the section, so the roofline and the neighbours' edges show. */
export const PAD_M = 8;
/** Never crop tighter than this, or a small section is a few blurry pixels. */
export const MIN_SIDE_M = 36;
/** Refuse to fetch more tiles than this for one picture. */
export const MAX_TILES = 36;

function worldPx(lat: number, lng: number, z: number): { x: number; y: number } {
  const scale = TILE * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

const toLatLng = (a: AerialAnchor, p: MetrePt) => ({
  lat: a.lat + p.y / a.mPerDegLat,
  lng: a.lng + p.x / a.mPerDegLon,
});

/**
 * Plan the crop for a section's boundary at zoom `z`. Returns null when the
 * boundary is empty, or when the section is so large that it would need more
 * than MAX_TILES tiles at this zoom (the caller tries a lower zoom).
 */
export function planAerialCrop(anchor: AerialAnchor, parcel: MetrePt[], z: number): AerialPlan | null {
  if (parcel.length < 3) return null;
  const xs = parcel.map((p) => p.x);
  const ys = parcel.map((p) => p.y);
  let minX = Math.min(...xs) - PAD_M;
  let maxX = Math.max(...xs) + PAD_M;
  let minY = Math.min(...ys) - PAD_M;
  let maxY = Math.max(...ys) + PAD_M;
  // Square it up, and never smaller than MIN_SIDE_M.
  const side = Math.max(maxX - minX, maxY - minY, MIN_SIDE_M);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  minX = cx - side / 2;
  maxX = cx + side / 2;
  minY = cy - side / 2;
  maxY = cy + side / 2;

  // North-west and south-east corners in world pixels (y grows southward).
  const nw = worldPx(toLatLng(anchor, { x: minX, y: maxY }).lat, toLatLng(anchor, { x: minX, y: maxY }).lng, z);
  const se = worldPx(toLatLng(anchor, { x: maxX, y: minY }).lat, toLatLng(anchor, { x: maxX, y: minY }).lng, z);

  const tileX0 = Math.floor(nw.x / TILE);
  const tileX1 = Math.floor(se.x / TILE);
  const tileY0 = Math.floor(nw.y / TILE);
  const tileY1 = Math.floor(se.y / TILE);
  if ((tileX1 - tileX0 + 1) * (tileY1 - tileY0 + 1) > MAX_TILES) return null;

  const left = Math.round(nw.x - tileX0 * TILE);
  const top = Math.round(nw.y - tileY0 * TILE);
  const width = Math.max(1, Math.round(se.x - nw.x));
  const height = Math.max(1, Math.round(se.y - nw.y));

  const outline = parcel.map((p) => {
    const ll = toLatLng(anchor, p);
    const w = worldPx(ll.lat, ll.lng, z);
    return { x: w.x - tileX0 * TILE - left, y: w.y - tileY0 * TILE - top };
  });

  const metresPerPixel = (156543.03392 * Math.cos((anchor.lat * Math.PI) / 180)) / 2 ** z;
  return { z, tileX0, tileX1, tileY0, tileY1, crop: { left, top, width, height }, outline, metresPerPixel };
}
