export type ConfidenceTier = 1 | 2 | 3;

export type UrgencyScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Quality / spec tier of an improvement's materials & finish — a value axis SEPARATE
 * from condition. A tiled bathroom and a vinyl one can both score 10/10 for condition
 * but sit at very different spec tiers, and are worth very different amounts. (v4 valuation) */
export type SpecTier = "original" | "dated" | "modern" | "luxury";

export interface ReplacementCost {
  low: number;
  high: number;
  notes: string;
}

// ── v3.2 sourced-reasoning fields (Location / Land / Legal) ──────────────────

export type SourceType =
  | "photo"
  | "council_data"
  | "linz"
  | "title"
  | "lim"
  | "gns"
  | "market_data"
  | "map_poi"
  | "moe_zones"
  | "inference";

/** Present only when a specific Location/Land/Legal finding is genuinely fixable. */
export interface Remediation {
  description: string; // e.g. "Certificate of Acceptance for rear studio"
  low: number;
  mid: number;
  high: number;
  urgencyYears: number; // for hold-period gating
  renovationLineItem: string; // label shown in the Renovations tab
}

export interface SubItem {
  id: string;
  name: string;
  material: string;
  estimatedAge: string;
  condition: string;
  score: UrgencyScore | null;          // null = Tier 3 unscored
  urgencyLabel: string;
  confidenceTier: ConfidenceTier;
  evidenceSource: string;
  aiSummary: string;
  estimatedReplacementCost: ReplacementCost | null;
  replacementCostWeight: number;       // 0–1, fraction of category score
  specTier?: SpecTier;                 // quality/spec of the materials (Improvements) — drives building value
  renovationLink: boolean;
  healthyHomesLink: boolean;
  photoReferences: number[];

  // Set when a visual item's score was stripped because the listing had 0 photos —
  // the card then shows an "upload photos to assess" prompt instead of a score.
  noPhotoNotAssessed?: boolean;

  // v3.2 — populated for Location/Land/Legal items (and optionally Improvements).
  finding?: string;                    // one-line status, e.g. "Low — not in mapped flood plain"
  source?: string;                     // specific named source, e.g. "Auckland Council flood-hazard overlay"
  sourceType?: SourceType;
  verifyAgainst?: string;              // e.g. "LIM", "record of title"
  remediation?: Remediation | null;    // present only when the finding is fixable
}

export interface Category {
  id: string;
  name: string;
  icon: string;                        // emoji icon for display
  weight: number;                      // 0–1, fraction of overall score (excl. extra dwellings)
  subItems: SubItem[];
}

export interface ExtraDwelling {
  id: string;
  type: string;
  sizeEstimate: string;
  construction: string;
  condition: string;
  score: UrgencyScore;
  estimatedReplacementCost: ReplacementCost;
  consentStatus: "consented" | "unconsented" | "unknown";
  aiSummary: string;
  photoReferences: number[];
}

export interface PropertyTabData {
  categories: Category[];
  extraDwellings: ExtraDwelling[];
  overallScore: number;
}

// ── Urgency helpers ────────────────────────────────────────────────────────

export function urgencyLabel(score: UrgencyScore | null): string {
  if (score === null) return "Not assessed — inspect";
  const labels: Record<number, string> = {
    10: "Brand new — no action needed",
    9:  "Excellent — no action needed",
    8:  "Very good — monitor only",
    7:  "Good — inspect every 2–3 years",
    6:  "Fair — plan replacement within 5–7 years",
    5:  "Average — plan replacement within 3–5 years",
    4:  "Below average — replace within 2–3 years",
    3:  "Poor — replace within 1–2 years",
    2:  "Very poor — replace urgently (within 12 months)",
    1:  "Critical — immediate action required",
  };
  return labels[score] ?? "Unknown";
}

// Years until replacement is needed, derived from the urgency score.
// Upper bound of each label's range (spec 5.5); 99 = no replacement within any hold period.
export function urgencyScoreToYears(score: UrgencyScore | null): number {
  if (score === null) return 99;
  const years: Record<number, number> = {
    10: 99, 9: 99, 8: 99, 7: 99,
    6: 7,  // plan replacement within 5–7 years
    5: 5,  // 3–5 years
    4: 3,  // 2–3 years
    3: 2,  // 1–2 years
    2: 1,  // within 12 months
    1: 0,  // immediate
  };
  return years[score] ?? 99;
}

export function urgencyColor(score: UrgencyScore | null): "green" | "amber" | "red" | "muted" {
  if (score === null) return "muted";
  if (score >= 8) return "green";
  if (score >= 5) return "amber";
  return "red";
}

export function worstSubItemScore(category: Category): UrgencyScore | null {
  const scored = category.subItems.filter((s) => s.score !== null);
  if (scored.length === 0) return null;
  return Math.min(...scored.map((s) => s.score as number)) as UrgencyScore;
}

// Note: the overall quality score now lives in the v3.1 engine
// (lib/scoring/engine.ts → scoreProperty). The old fractional calcOverallScore /
// calcCategoryScore have been removed; this file keeps only the display types
// and urgency helpers that the Improvements UI shares.
