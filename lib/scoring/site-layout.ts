// ============================================================
// WHERE the house sits, and whether anything will actually fit beside it.
//
// Development potential was arithmetic: land area minus the house footprint,
// and if the remainder cleared a threshold the report said "minor dwelling
// possible · likely" and put six figures on it. That produces the SAME sentence
// on every large section, and it is wrong about a lot of them, because it
// cannot tell the difference between:
//
//   • a house at the front of a 700m² section with one clear back yard, and
//   • a house in the middle of the same 700m², ringed by 4m strips
//
// Both have "427m² spare". Only one of them can take a second dwelling.
//
// 230 Sewell Street is the case that proved it. 811m², 427m² spare by
// subtraction, reported as "likely" — and on the actual parcel geometry it has
// THREE buildings, 435m² of genuinely clear ground, and no contiguous 7m × 10m
// rectangle anywhere on it. A minor dwelling does not fit.
//
// This module is pure and takes plain polygons in METRES, so the verifier can
// assert it against shapes it draws itself. Fetching the real ones is
// lib/linz/site-geometry.ts.
//
// ── What it does NOT do ─────────────────────────────────────────────────────
//
// It does not read the district plan. Site coverage, height-to-boundary, daylight
// planes and actual yard requirements live in the plan text, which this codebase
// has never read and does not pretend to. The margins here are stated
// assumptions, and the report prints them as assumptions — "on a 1.5m boundary
// setback" — rather than implying a council has agreed to anything.
// ============================================================

/** A point in metres, local to the parcel. */
export interface Pt {
  x: number;
  y: number;
}

/** Closed ring in metres. First and last point need not match. */
export type Ring = Pt[];

export interface SiteInput {
  /** The parcel boundary. */
  parcel: Ring;
  /** Every building footprint standing on it — house, garage, sleepout, shed. */
  buildings: Ring[];
  /**
   * A point on the street the property fronts, in the same metre frame. Lets the
   * finding say "behind the house" rather than "to the north-east", which is how
   * a buyer actually thinks about a section. Optional: without it the answer is
   * given relative to the house instead.
   */
  roadPoint?: Pt | null;
  /** Footprint we are trying to place. A 70m² minor dwelling ≈ 7m × 10m. */
  unit?: { width: number; length: number };
  /** Assumed clearance to the boundary, in metres. Stated, never implied as a rule. */
  boundarySetback?: number;
  /** Assumed clearance to the existing buildings, in metres. */
  buildingGap?: number;
}

export interface SiteLayout {
  /** Parcel area in m², from the geometry itself. */
  parcelAreaSqm: number;
  /** Ground covered by existing buildings, m². */
  builtAreaSqm: number;
  /** How many separate structures stand on the parcel. */
  buildingCount: number;
  /**
   * Ground that is genuinely available — inside the parcel, clear of every
   * building and its gap, and inside the boundary setback.
   *
   * This is the number that replaces "land minus footprint". On 230 Sewell
   * Street subtraction says 427m²; this says 435m² but in pieces too narrow to
   * build on, which is why the fit result matters more than either figure.
   */
  clearAreaSqm: number;
  /** The largest single rectangle of clear ground, in metres. */
  largestClear: { width: number; length: number } | null;
  /** True when `unit` fits inside one contiguous piece of clear ground. */
  unitFits: boolean;
  /** Where it fits, in plain words — "behind the house", "beside the house". */
  placement: string | null;
  /** Where the existing house sits — "at the front", "centrally", "at the rear". */
  housePosition: string | null;
  /** The margins this assumed, so the report can state rather than imply them. */
  assumed: { boundarySetback: number; buildingGap: number; unit: { width: number; length: number } };
}

const DEFAULT_UNIT = { width: 7, length: 10 }; // ≈70m², the granny-flat ceiling
const DEFAULT_SETBACK = 1.5;
const DEFAULT_GAP = 2;
/** Grid resolution. 0.5m is finer than any of this pretends to be accurate to. */
const STEP = 0.5;

function polygonArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    a += r[j].x * r[i].y - r[i].x * r[j].y;
  }
  return Math.abs(a / 2);
}

