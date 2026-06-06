export type ConfidenceTier = 1 | 2 | 3;

export type UrgencyScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface ReplacementCost {
  low: number;
  high: number;
  notes: string;
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
  renovationLink: boolean;
  healthyHomesLink: boolean;
  photoReferences: number[];
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

// ── Scoring engine ─────────────────────────────────────────────────────────

export function calcCategoryScore(subItems: SubItem[]): number {
  const scored = subItems.filter((s) => s.score !== null);
  if (scored.length === 0) return 0.7; // default neutral if all T3
  let weightedSum = 0;
  let totalWeight = 0;
  for (const item of scored) {
    weightedSum += ((item.score as number) / 10) * item.replacementCostWeight;
    totalWeight += item.replacementCostWeight;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0.7;
}

export function calcOverallScore(
  categories: Category[],
  extraDwellings: ExtraDwelling[]
): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const cat of categories) {
    const catScore = calcCategoryScore(cat.subItems);
    weightedSum += catScore * cat.weight;
    totalWeight += cat.weight;
  }
  const baseScore = totalWeight > 0 ? (weightedSum / totalWeight) * 1000 : 500;

  // Extra dwelling additive bonus
  const dwellingBonus = extraDwellings.reduce((sum, d) => {
    const conditionFactor = d.score / 10;
    const mid = (d.estimatedReplacementCost.low + d.estimatedReplacementCost.high) / 2;
    const valuePoints = (mid / 500_000) * 100;
    return sum + valuePoints * conditionFactor;
  }, 0);

  return Math.min(1000, Math.round(baseScore + dwellingBonus));
}
