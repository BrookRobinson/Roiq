import type { SubItem, Category, ExtraDwelling, UrgencyScore } from "./types";

// ── Point allocations per spec V3 ─────────────────────────────────────────

export const CATEGORY_POINTS: Record<string, number> = {
  exterior:   380,
  services:   150,
  kitchen:    100,
  bathrooms:   90,
  living:      70,
  bedrooms:    60,
  garage:      60,
  outdoor:     40,
};

// Sub-item points within each category
export const SUB_ITEM_POINTS: Record<string, Record<string, number>> = {
  exterior: {
    ext_foundation: 95,
    ext_roof:       85,
    ext_cladding:   80,
    ext_windows:    60,
    ext_soffits:    35,
    ext_solar:      25,
    ext_chimneys:   25,
  },
  services: {
    svc_electrical: 65,
    svc_plumbing:   45,
    svc_hotwater:   30,
    svc_gas:        10,
  },
  kitchen: {
    kit_cabinetry:  35,
    kit_benchtop:   20,
    kit_appliances: 20,
    kit_sink:       10,
    kit_splashback:  8,
    kit_flooring:    7,
  },
  bathrooms: {
    // Points per bathroom — if 2 bathrooms, each gets 45 pts
    bath_shower:        25,
    bath_waterproofing: 25,
    bath_vanity:        18,
    bath_toilet:        10,
    bath_ventilation:    7,
    bath_flooring:       5,
  },
  living: {
    liv_flooring:  25,
    liv_heating:   30,
    liv_light:     15,
    liv_ceiling:   15,
    liv_insulation:15,
    liv_size:      10,
  },
  bedrooms: {
    bed_master: 25,
    bed_bed2:   20,
    bed_bed3:   15,
  },
  garage: {
    gar_main: 42,
    gar_door: 18,
  },
  outdoor: {
    out_deck:      12,
    out_fencing:    8,
    out_driveway:   8,
    out_garden:     7,
    out_drainage:   5,
  },
};

// ── Build-era Tier 3 default scores ──────────────────────────────────────
// When an item can't be seen, estimate from build era + location risk

export function tier3DefaultScore(
  subItemId: string,
  buildYear: number | null,
  region: string
): number {
  const age = buildYear ? new Date().getFullYear() - buildYear : 50;
  const tc2Risk = region === "Christchurch" || region === "Canterbury";

  const ageScore = (itemId: string): number => {
    // Foundation degrades with age + TC risk
    if (itemId === "ext_foundation") {
      let base = age < 20 ? 8 : age < 40 ? 7 : age < 60 ? 5 : 4;
      if (tc2Risk) base = Math.max(1, base - 2);
      return base;
    }
    // Electrical — older = more likely fuses
    if (itemId === "svc_electrical") {
      return age < 20 ? 8 : age < 40 ? 7 : age < 60 ? 5 : 4;
    }
    // Plumbing — copper longevity
    if (itemId === "svc_plumbing") {
      return age < 30 ? 8 : age < 60 ? 6 : 5;
    }
    // Hot water — typical 10-15yr life
    if (itemId === "svc_hotwater") {
      return age < 15 ? 8 : age < 30 ? 6 : 4;
    }
    // Generic age-based decay
    return age < 10 ? 9 : age < 25 ? 7 : age < 45 ? 6 : 5;
  };

  return ageScore(subItemId);
}

// ── Main scoring function ─────────────────────────────────────────────────

export interface ScoringResult {
  categoryScores: Record<string, number>;      // category → points earned
  baseScore: number;                           // 0–1000
  dwellingBonus: number;                       // additive, max 50
  totalScore: number;                          // min(1050, base + bonus)
}

export function calculateScore(
  categories: Category[],
  extraDwellings: ExtraDwelling[],
  buildYear: number | null,
  region: string
): ScoringResult {
  const categoryScores: Record<string, number> = {};
  let baseScore = 0;

  for (const cat of categories) {
    const allocatedPts = CATEGORY_POINTS[cat.id] ?? 0;
    if (allocatedPts === 0) continue;

    const subPts = SUB_ITEM_POINTS[cat.id] ?? {};
    let catEarned = 0;
    let catTotal  = 0;

    for (const item of cat.subItems) {
      const pts = subPts[item.id] ?? (allocatedPts / cat.subItems.length);
      catTotal += pts;

      // Score: use actual score, or Tier 3 estimate, or 0 if missing
      let score = item.score;
      if (score === null && item.confidenceTier === 3) {
        score = tier3DefaultScore(item.id, buildYear, region) as UrgencyScore;
      }
      const normalised = score !== null ? score / 10 : 0.6;
      catEarned += normalised * pts;
    }

    // Normalise if allocated != total (rounding)
    const catScore = catTotal > 0
      ? (catEarned / catTotal) * allocatedPts
      : 0;

    categoryScores[cat.id] = Math.round(catScore);
    baseScore += catScore;
  }

  // Extra dwelling bonus: (score/10) × (mid_cost / 10_000), capped at 50
  const dwellingBonus = Math.min(
    50,
    extraDwellings.reduce((sum, d) => {
      const mid = (d.estimatedReplacementCost.low + d.estimatedReplacementCost.high) / 2;
      return sum + (d.score / 10) * (mid / 10_000);
    }, 0)
  );

  return {
    categoryScores,
    baseScore:    Math.round(baseScore),
    dwellingBonus: Math.round(dwellingBonus),
    totalScore:   Math.min(1050, Math.round(baseScore + dwellingBonus)),
  };
}
