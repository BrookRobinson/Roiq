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

/** The eight compass points the land model scores an aspect on. */
export type AspectDirection =
  | "north" | "north_east" | "north_west" | "east"
  | "west" | "south_east" | "south_west" | "south";

const COMPASS: AspectDirection[] = [
  "north", "north_east", "east", "south_east", "south", "south_west", "west", "north_west",
];

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
   * Surveyed easement and covenant areas over the section.
   *
   * You generally cannot build over a right of way or a drainage easement, so
   * these come OUT of the buildable ground and the drag refuses to cross them —
   * a garage placed on somebody's registered right of access is not a plan, it
   * is a dispute. Absent is not clear: many easements have no surveyed extent.
   */
  burdens?: Ring[];
  /** What each burden IS, index-matched to `burdens`, for the drawing's legend. */
  burdenLabels?: { kind: string; appellation: string | null }[];
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
  /** Where the metre frame sits on earth, so imagery can be aligned to it. */
  anchor?: { lat: number; lng: number; mPerDegLat: number; mPerDegLon: number } | null;
}

export interface SiteLayout {
  /** Parcel area in m², from the geometry itself. */
  parcelAreaSqm: number;
  /** Ground covered by existing buildings, m². */
  builtAreaSqm: number;
  /** How many separate structures stand on the parcel. */
  buildingCount: number;
  /** Ground inside a surveyed easement or covenant area, m². */
  burdenedAreaSqm: number;
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
  /**
   * Site coverage once the unit is added, as a fraction. The NES caps it at 50%
   * in residential zones — a real constraint independent of whether the thing
   * physically fits, and one a large house on a modest section fails while
   * having plenty of lawn.
   */
  coverageWithUnit: number;
  /** True when adding the unit would breach the NES coverage cap. */
  coverageExceeded: boolean;
  /** Where it fits, in plain words — "behind the house", "beside the house". */
  placement: string | null;
  /** Where the existing house sits — "at the front", "centrally", "at the rear". */
  housePosition: string | null;
  /**
   * Which way the section faces, MEASURED off the LINZ parcel and road geometry
   * rather than inferred from photographs.
   *
   * 156 Buchanans Road is why. The analysis wrote "Buchanans Road running
   * roughly north-south past the property" and reasoned a south-west aspect off
   * it — from an aerial image with no compass on it. The road runs east-west.
   * A listing photo carries no orientation, and the aerial in a listing is not
   * reliably north-up, so this was never a thing the model could see; the
   * geometry has known north (+y) and the real road position, so it is.
   *
   * Null when no road was resolved — an unmeasured aspect is left to the model
   * rather than replaced by a second guess.
   */
  aspect: { direction: AspectDirection; roadBearing: string } | null;
  /** The margins this assumed, so the report can state rather than imply them. */
  assumed: { boundarySetback: number; buildingGap: number; unit: { width: number; length: number } };
  /**
   * Everything needed to DRAW the section, in metres, origin at the parcel's
   * south-west corner.
   *
   * A site plan is the honest form for this finding. "The largest unbroken clear
   * area is 19m × 51m, behind the house" is a sentence a reader has to take on
   * trust; the same thing drawn to scale, with the house where it actually
   * stands, is a claim they can check against the aerial photo in the listing.
   * Rounded to 0.1m — the source footprints are aerial-derived and nothing here
   * is accurate to a centimetre.
   */
  plan: {
    parcel: Pt[];
    buildings: Pt[][];
    /**
     * The unit itself, at its TRUE size — not the clear area it sits in.
     *
     * These were the same rectangle at first, so a 16m × 19m back yard was drawn
     * and labelled "7×10m". Drawing a dwelling four times its real footprint,
     * with its real dimensions written across it, is the kind of error that
     * makes a reader stop believing the rest of the page.
     */
    unit: Pt[] | null;
    /** The clear envelope it sits in, so the drawing shows the room around it. */
    clearArea: Pt[] | null;
    /** Easement and covenant areas, drawn over the section and blocked to build on. */
    burdens: { kind: string; appellation: string | null; ring: Pt[] }[];
    /** Direction of the street, for orienting the drawing. */
    road: Pt | null;
    /** Bounding extent in metres, so a viewBox can be built without re-scanning. */
    extent: { width: number; length: number };
    /**
     * Where the plan's (0,0) actually is on earth, and how many metres a degree
     * is worth here. Without it the drawing is a diagram; with it, aerial
     * imagery can be laid underneath and the boundary will sit on the fences.
     */
    anchor?: { lat: number; lng: number; mPerDegLat: number; mPerDegLon: number };
  };
}

