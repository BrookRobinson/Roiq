// ============================================================
// What a house costs to keep, as a share of its price — by age.
//
// It used to be a flat 1% of price for everything, which is the usual rule of
// thumb and is wrong at both ends. A house finished last year has nothing worn
// out, nothing at end of life, and a build warranty still running; a
// seventy-year-old villa has a roof, wiring, piles and joinery all marching
// toward replacement at once. Charging both of them the same is a rule of thumb
// applied where the actual age is known and sitting right there in the report.
//
// THESE ANCHORS ARE CHOSEN, and the report says so rather than pretending they
// were measured. What can be defended is the SHAPE — that upkeep rises with
// age — and that a number the reader can see and edit beats one they can't.
// The field stays editable; this only moves the starting point to somewhere
// less obviously wrong.
//
// Interpolated between the anchors rather than stepped, for the same reason the
// quality curve is: a house that turns twenty overnight does not suddenly cost
// more to keep, and a staircase in a number that feeds a ten-year projection
// puts a visible kink in it for no reason anybody could explain.
//
// Dependency-free, so scripts/verify-maintenance.mjs can load it with plain node.
// ============================================================

/** age in years → share of purchase price per year. */
export const MAINTENANCE_ANCHORS: ReadonlyArray<readonly [age: number, pct: number]> = [
  [0, 0.004],   // new build — warranty period, nothing at end of life
  [10, 0.008],  // first repaint and small stuff due
  [25, 0.012],  // roof, hot water, kitchen and bathroom reaching their span
  [50, 0.016],  // everything at end of life at once
];

/** Used when the build year is unknown — the old flat rule, unchanged. */
export const MAINTENANCE_PCT_UNKNOWN_AGE = 0.01;

/**
 * Annual maintenance as a share of price, from the building's age.
 *
 * Null build year keeps the flat 1%: guessing an age from nothing would be
 * worse than the rule of thumb it replaces.
 */
export function maintenancePctForAge(buildYear: number | null | undefined, thisYear: number): number {
  if (!buildYear || !Number.isFinite(buildYear)) return MAINTENANCE_PCT_UNKNOWN_AGE;

  // A build year in the future is a typo or an off-plan listing; treat it as new
  // rather than extrapolating backwards off the bottom of the curve.
  const age = Math.max(0, thisYear - buildYear);
  const a = MAINTENANCE_ANCHORS;
  if (age <= a[0][0]) return a[0][1];
  const last = a[a.length - 1];
  if (age >= last[0]) return last[1];

  for (let i = 1; i < a.length; i++) {
    const [x0, y0] = a[i - 1];
    const [x1, y1] = a[i];
    if (age <= x1) return y0 + ((age - x0) / (x1 - x0)) * (y1 - y0);
  }
  return last[1];
}

/** How the report explains the figure it chose. Always says it is a starting point. */
export function maintenanceBasis(buildYear: number | null | undefined, thisYear: number): string {
  if (!buildYear || !Number.isFinite(buildYear)) {
    return "rule of thumb — no build year on the listing, so this isn't adjusted for age. Edit it if you know better.";
  }
  const age = Math.max(0, thisYear - buildYear);
  if (age <= 2) return `scaled for a ${age <= 0 ? "new" : `${age}-year-old`} build — little is due yet. A starting point, not a quote.`;
  return `scaled for a ${age}-year-old building. A starting point, not a quote — edit it if you know the property.`;
}
