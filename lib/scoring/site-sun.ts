// ============================================================
// Winter sun on the section, MEASURED from the LINZ surface model.
//
// "Partly shaded" was the analysis's read of listing photos — taken on a sunny
// day, from wherever flattered the garden. The surface model is the height of
// everything standing on the ground (buildings, trees) on a sub-metre grid, so
// whether a point in the section sees the sun can be traced, not guessed.
//
// THE SHORTEST DAY. Midwinter is when sun matters most to a New Zealand
// section and when a low sun is easiest to block, so it is the day measured:
// the sun's real path at this latitude, every SAMPLE_MIN minutes from sunrise
// to sunset, traced from open ground in the section toward the sun.
//
// ONLY SHADE THAT ISN'T YOURS. Shade cast from inside the boundary — the
// section's own trees and house — is not counted. A buyer can take a tree
// down; they cannot take down the neighbour's two storeys or the hill.
//
// Dependency-free: the height lookups are handed in, so a verify script can
// build a wall to the north and check the garden goes dark.
// ============================================================

export interface SunInput {
  lat: number;
  /** Open ground in the section: points (metres, +y north) with ground height. */
  points: { x: number; y: number; z: number }[];
  /** Height of whatever stands at (x, y) — surface model — or null. Metres frame. */
  surfaceAt: (x: number, y: number) => number | null;
  /** Ground height far out, for hills. Coarser; null where unknown. */
  terrainAt: (x: number, y: number) => number | null;
  /** True inside the section: shade from here is the owner's own and isn't counted. */
  isOwn: (x: number, y: number) => boolean;
}

export interface SunResult {
  /** Hours of direct sun on the section's open ground on the shortest day, averaged. */
  winterSunHours: number;
  /** Hours the sun is above the horizon that day at this latitude. */
  daylightHours: number;
  /** winterSunHours ÷ daylightHours, as a percentage. */
  sharePct: number;
  shade: "open" | "partly_shaded" | "heavily_shaded";
  points: number;
}

const SAMPLE_MIN = 15;
/** Midwinter declination (June solstice), degrees. */
const DECLINATION = 23.44;
/** Eye height above ground — a person, a washing line, a vege bed. */
const EYE_M = 1.0;
/** Near obstructions on the fine surface model. */
const NEAR_M = 100;
const NEAR_STEP = 1;
/** Hills on the coarse terrain model. */
const FAR_M = 1500;
const FAR_STEP = 15;
/** Below this the sun is behind the horizon haze anyway; not counted either way. */
const MIN_ELEV_DEG = 2;

/** Sun direction on the shortest day at a solar hour angle, in east/north/up. */
export function sunVector(latDeg: number, hourAngleDeg: number) {
  const φ = (latDeg * Math.PI) / 180, δ = (DECLINATION * Math.PI) / 180, H = (hourAngleDeg * Math.PI) / 180;
  return {
    east: -Math.cos(δ) * Math.sin(H),
    north: Math.sin(δ) * Math.cos(φ) - Math.cos(δ) * Math.cos(H) * Math.sin(φ),
    up: Math.sin(δ) * Math.sin(φ) + Math.cos(δ) * Math.cos(H) * Math.cos(φ),
  };
}

export function shadeFor(sharePct: number): SunResult["shade"] {
  return sharePct >= 70 ? "open" : sharePct >= 40 ? "partly_shaded" : "heavily_shaded";
}

export function measureSun(input: SunInput): SunResult | null {
  if (!input.points.length) return null;
  // The day, sunrise to sunset, as hour angles.
  const times: ReturnType<typeof sunVector>[] = [];
  let daylight = 0;
  for (let h = -180; h <= 180; h += SAMPLE_MIN / 4) {
    const v = sunVector(input.lat, h);
    if (v.up <= 0) continue;
    daylight += SAMPLE_MIN / 60;
    if (Math.asin(v.up) * (180 / Math.PI) >= MIN_ELEV_DEG) times.push(v);
  }
  if (!times.length) return null;

  let lit = 0;
  for (const p of input.points) {
    const z0 = p.z + EYE_M;
    for (const v of times) {
      const horiz = Math.hypot(v.east, v.north);
      const ex = v.east / horiz, ny = v.north / horiz, rise = v.up / horiz;
      let blocked = false;
      for (let d = NEAR_STEP; d <= NEAR_M && !blocked; d += NEAR_STEP) {
        const x = p.x + ex * d, y = p.y + ny * d;
        if (input.isOwn(x, y)) continue;
        const h = input.surfaceAt(x, y);
        if (h != null && h > z0 + d * rise) blocked = true;
      }
      for (let d = NEAR_M + FAR_STEP; d <= FAR_M && !blocked; d += FAR_STEP) {
        const h = input.terrainAt(p.x + ex * d, p.y + ny * d);
        if (h != null && h > z0 + d * rise) blocked = true;
      }
      if (!blocked) lit++;
    }
  }
  const share = lit / (input.points.length * times.length);
  // Lit share of the sampled times, over the hours the sun is up — the few
  // minutes under MIN_ELEV_DEG are too low to count either way.
  const counted = (times.length * SAMPLE_MIN) / 60;
  const hours = share * counted;
  const sharePct = Math.round((hours / daylight) * 100);
  return {
    winterSunHours: Math.round(hours * 10) / 10,
    daylightHours: Math.round(daylight * 10) / 10,
    sharePct,
    shade: shadeFor(sharePct),
    points: input.points.length,
  };
}