// ── The National Environmental Standards for Detached Minor Residential Units
// (NES-DMRU), in force 15 January 2026. These are the ACTUAL permitted-activity
// standards, not our guesses — the first version of this module used an invented
// 1.5m boundary setback, which is not a number anybody can check.
//
//   70m²   maximum floor area
//   2m     from side and front boundaries, residential zones
//   2m     from other buildings
//   50%    maximum building coverage (residential / mixed use / Māori purpose;
//          no maximum in rural)
//   one    detached unit per site
//
// Rural zones are 10m front and 5m side/rear, which this does not yet model —
// RURAL_SETBACK is here so the gap is visible rather than silently wrong.
//
// What the NES does NOT displace, and the report says so: district-plan hazard
// rules, covenants on the title, and cross-lease or unit-title arrangements.
export const NES_MAX_FLOOR_SQM = 70;
export const NES_BOUNDARY_SETBACK_M = 2;
export const NES_BUILDING_GAP_M = 2;
export const NES_MAX_COVERAGE = 0.5;
export const NES_RURAL_SETBACK_M = { front: 10, side: 5 };

const DEFAULT_UNIT = { width: 7, length: 10 }; // 70m², the NES ceiling exactly
const DEFAULT_SETBACK = NES_BOUNDARY_SETBACK_M;
const DEFAULT_GAP = NES_BUILDING_GAP_M;
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
  const burdens = (input.burdens ?? []).filter((b) => b.length >= 3);
  let burdened = 0;
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
      // Inside a registered easement or covenant area. No setback applied —
      // the burden is the polygon itself, and its edge is where it stops.
      if (burdens.some((b) => pointInRing(p, b))) { burdened++; continue; }
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
  const unitArea = unit.width * unit.length;
  const coverageWithUnit = parcelAreaSqm > 0 ? (builtAreaSqm + unitArea) / parcelAreaSqm : 0;
  const coverageExceeded = coverageWithUnit > NES_MAX_COVERAGE;
  // Physically fitting is not the same as being allowed. A big house on a modest
  // section can have a clear back lawn and still be over 50% built the moment
  // anything is added to it.
  const unitFits = !!fitting && !coverageExceeded;
  const rect = fitting ?? largest;

  // The biggest building is taken as the house — a garage does not decide where
  // "the front of the section" is.
  const house = buildings.length
    ? centroid(buildings.reduce((a, b) => (polygonArea(b) > polygonArea(a) ? b : a)))
    : null;
  const road = input.roadPoint ?? null;
  const spot = rect ? { x: minX + rect.cx * STEP, y: minY + rect.cy * STEP } : null;

  const r1 = (n: number) => Math.round(n * 10) / 10;
  const shift = (pt: Pt): Pt => ({ x: r1(pt.x - minX), y: r1(pt.y - minY) });
  const boxAt = (cx: number, cy: number, w: number, h: number): Pt[] => [
    { x: r1(cx - w / 2), y: r1(cy - h / 2) },
    { x: r1(cx + w / 2), y: r1(cy - h / 2) },
    { x: r1(cx + w / 2), y: r1(cy + h / 2) },
    { x: r1(cx - w / 2), y: r1(cy + h / 2) },
  ];

  let unitRect: Pt[] | null = null;
  let clearRect: Pt[] | null = null;
  if (unitFits && fitting) {
    const fx = fitting.cx * STEP;
    const fy = fitting.cy * STEP;
    const fw = fitting.w * STEP;
    const fh = fitting.h * STEP;
    clearRect = boxAt(fx, fy, fw, fh);
    // Orient the dwelling the way it actually fits in that envelope.
    const upright = fw >= unit.width && fh >= unit.length;
    const uw = upright ? unit.width : unit.length;
    const uh = upright ? unit.length : unit.width;
    unitRect = boxAt(fx, fy, uw, uh);
  }

  // The section faces AWAY from the street: stand on the road, look in, and
  // that is the direction the rear yard and its outdoor living look toward.
  // +y is north because the metre frame is built off latitude.
  let aspect: SiteLayout["aspect"] = null;
  if (road) {
    const mid = centroid(parcel);
    const dx = mid.x - road.x, dy = mid.y - road.y;
    if (Math.hypot(dx, dy) > 1) {
      const idx = Math.round((Math.atan2(dx, dy) * 4) / Math.PI + 8) % 8;
      // The street runs across that line, so its bearing is the perpendicular.
      const roadIdx = (idx + 2) % 8;
      const axis = COMPASS[roadIdx].replace(/_/g, "-");
      const opposite = COMPASS[(roadIdx + 4) % 8].replace(/_/g, "-");
      aspect = { direction: COMPASS[idx], roadBearing: `${axis}–${opposite}` };
    }
  }

  return {
    parcelAreaSqm,
    builtAreaSqm,
    buildingCount: buildings.length,
    clearAreaSqm: Math.round(freeCells * STEP * STEP),
    burdenedAreaSqm: Math.round(burdened * STEP * STEP),
    largestClear,
    unitFits,
    coverageWithUnit: Math.round(coverageWithUnit * 1000) / 1000,
    coverageExceeded,
    placement: unitFits && spot ? describePlacement(spot, house, road) : null,
    housePosition: describeHousePosition(house, parcel, road),
    aspect,
    assumed,
    plan: {
      parcel: parcel.map(shift),
      buildings: buildings.map((b) => b.map(shift)),
      burdens: burdens.map((b, i) => ({
        kind: input.burdenLabels?.[i]?.kind ?? "Easement",
        appellation: input.burdenLabels?.[i]?.appellation ?? null,
        ring: b.map(shift),
      })),
      unit: unitRect ? unitRect.map(shift) : null,
      clearArea: clearRect ? clearRect.map(shift) : null,
      road: road ? shift(road) : null,
      extent: { width: r1(Math.max(...xs) - minX), length: r1(Math.max(...ys) - minY) },
      // Shifted with everything else: the plan's origin is the parcel's
      // south-west corner, not the centroid the geometry arrived in.
      anchor: input.anchor
        ? {
            lat: input.anchor.lat + minY / input.anchor.mPerDegLat,
            lng: input.anchor.lng + minX / input.anchor.mPerDegLon,
            mPerDegLat: input.anchor.mPerDegLat,
            mPerDegLon: input.anchor.mPerDegLon,
          }
        : undefined,
    },
  };
}