function pointInRing(p: Pt, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const yi = r[i].y, yj = r[j].y;
    if (yi > p.y !== yj > p.y && p.x < ((r[j].x - r[i].x) * (p.y - yi)) / (yj - yi) + r[i].x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Distance from a point to a segment — the boundary setback needs edges, not corners. */
function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distToRing(p: Pt, r: Ring): number {
  let d = Infinity;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    d = Math.min(d, distToSegment(p, r[j], r[i]));
  }
  return d;
}

/** Centroid of a ring, by vertex average — good enough for "which end is it at". */
function centroid(r: Ring): Pt {
  const x = r.reduce((s, p) => s + p.x, 0) / r.length;
  const y = r.reduce((s, p) => s + p.y, 0) / r.length;
  return { x, y };
}

/**
 * The largest all-free axis-aligned rectangle in a binary grid, by the standard
 * histogram method — O(rows × cols) rather than the O(n²) of testing every
 * candidate, which matters because a 50m section at 0.5m is 10,000 cells.
 *
 * AXIS-ALIGNED IS A REAL LIMIT and the report should not overstate what this
 * proves: a section whose boundaries run diagonally to the grid will measure
 * smaller than it truly is. It errs toward saying "doesn't fit", which is the
 * right direction for a number that would otherwise put six figures of upside
 * on somebody's decision.
 */
interface Rect { w: number; h: number; cx: number; cy: number }

function scanRectangles(
  free: boolean[][],
  cols: number,
  rows: number,
  holds: (w: number, h: number) => boolean
): { largest: Rect | null; fitting: Rect | null } {
  const heights = new Array<number>(cols).fill(0);
  let best: Rect | null = null;
  let bestArea = 0;
  // The BIGGEST rectangle is not necessarily one the unit fits in: a 20m × 3m
  // strip down a boundary beats a 7m × 10m corner on area and holds nothing.
  // Every maximal rectangle is tested, which is complete — any rectangle that
  // holds the unit is contained in one of them.
  let fit: Rect | null = null;
  let fitArea = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) heights[c] = free[r][c] ? heights[c] + 1 : 0;

    const stack: number[] = [];
    for (let c = 0; c <= cols; c++) {
      const h = c === cols ? 0 : heights[c];
      while (stack.length && heights[stack[stack.length - 1]] >= h) {
        const top = stack.pop() as number;
        const height = heights[top];
        const left = stack.length ? stack[stack.length - 1] + 1 : 0;
        const width = c - left;
        const area = width * height;
        if (height > 0) {
          const rect = { w: width, h: height, cx: (left + c) / 2, cy: r - height / 2 + 0.5 };
          if (area > bestArea) { bestArea = area; best = rect; }
          if (area > fitArea && holds(width, height)) { fitArea = area; fit = rect; }
        }
      }
      stack.push(c);
    }
  }
  return { largest: best, fitting: fit };
}

/** Can a w×h unit (either way round) sit inside a rect of the given cell dims? */
function rectHolds(rw: number, rh: number, uw: number, uh: number): boolean {
  return (rw >= uw && rh >= uh) || (rw >= uh && rh >= uw);
}

/**
 * Describe where something sits relative to the house and the street.
 *
 * With a road point this says "behind the house" or "between the house and the
 * street", which is the language a buyer uses. Without one it falls back to a
 * compass bearing off the house, which is still specific to this property and
 * never invents a frontage we could not establish.
 */
function describePlacement(spot: Pt, house: Pt | null, road: Pt | null): string {
  if (!house) return "on the section";
  if (road) {
    const roadDist = Math.hypot(spot.x - road.x, spot.y - road.y);
    const houseDist = Math.hypot(house.x - road.x, house.y - road.y);
    if (roadDist > houseDist + 3) return "behind the house, away from the road";
    if (roadDist < houseDist - 3) return "between the house and the road";
    return "beside the house";
  }
  const dx = spot.x - house.x, dy = spot.y - house.y;
  if (Math.hypot(dx, dy) < 3) return "beside the house";
  const dirs = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"];
  const idx = Math.round((Math.atan2(dy, dx) * 4) / Math.PI + 8) % 8;
  return `to the ${dirs[idx]} of the house`;
}

