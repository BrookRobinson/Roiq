// ============================================================
// RoiQ — Land / site-quality bands
//
// Gives each Land item a plain descriptive band (Flat / Gentle / Steep …) shown
// alongside its score, so the Land tab reads like the banded Improvements tab.
// Section size is scored OBJECTIVELY against a typical lot rather than a
// subjective 1–10. (Suburb-specific typical lots arrive with the sales/geodata
// layer — Phase 2; for now we benchmark against a typical NZ section.)
// ============================================================

/** Typical NZ residential section (m²) used as the section-size benchmark. */
export const TYPICAL_SECTION_SQM = 550;

/** Descriptive bands per land item, index 0 (poorest) → 3 (best). */
export const LAND_BANDS: Record<string, [string, string, string, string]> = {
  land_size: ["Compact", "Typical", "Large", "Very large"],
  land_topography: ["Steep", "Moderate slope", "Gentle slope", "Flat"],
  land_shape: ["Awkward", "Irregular", "Mostly regular", "Regular & usable"],
  land_aspect: ["Shaded", "Mixed sun", "Good sun", "North-facing"],
  land_frontage: ["ROW / rear lot", "Shared access", "Road frontage", "Prime frontage"],
  land_trees: ["Protected constraint", "Minimal planting", "Some established", "Established asset"],
};

/** Band index (0–3) from a 1–10 score. */
export function bandFromScore(score: number | null): number {
  if (score == null) return 1;
  if (score >= 9) return 3;
  if (score >= 7) return 2;
  if (score >= 4) return 1;
  return 0;
}

/** Section size scored objectively vs a typical lot → { score, band }. */
export function assessSectionSize(landAreaSqm: number | null): { score: number; band: number } {
  const land = landAreaSqm && landAreaSqm > 0 ? landAreaSqm : 0;
  if (!land) return { score: 5, band: 1 };
  const ratio = land / TYPICAL_SECTION_SQM;
  if (ratio >= 2.5) return { score: 10, band: 3 }; // very large
  if (ratio >= 1.4) return { score: 9, band: 2 }; // large
  if (ratio >= 0.75) return { score: 7, band: 1 }; // typical
  return { score: 4, band: 0 }; // compact
}

/** Descriptive band label for a land item (size uses area; the rest use the score). */
export function landBandLabel(id: string, score: number | null, landAreaSqm?: number | null): string {
  const bands = LAND_BANDS[id];
  if (!bands) return "";
  const idx = id === "land_size" ? assessSectionSize(landAreaSqm ?? null).band : bandFromScore(score);
  return bands[idx];
}
