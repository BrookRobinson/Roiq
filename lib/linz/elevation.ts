// ============================================================
// Ground height across a section, from the LINZ elevation model — SERVER ONLY.
//
// LINZ Basemaps serves the national elevation model (LiDAR where it has been
// flown) as "terrain-rgb" map tiles: each pixel's colour IS a height,
//   height = −10000 + (R·65536 + G·256 + B) × 0.1 m
// so reading ground height is fetching one to four small PNGs and decoding
// them. No elevation-file processing, no projection maths beyond the web tile
// grid, and the same key the aerial imagery already uses.
//
// The PNGs are decoded with Node's own zlib — a terrain tile is plain 8-bit
// RGB(A), and pulling in an image library for that would be a dependency
// carrying one function.
// ============================================================

import { inflateSync } from "node:zlib";
import type { HeightGrid } from "@/lib/scoring/site-slope";

interface Pt { x: number; y: number }

export interface MetreFrame {
  lat: number;
  lng: number;
  mPerDegLat: number;
  mPerDegLon: number;
}

const TILE = 256;
/** Below this the model has no ground there (sea, or no coverage). */
const NO_DATA = -100;

function decodePng(buf: Buffer): { w: number; h: number; ch: number; data: Buffer } | null {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  let p = 8, w = 0, h = 0, ct = 0, bd = 0;
  const idat: Buffer[] = [];
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : 0;
  if (!ch || bd !== 8 || !w || !h) return null;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[y * stride + x - ch] : 0;
      const b = y ? out[(y - 1) * stride + x] : 0;
      const c = x >= ch && y ? out[(y - 1) * stride + x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}

function inside(p: Pt, r: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if (r[i].y > p.y !== r[j].y > p.y && p.x < ((r[j].x - r[i].x) * (p.y - r[i].y)) / (r[j].y - r[i].y) + r[i].x) c = !c;
  }
  return c;
}

/**
 * Heights on a grid over the section, or null when the model couldn't be read.
 *
 * Null, never a guess: no key, a failed tile, or a section outside the model's
 * coverage all leave topography to the analysis's read, which is labelled as a
 * read. A section with SOME cells missing is measured on the cells it has.
 */
export async function fetchHeightGrid(
  frame: MetreFrame,
  parcel: Pt[],
  opts: { signal?: AbortSignal } = {}
): Promise<HeightGrid | null> {
  const key = process.env.LINZ_BASEMAP_KEY?.trim();
  if (!key || parcel.length < 3) return null;

  const xs = parcel.map((p) => p.x), ys = parcel.map((p) => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const w = Math.max(...xs) - minX, l = Math.max(...ys) - minY;
  // Half-metre cells on a town section; coarser on a big block so it stays quick.
  const step = Math.max(0.5, Math.sqrt(w * l) / 150);
  const zoom = step <= 0.6 ? 18 : step <= 1.2 ? 17 : 16;
  const cols = Math.max(1, Math.ceil(w / step)), rows = Math.max(1, Math.ceil(l / step));
  const scale = TILE * 2 ** zoom;

  const toPx = (p: Pt) => {
    const lat = frame.lat + p.y / frame.mPerDegLat;
    const lng = frame.lng + p.x / frame.mPerDegLon;
    const s = Math.sin((lat * Math.PI) / 180);
    return {
      px: ((lng + 180) / 360) * scale,
      py: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
    };
  };

  // Which cells are inside, and which tiles they need.
  const cells: { i: number; px: number; py: number }[] = [];
  const tiles = new Set<string>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = { x: minX + (c + 0.5) * step, y: minY + (r + 0.5) * step };
      if (!inside(p, parcel)) continue;
      const { px, py } = toPx(p);
      cells.push({ i: r * cols + c, px, py });
      // Bilinear sampling can reach one pixel over a tile edge.
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        tiles.add(`${Math.floor((px + dx) / TILE)}/${Math.floor((py + dy) / TILE)}`);
      }
    }
  }
  if (!cells.length || tiles.size > 16) return null;

  const decoded = new Map<string, ReturnType<typeof decodePng>>();
  try {
    await Promise.all(
      [...tiles].map(async (t) => {
        const res = await fetch(
          `https://basemaps.linz.govt.nz/v1/tiles/elevation/WebMercatorQuad/${zoom}/${t}.png?pipeline=terrain-rgb&api=${key}`,
          { signal: opts.signal, cache: "force-cache" }
        );
        decoded.set(t, res.ok ? decodePng(Buffer.from(await res.arrayBuffer())) : null);
      })
    );
  } catch (err) {
    console.warn("[elevation] tiles failed:", (err as Error)?.message);
    return null;
  }

  const heightAt = (gx: number, gy: number): number | null => {
    const img = decoded.get(`${Math.floor(gx / TILE)}/${Math.floor(gy / TILE)}`);
    if (!img) return null;
    const x = Math.min(img.w - 1, Math.max(0, Math.floor(gx) % TILE));
    const y = Math.min(img.h - 1, Math.max(0, Math.floor(gy) % TILE));
    const o = (y * img.w + x) * img.ch;
    const h = -10000 + (img.data[o] * 65536 + img.data[o + 1] * 256 + img.data[o + 2]) * 0.1;
    return h > NO_DATA ? h : null;
  };

  const z: (number | null)[] = new Array(cols * rows).fill(null);
  let got = 0;
  for (const { i, px, py } of cells) {
    // Bilinear between the four surrounding pixel centres.
    const fx = px - 0.5, fy = py - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const q = [heightAt(x0, y0), heightAt(x0 + 1, y0), heightAt(x0, y0 + 1), heightAt(x0 + 1, y0 + 1)];
    if (q.some((v) => v == null)) continue;
    const [a, b, c, d] = q as number[];
    z[i] = a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
    got++;
  }
  // Too little of the section inside the model's coverage to call it measured.
  if (got < cells.length * 0.8) return null;
  return { step, cols, rows, z };
}
