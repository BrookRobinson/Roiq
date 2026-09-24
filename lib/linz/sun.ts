// ============================================================
// Winter sun on sections, from the LINZ surface and ground models — SERVER ONLY.
//
// Three reads of the same national LiDAR:
//   • the SURFACE model (buildings and trees) at zoom 17, ~0.65 m — the
//     neighbours' houses and trees within NEAR_M;
//   • the GROUND model at the same zoom — to find open ground (surface within
//     a metre of ground: not under a roof or a canopy) and to stand on it;
//   • the GROUND model at zoom 14, ~7 m, out to 1.5 km — hills.
//
// The subject and the typical nearby sections go through ONE routine at ONE
// zoom. Reading the neighbours coarser averaged their buildings and trees down,
// so the neighbourhood read sunnier (70% against the subject's 33% in Hei Hei)
// and every section would have been discounted for shade it shares with its
// street. The trace itself is lib/scoring/site-sun.ts.
// ============================================================

import { measureSun, type SunResult } from "@/lib/scoring/site-sun";
import { elevationSampler, type MetreFrame } from "./elevation";

interface Pt { x: number; y: number }

const NEAR_M = 100;
const FAR_M = 1550;
/** Fewer open-ground points than this and the section is all roof and canopy — no answer. */
const MIN_POINTS = 10;

function inside(p: Pt, r: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if (r[i].y > p.y !== r[j].y > p.y && p.x < ((r[j].x - r[i].x) * (p.y - r[i].y)) / (r[j].y - r[i].y) + r[i].x) c = !c;
  }
  return c;
}

/**
 * Load the models over an area (metres around the frame's origin) and return a
 * tracer for any section inside it. Null when the models couldn't be read.
 */
export async function sunTracer(frame: MetreFrame, reachM: number) {
  const signal = AbortSignal.timeout(12_000);
  const toLL = (x: number, y: number) => ({ lat: frame.lat + y / frame.mPerDegLat, lng: frame.lng + x / frame.mPerDegLon });
  const near = reachM + NEAR_M, far = reachM + FAR_M;
  const [a, b, c, d] = [toLL(-near, -near), toLL(near, near), toLL(-far, -far), toLL(far, far)];
  const surface = elevationSampler(17, { signal, tileset: "elevation-dsm" });
  const ground = elevationSampler(17, { signal });
  const hills = elevationSampler(14, { signal });
  const [okS, okG] = await Promise.all([
    surface.load(a.lat, a.lng, b.lat, b.lng, 16),
    ground.load(a.lat, a.lng, b.lat, b.lng, 16),
    hills.load(c.lat, c.lng, d.lat, d.lng, 16),
  ]);
  if (!okS || !okG) return null;
  const surfaceAt = surface.inFrame(frame), groundAt = ground.inFrame(frame), hillsAt = hills.inFrame(frame);

  return (parcel: Pt[], maxPoints: number): SunResult | null => {
    const xs = parcel.map((p) => p.x), ys = parcel.map((p) => p.y);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const step = Math.max(1.5, Math.sqrt(((maxX - minX) * (maxY - minY)) / 400));
    const open: { x: number; y: number; z: number }[] = [];
    for (let x = minX + step / 2; x < maxX; x += step) {
      for (let y = minY + step / 2; y < maxY; y += step) {
        if (!inside({ x, y }, parcel)) continue;
        const g = groundAt(x, y), s = surfaceAt(x, y);
        if (g == null || s == null || s - g > 1) continue;
        open.push({ x, y, z: g });
      }
    }
    if (open.length < MIN_POINTS) return null;
    const stride = Math.max(1, Math.ceil(open.length / maxPoints));
    return measureSun({
      lat: frame.lat,
      points: open.filter((_, i) => i % stride === 0),
      surfaceAt,
      terrainAt: hillsAt,
      isOwn: (x, y) => inside({ x, y }, parcel),
    });
  };
}

/** How far out one tracer reaches: the subject and its nearest neighbours. */
export const SUN_REACH_M = 190;

/** One tracer for the subject AND the typical-neighbourhood trace — one set of tiles. */
export function sharedSunTracer(frame: MetreFrame, parcel: Pt[]) {
  const reach = Math.max(SUN_REACH_M, ...parcel.map((p) => Math.hypot(p.x, p.y)));
  return sunTracer(frame, reach).catch(() => null);
}
