// ============================================================
// Section shape and street frontage, MEASURED off the surveyed boundary.
//
// Both used to be the analysis's read of an aerial photo. A photo doesn't show
// the legal boundary — fences, hedges and driveways are routinely a metre or
// more off it — and the model was judging "about 70% workable" by eye. The
// LINZ parcel polygon IS the boundary, survey-accurate in town, so both are
// geometry now:
//
//   WORKABLE — the share of the section at least MIN_WIDTH wide in every
//   direction (a morphological opening by a disc of that diameter). A
//   battle-axe leg, a wedge's point and a narrow side strip fall out; both
//   legs of an L stay in, because each is wide enough to use.
//
//   FRONTAGE — metres of boundary shared with a LINZ road parcel. Frontage on
//   two sides facing different ways is a corner site. A short frontage whose
//   workable ground can't reach the street is a battle-axe leg, i.e. a rear
//   lot. No road contact at all means access over someone else's land.
//
// Dependency-free so a verify script can hand it shapes it drew itself.
// ============================================================

export interface Pt { x: number; y: number }
export type Ring = Pt[];

export type MeasuredShape = "rectangular" | "square" | "long_narrow" | "l_shaped" | "wedge" | "rear_lot" | "irregular";
export type MeasuredAccess = "road_frontage" | "corner_site" | "rear_lot" | "shared_driveway" | "right_of_way";

/** Narrower than this and you can't put a building, a garage or a real lawn on it. */
export const MIN_WIDTH_M = 6;
/** Shared-boundary tolerance: surveyed neighbours coincide, digitised ones drift a little. */
const TOUCH_M = 1.0;
/** A frontage shorter than this, with no workable ground behind it, is an access leg. */
const LEG_MAX_M = 7;
/** Frontage shorter than this along one edge is a corner nibble, not frontage. */
const MIN_RUN_M = 3;
/** Boundary sampling interval, metres. */
const SAMPLE = 0.5;

export interface SiteMeasure {
  areaSqm: number;
  workablePct: number;
  shapeType: MeasuredShape;
  /** Area ÷ the tightest bounding rectangle, 0–1. A clean rectangle is ~1. */
  rectangularity: number;
  /** Long side ÷ short side of that rectangle. */
  aspectRatio: number;
  /** Null when no road parcels were supplied — frontage wasn't measured. */
  frontage: {
    lengthM: number;
    sides: number;
    access: MeasuredAccess;
    /** On a shared access lot: every section that touches it, this one included. */
    homesOnAccess?: number;
  } | null;
}

// ── Geometry ─────────────────────────────────────────────────────────────────

function area(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j].x + r[i].x) * (r[j].y - r[i].y);
  return Math.abs(a / 2);
}

function inside(p: Pt, r: Ring): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if (r[i].y > p.y !== r[j].y > p.y && p.x < ((r[j].x - r[i].x) * (p.y - r[i].y)) / (r[j].y - r[i].y) + r[i].x) c = !c;
  }
  return c;
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function ringDist(p: Pt, r: Ring): number {
  let d = Infinity;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) d = Math.min(d, segDist(p, r[j], r[i]));
  return d;
}

function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  const upper: Pt[] = [];
  for (const q of [...p].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Tightest bounding rectangle: one side always lies along a hull edge. */
function minRect(h: Pt[]): { area: number; long: number; short: number; angle: number } {
  let best = { area: Infinity, long: 0, short: 0, angle: 0 };
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const c = Math.cos(-ang), s = Math.sin(-ang);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of h) {
      const x = p.x * c - p.y * s, y = p.x * s + p.y * c;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const w = maxX - minX, l = maxY - minY;
    if (w * l < best.area) best = { area: w * l, long: Math.max(w, l), short: Math.min(w, l), angle: ang };
  }
  return best;
}

// ── The measurement ──────────────────────────────────────────────────────────

/**
 * `neighbours` are the other (non-road) parcels around it. They matter only for
 * a section with no road contact of its own: a narrow neighbour that touches
 * the road is a jointly-owned ACCESS LOT, and how many sections it serves is a
 * measured fact rather than a guess.
 */
