// ============================================================
// Topography, MEASURED from the LINZ elevation model.
//
// It was the analysis judging "gentle slope, ~80% usable" from listing photos,
// which are taken to flatter a section and carry no level. NZTopo50's contours
// are 20 m apart, so nearly every suburban section sits between two lines and
// reads as flat. The national elevation model is bare-earth ground height on a
// sub-metre grid (LiDAR where it has been flown), so the slope of every square
// metre inside the boundary can be measured.
//
// Heights arrive in 0.1 m steps. Slope from neighbouring 1 m cells would be
// mostly that rounding, so each cell's slope is a least-squares PLANE fitted to
// the heights within PLANE_RADIUS_M of it — rounding averages out, a real bank
// doesn't.
//
// Bands match the Land tab's: flat is gentler than 1:20, gentle to 1:10,
// moderate to 1:5, steep beyond. USABLE is ground no steeper than 1:10 — usable
// with minor site works, no terracing.
//
// Dependency-free so a verify script can hand it surfaces with known slopes.
// ============================================================

export type SlopeBandId = "flat" | "gentle" | "moderate" | "steep";

/** Heights on a regular grid over the section; null where the cell is outside it. */
export interface HeightGrid {
  /** Cell size, metres. */
  step: number;
  cols: number;
  rows: number;
  /** Row-major, rows from the south. */
  z: (number | null)[];
}

export interface Terrain {
  /** Share of the section no steeper than 1:10. */
  usablePct: number;
  slopeBand: SlopeBandId;
  /** The typical (median) gradient across the section, as a percentage. */
  medianGradientPct: number;
  /** Highest point less lowest point, metres. */
  fallM: number;
  cells: number;
}

export const USABLE_MAX_GRADIENT_PCT = 10;
const PLANE_RADIUS_M = 2.5;

export function bandFor(gradientPct: number): SlopeBandId {
  return gradientPct < 5 ? "flat" : gradientPct < 10 ? "gentle" : gradientPct < 20 ? "moderate" : "steep";
}

export function measureTerrain(g: HeightGrid): Terrain | null {
  const { step, cols, rows, z } = g;
  const k = Math.max(1, Math.round(PLANE_RADIUS_M / step));
  const slopes: number[] = [];
  let lo = Infinity, hi = -Infinity;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const z0 = z[r * cols + c];
      if (z0 == null) continue;
      lo = Math.min(lo, z0);
      hi = Math.max(hi, z0);
      // Plane z = a·x + b·y + d by least squares over the window, centred on
      // this cell. Using the cell's own neighbours only — the ground outside
      // the boundary is somebody else's and says nothing about this section.
      let n = 0, sx = 0, sy = 0, sz = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
      for (let dr = -k; dr <= k; dr++) {
        for (let dc = -k; dc <= k; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          const zz = z[rr * cols + cc];
          if (zz == null) continue;
          const x = dc * step, y = dr * step;
          n++; sx += x; sy += y; sz += zz; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * zz; syz += y * zz;
        }
      }
      if (n < 6) continue;
      // Solve the 3×3 normal equations for a and b.
      const m = [
        [sxx, sxy, sx],
        [sxy, syy, sy],
        [sx, sy, n],
      ];
      const v = [sxz, syz, sz];
      const sol = solve3(m, v);
      if (!sol) continue;
      slopes.push(Math.hypot(sol[0], sol[1]) * 100);
    }
  }
  if (!slopes.length) return null;

  const sorted = [...slopes].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const usable = slopes.filter((s) => s <= USABLE_MAX_GRADIENT_PCT).length;
  return {
    usablePct: Math.round((usable / slopes.length) * 100),
    slopeBand: bandFor(median),
    medianGradientPct: Math.round(median * 10) / 10,
    fallM: Math.round((hi - lo) * 10) / 10,
    cells: slopes.length,
  };
}

/** "1:14" from a gradient percentage — how a buyer or a builder says it. */
export const asRatio = (pct: number): string => (pct <= 0.5 ? "flat" : `1:${Math.round(100 / pct)}`);

function solve3(m: number[][], v: number[]): number[] | null {
  const det = (a: number[][]) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const D = det(m);
  if (Math.abs(D) < 1e-9) return null;
  const col = (i: number) => m.map((row, r) => row.map((x, c) => (c === i ? v[r] : x)));
  return [det(col(0)) / D, det(col(1)) / D, det(col(2)) / D];
}
