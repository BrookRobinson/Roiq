// ============================================================
// Is this report finished enough to replace a grey pin?
//
// A grey pin says one honest thing: this property is for sale and nobody has
// analysed it. The moment it turns into a coloured pin it starts making claims
// — a score, a valuation, a verdict against the asking price — and those claims
// are only worth making if the analysis behind them actually happened.
//
// It doesn't always. 244 Upper Kokatahi Road came back with 27 photos read, 62
// sub-items produced and every single one unassessable, because the owner
// interrupted the run half way. A max_tokens truncation does the same thing and
// is worse, because the SDK's partial-JSON parser hands the fragment back
// looking like a clean result. Both wrote a pin. Both then priced a $699,000
// property at $242,028 and coloured it red.
//
// So: a pin stays grey until there is a whole report behind it. A half one
// leaves the property exactly as it was, which costs nothing — the grey pin was
// already telling the truth.
//
// WHAT THIS DELIBERATELY DOESN'T DO is pick a percentage. "At least 60% of the
// points assessed" would be a number nobody chose, and there is no principled
// place to put it: a bare-land report legitimately assesses only Land and
// Legal, and every real report leaves some items unseen because Tier 3 items
// stopped scoring. The three gates below are absolutes — no photographs read,
// no score at all, nothing assessed whatsoever — and each is a statement that
// the analysis did not happen, not a judgement about how thorough it was.
// `assessedFraction` is reported instead, so a threshold can be set later from
// evidence rather than from taste.
//
// Dependency-free, so scripts/verify-completeness.mjs can load it with plain node.
// ============================================================

/** What the analysis managed, in the engine's own terms. */
export interface CompletenessSignal {
  /** Photographs actually read. Zero means there was nothing to look at. */
  photosAnalysed: number;
  /** Points the score is built on — the denominator that survived. */
  assessedPoints: number;
  /** Points dropped because nothing was visible enough to grade them. */
  unassessedPoints: number;
  /** Buyer base score, 0–1000. */
  score: number | null;
  /** A bare section assesses Land and Legal only, and that is complete for it. */
  landOnly?: boolean;
}

export type Incomplete = "no-photos" | "no-score" | "nothing-assessed";

export const INCOMPLETE_REASON: Record<Incomplete, string> = {
  "no-photos": "the analysis read no photographs, so there was nothing to assess the property from",
  "no-score": "the analysis produced no score, so nothing in the property was successfully graded",
  "nothing-assessed": "every item came back unassessable, so the score rests on nothing",
};

/**
 * Why this report may not become a pin — or null if it may.
 *
 * Note what is NOT a reason: a missing valuation. A property with no land area
 * or no comparable sales genuinely cannot be valued, and the report is complete
 * in saying so. That is a gap in the WORLD, not in the analysis, and the pin is
 * entitled to carry a score and admit it has no price.
 */
export function whyIncomplete(s: CompletenessSignal): Incomplete | null {
  if (!(s.photosAnalysed > 0)) return "no-photos";
  if (!(typeof s.score === "number" && Number.isFinite(s.score) && s.score > 0)) return "no-score";
  if (!(s.assessedPoints > 0)) return "nothing-assessed";
  return null;
}

export function isComplete(s: CompletenessSignal): boolean {
  return whyIncomplete(s) === null;
}

/**
 * Share of the scoring points the analysis could actually assess, 0–1.
 *
 * Measured and reported, never gated on. Watch it before choosing any
 * threshold: a bare-land report sits low by design, and so does a house whose
 * listing photographs skip the roof.
 */
export function assessedFraction(s: CompletenessSignal): number | null {
  const total = s.assessedPoints + s.unassessedPoints;
  if (!(total > 0)) return null;
  return Math.round((s.assessedPoints / total) * 1000) / 1000;
}