export function measureSite(parcel: Ring, roadParcels?: Ring[] | null, neighbours?: Ring[] | null): SiteMeasure | null {
  if (parcel.length < 3) return null;
  const areaSqm = area(parcel);
  if (areaSqm <= 0) return null;

  // Grid fine enough for a town section, coarse enough not to crawl on a block.
  const step = Math.max(0.5, Math.sqrt(areaSqm) / 120);
  const R = MIN_WIDTH_M / 2;
  const xs = parcel.map((p) => p.x), ys = parcel.map((p) => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const cols = Math.ceil((Math.max(...xs) - minX) / step), rows = Math.ceil((Math.max(...ys) - minY) / step);

  const inCell: boolean[] = new Array(cols * rows).fill(false);
  const core: number[] = [];
  let insideCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = { x: minX + (c + 0.5) * step, y: minY + (r + 0.5) * step };
      if (!inside(p, parcel)) continue;
      inCell[r * cols + c] = true;
      insideCount++;
      if (ringDist(p, parcel) >= R) core.push(r * cols + c);
    }
  }
  if (!insideCount) return null;

  // Opening: every cell within R of a core cell is ground a MIN_WIDTH disc covers.
  const work: boolean[] = new Array(cols * rows).fill(false);
  const k = Math.ceil(R / step);
  for (const idx of core) {
    const r0 = Math.floor(idx / cols), c0 = idx % cols;
    for (let dr = -k; dr <= k; dr++) {
      for (let dc = -k; dc <= k; dc++) {
        if ((dr * dr + dc * dc) * step * step > R * R) continue;
        const r = r0 + dr, c = c0 + dc;
        if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
        const i = r * cols + c;
        if (inCell[i]) work[i] = true;
      }
    }
  }
  const workCount = work.reduce((n, w) => n + (w ? 1 : 0), 0);
  const workablePct = Math.round((workCount / insideCount) * 100);

  const h = hull(parcel);
  const hullArea = area(h);
  const rect = minRect(h);
  const rectangularity = rect.area > 0 ? areaSqm / rect.area : 0;
  const aspectRatio = rect.short > 0 ? rect.long / rect.short : 1;
  const convexity = hullArea > 0 ? areaSqm / hullArea : 1;

  let shapeType: MeasuredShape =
    rectangularity >= 0.9 ? (aspectRatio >= 2.5 ? "long_narrow" : aspectRatio <= 1.15 ? "square" : "rectangular")
    : convexity >= 0.92 && rectangularity <= 0.7 ? "wedge"
    : convexity < 0.9 && rectilinear(parcel, rect.angle) ? "l_shaped"
    : "irregular";

  // ── Frontage ─────────────────────────────────────────────────────────────
  let frontage: SiteMeasure["frontage"] = null;
  if (roadParcels) {
    const roads = roadParcels.filter((r) => r.length >= 3);
    // Walk the boundary in order, flagging each sample that lies on road land.
    const samples: { p: Pt; dir: number; len: number; on: boolean }[] = [];
    for (let i = 0, j = parcel.length - 1; i < parcel.length; j = i++) {
      const a = parcel[j], b = parcel[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.max(1, Math.round(len / SAMPLE));
      const dir = Math.atan2(b.y - a.y, b.x - a.x);
      for (let t = 0; t < n; t++) {
        const p = { x: a.x + ((t + 0.5) / n) * (b.x - a.x), y: a.y + ((t + 0.5) / n) * (b.y - a.y) };
        samples.push({ p, dir, len: len / n, on: roads.some((rd) => ringDist(p, rd) <= TOUCH_M || inside(p, rd)) });
      }
    }
    // Keep only CONTINUOUS stretches of at least MIN_RUN_M. A side boundary
    // running away from the street starts within the tolerance of it, and that
    // first metre is not frontage. But a cul-de-sac head is drawn as many
    // short segments, so the run is measured along the boundary, not per edge
    // — per edge, every piece of a curved frontage was under 3 m and the
    // whole frontage vanished.
    const touching: { p: Pt; dir: number }[] = [];
    const N = samples.length;
    const start = samples.findIndex((x) => !x.on);
    // Each end of a stretch picks up the first TOUCH_M of the side boundary
    // that meets the street there. Trim it back off.
    const trimEnds = <T extends { len: number }>(run: T[]): T[] => {
      let i = 0, j = run.length, cut = 0;
      while (i < j && cut + run[i].len <= TOUCH_M + 1e-9) cut += run[i++].len;
      cut = 0;
      while (j > i && cut + run[j - 1].len <= TOUCH_M + 1e-9) cut += run[--j].len;
      return run.slice(i, j);
    };
    if (start === -1) {
      touching.push(...samples);
    } else {
      let run: typeof samples = [];
      for (let k = 1; k <= N; k++) {
        const x = samples[(start + k) % N];
        if (x.on) run.push(x);
        if (!x.on || k === N) {
          // Measured AFTER trimming: a corner that merely comes within a metre
          // of the road reserve beside an access lot is 1.5 m of "frontage"
          // otherwise, and turned access-lot sections into battle-axes.
          const kept = trimEnds(run);
          if (kept.reduce((m, r) => m + r.len, 0) >= MIN_RUN_M) touching.push(...kept);
          run = [];
        }
      }
    }
    const lengthM = Math.round(touching.length * SAMPLE * 10) / 10;

    // Faces of frontage: group by edge direction (mod 180°), keeping any
    // with at least 5 m. Two faces 45°+ apart is a corner.
    const faces: { dir: number; m: number }[] = [];
    for (const t of touching) {
      const d = ((t.dir % Math.PI) + Math.PI) % Math.PI;
      const f = faces.find((x) => Math.min(Math.abs(x.dir - d), Math.PI - Math.abs(x.dir - d)) < Math.PI / 4);
      if (f) f.m += SAMPLE; else faces.push({ dir: d, m: SAMPLE });
    }
    const sides = faces.filter((f) => f.m >= 5).length;

    // Does workable ground reach the street? A battle-axe leg is narrower than
    // MIN_WIDTH all the way in, so the nearest workable cell sits far back.
    let reach = Infinity;
    if (touching.length) {
      for (let i = 0; i < work.length; i++) {
        if (!work[i]) continue;
        const p = { x: minX + ((i % cols) + 0.5) * step, y: minY + (Math.floor(i / cols) + 0.5) * step };
        for (const t of touching) reach = Math.min(reach, Math.hypot(p.x - t.p.x, p.y - t.p.y));
        if (reach <= R + step) break;
      }
    }

    let access: MeasuredAccess =
      lengthM === 0 ? "right_of_way"
      : lengthM < LEG_MAX_M && reach > MIN_WIDTH_M ? "rear_lot"
      : sides >= 2 ? "corner_site"
      : "road_frontage";
    let homesOnAccess: number | undefined;

    // No road of its own: look for the access lot it hangs off — a neighbour
    // too narrow to be a section, touching both this parcel and the road.
    if (access === "right_of_way" && neighbours?.length) {
      const touches = (a: Ring, b: Ring, m: number) => sharedLength(a, b) >= m;
      // The section itself may be in the neighbour list (it came from the same
      // query); it must not count as one of the homes on its own driveway.
      const same = (r: Ring) => r.length === parcel.length && Math.abs(area(r) - areaSqm) < 1 && ringDist(r[0], parcel) < 0.5;
      const others = neighbours.filter((n) => n.length >= 3 && !same(n));
      for (const n of others) {
        // The section only has to meet the access lot where its driveway
        // enters — often just the strip's own width at the end.
        if (!touches(parcel, n, 1.5)) continue;
        if (!roads.some((rd) => touches(n, rd, 2.5))) continue;
        if (!isStrip(n)) continue;
        access = "shared_driveway";
        // The front sections alongside the drive touch it too, but they have
        // the street; only the ones without it are on the driveway.
        homesOnAccess =
          others.filter((o) => o !== n && touches(o, n, 1.5) && !roads.some((rd) => touches(o, rd, MIN_RUN_M))).length + 1;
        break;
      }
    }
    frontage = { lengthM, sides, access, ...(homesOnAccess ? { homesOnAccess } : {}) };
    if (access === "rear_lot") shapeType = "rear_lot";
  }

  return {
    areaSqm: Math.round(areaSqm),
    workablePct,
    shapeType,
    rectangularity: Math.round(rectangularity * 100) / 100,
    aspectRatio: Math.round(aspectRatio * 10) / 10,
    frontage,
  };
}