/**
 * May a rectangle of this size sit here?
 *
 * Exported for the DRAG. The user moves a footprint over the section and the
 * answer has to come back per frame, so this tests the four corners and the
 * edge midpoints rather than rasterising: a footprint is convex and the parcel
 * is nearly always convex too, and the boundary test is a distance to the ring
 * either way. It is deliberately the same predicate the fit search uses, so a
 * footprint the report said fits can always actually be placed.
 *
 * `setback` and `gap` come from lib/scoring/buildable-structures.ts, which
 * decides them from what is being built and how big — a 5m² woodshed may sit on
 * the boundary, a 25m² sleepout needs 1m, a granny flat 2m.
 */
export function canPlace(
  plan: SiteLayout["plan"],
  rect: { x: number; y: number; width: number; length: number },
  setback: number,
  gap: number
): boolean {
  const { x, y, width: w, length: l } = rect;
  const corners: Pt[] = [
    { x, y }, { x: x + w, y }, { x: x + w, y: y + l }, { x, y: y + l },
    { x: x + w / 2, y }, { x: x + w / 2, y: y + l }, { x, y: y + l / 2 }, { x: x + w, y: y + l / 2 },
  ];
  for (const c of corners) {
    if (!pointInRing(c, plan.parcel)) return false;
    if (setback > 0 && distToRing(c, plan.parcel) < setback) return false;
  }
  // Against what is already built. The rectangle must not overlap a footprint,
  // and must keep its gap from one — tested both ways round, because a small
  // shed entirely inside a large building's gap has no corner near its ring.
  for (const b of plan.buildings) {
    for (const c of corners) {
      if (pointInRing(c, b)) return false;
      if (gap > 0 && distToRing(c, b) < gap) return false;
    }
    for (const bp of b) {
      if (bp.x > x && bp.x < x + w && bp.y > y && bp.y < y + l) return false;
    }
  }
  // AND NOT ACROSS A REGISTERED BURDEN. You cannot build over a right of way or
  // a drainage easement, and a footprint that can be dropped on one is a plan
  // somebody takes to a builder before anybody notices. Tested both ways round,
  // like the buildings: a small shed sitting wholly inside a large easement has
  // no corner near its ring.
  for (const { ring: b } of plan.burdens ?? []) {
    for (const c of corners) if (pointInRing(c, b)) return false;
    for (const bp of b) {
      if (bp.x > x && bp.x < x + w && bp.y > y && bp.y < y + l) return false;
    }
  }
  return true;
}

/**
 * Somewhere this footprint legally goes, or null.
 *
 * Used to drop a newly chosen structure onto the section rather than landing it
 * on the house and asking the user to sort it out. Steps a coarse grid — 1m is
 * finer than anyone will drag to.
 */
export function firstFit(
  plan: SiteLayout["plan"],
  size: { width: number; length: number },
  setback: number,
  gap: number
): { x: number; y: number } | null {
  const { width: W, length: H } = plan.extent;
  let best: { x: number; y: number; d: number } | null = null;
  const cx = W / 2, cy = H / 2;
  for (let x = 0; x <= W - size.width; x += 1) {
    for (let y = 0; y <= H - size.length; y += 1) {
      if (!canPlace(plan, { x, y, ...size }, setback, gap)) continue;
      // Nearest the middle of the section, so it lands somewhere sensible
      // rather than jammed into whichever corner was scanned first.
      const d = Math.hypot(x + size.width / 2 - cx, y + size.length / 2 - cy);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}