/** Where the existing house sits on its section, relative to the street. */
function describeHousePosition(house: Pt | null, parcel: Ring, road: Pt | null): string | null {
  if (!house) return null;
  if (!road) return null;
  // PROJECTED onto the road→section axis, not straight-line distance from the
  // road point. Distance alone is distorted by the far corners of the section:
  // a house dead-centre on a 20×35m parcel measured 0.377 down the range and
  // read as "toward the front", because the two far corners are further from
  // the road than the middle of the back fence is.
  const mid = centroid(parcel);
  const ax = mid.x - road.x, ay = mid.y - road.y;
  const len = Math.hypot(ax, ay);
  if (len < 1) return null;
  const ux = ax / len, uy = ay / len;
  const proj = (p: Pt) => (p.x - road.x) * ux + (p.y - road.y) * uy;
  const pts = parcel.map(proj);
  const near = Math.min(...pts), far = Math.max(...pts);
  if (far - near < 1) return null;
  const t = (proj(house) - near) / (far - near);
  if (t < 0.38) return "toward the front of the section, near the road";
  if (t > 0.62) return "toward the rear of the section";
  return "centrally on the section";
}

/**
 * Read a section's actual layout.
 *
 * Every measurement comes from the geometry. Nothing here is a threshold on
 * total area, which is the whole point: the question was never "is the section
 * big enough", it was "is there a piece of it big enough, in one piece".
 */
export function readSiteLayout(input: SiteInput): SiteLayout {
  const unit = input.unit ?? DEFAULT_UNIT;
  const setback = input.boundarySetback ?? DEFAULT_SETBACK;
  const gap = input.buildingGap ?? DEFAULT_GAP;
  const assumed = { boundarySetback: setback, buildingGap: gap, unit };

  const parcel = input.parcel;
  const parcelAreaSqm = Math.round(polygonArea(parcel));
  const buildings = input.buildings.filter((b) => b.length >= 3);
  const builtAreaSqm = Math.round(buildings.reduce((s, b) => s + polygonArea(b), 0));

  const xs = parcel.map((p) => p.x), ys = parcel.map((p) => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const cols = Math.max(1, Math.ceil((Math.max(...xs) - minX) / STEP));
  const rows = Math.max(1, Math.ceil((Math.max(...ys) - minY) / STEP));

  const free: boolean[][] = [];
  let freeCells = 0;
  for (let r = 0; r < rows; r++) {
    const row = new Array<boolean>(cols).fill(false);
    for (let c = 0; c < cols; c++) {
      const p = { x: minX + (c + 0.5) * STEP, y: minY + (r + 0.5) * STEP };
      if (!pointInRing(p, parcel)) continue;
      if (distToRing(p, parcel) < setback) continue;
      let blocked = false;
      for (const b of buildings) {
        if (pointInRing(p, b) || distToRing(p, b) < gap) { blocked = true; break; }
      }
      if (blocked) continue;
      row[c] = true;
      freeCells++;
    }
    free.push(row);
  }

  const { largest, fitting } = scanRectangles(free, cols, rows, (w, h) =>
    rectHolds(w * STEP, h * STEP, unit.width, unit.length)
  );
  const largestClear = largest
    ? { width: Math.round(largest.w * STEP), length: Math.round(largest.h * STEP) }
    : null;
  const unitFits = !!fitting;
  const rect = fitting ?? largest;

  // The biggest building is taken as the house — a garage does not decide where
  // "the front of the section" is.
  const house = buildings.length
    ? centroid(buildings.reduce((a, b) => (polygonArea(b) > polygonArea(a) ? b : a)))
    : null;
  const road = input.roadPoint ?? null;
  const spot = rect ? { x: minX + rect.cx * STEP, y: minY + rect.cy * STEP } : null;

  return {
    parcelAreaSqm,
    builtAreaSqm,
    buildingCount: buildings.length,
    clearAreaSqm: Math.round(freeCells * STEP * STEP),
    largestClear,
    unitFits,
    placement: unitFits && spot ? describePlacement(spot, house, road) : null,
    housePosition: describeHousePosition(house, parcel, road),
    assumed,
  };
}