/** Length of `a`'s boundary lying along `b` (within the touch tolerance). */
function sharedLength(a: Ring, b: Ring): number {
  let m = 0;
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    const p = a[j], q = a[i];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    const n = Math.max(1, Math.round(len / 0.5));
    for (let t = 0; t < n; t++) {
      const s = { x: p.x + ((t + 0.5) / n) * (q.x - p.x), y: p.y + ((t + 0.5) / n) * (q.y - p.y) };
      if (ringDist(s, b) <= TOUCH_M) m += len / n;
    }
  }
  return m;
}

/** A driveway strip: small, and nowhere as wide as a building needs. */
function isStrip(r: Ring): boolean {
  const a = area(r);
  if (a > 1500) return false;
  const h = hull(r);
  const rect = minRect(h);
  return rect.short < MIN_WIDTH_M + 1 || a / Math.max(1, rect.long) < MIN_WIDTH_M;
}

/** Mostly right-angled edges, aligned with the bounding rectangle — an L, not a blob. */
function rectilinear(r: Ring, angle: number): boolean {
  let aligned = 0, total = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const len = Math.hypot(r[i].x - r[j].x, r[i].y - r[j].y);
    const d = Math.atan2(r[i].y - r[j].y, r[i].x - r[j].x) - angle;
    const off = Math.abs(((d % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2));
    if (Math.min(off, Math.PI / 2 - off) < (10 * Math.PI) / 180) aligned += len;
    total += len;
  }
  return total > 0 && aligned / total >= 0.85;
}
