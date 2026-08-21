// ============================================================
// Property Map — the repair allowance behind a pin.
//
// The map subtracts a repair allowance from every deal (it is the investor
// mode's "adjusted buy-in"), so that figure has to agree with the report the pin
// came from. The obvious shortcut — summing `estimatedReplacementCost` — does
// not: the model usually returns no cost at all (a real run came back with 65
// assessed items and zero costs), which would put every property on the map at
// $0 of work and make each one look better than its own report says.
//
// So this mirrors what the Renovations tab PRE-TICKS, which is the report's own
// answer to "what needs doing":
//   • improvement items scoring in the bottom band (≤30%) — deteriorated
//   • every specifically flagged remediation, minus the legal/DD ones, which are
//     due diligence rather than building work
// and costs them the same way, at Replace-Budget / tradie, falling back to the
// item's replacement-cost-new when the model gave no figure.
//
// Kept deliberately small: this needs a total, not the tab's full line items.
// It stays in step with `buildRenoLines` in RealReportView.tsx — change the
// auto-include rule there and it needs changing here.
// ============================================================

import { costThreeTier } from "@/lib/reno-costing/three-tier";
import { valueImprovementItems } from "@/lib/scoring/improvement-values";
import { ITEM_BY_ID } from "@/lib/scoring/catalog";
import { tierBandFraction } from "@/lib/scoring/model";
import type { SubItem } from "@/lib/property-tab/types";

export interface RepairAllowance {
  total: number;
  breakdown: Record<string, number>;
}

/** Bottom of the tier band — the report's threshold for "this needs replacing". */
const AUTO_INCLUDE_FRACTION = 0.3;

export interface RepairContext {
  floorAreaSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
}

export function computeRepairAllowance(subItems: SubItem[], ctx: RepairContext): RepairAllowance {
  const breakdown: Record<string, number> = {};
  let total = 0;

  const add = (name: string, cost: number) => {
    if (cost <= 0) return;
    total += cost;
    breakdown[name] = (breakdown[name] ?? 0) + cost;
  };

  const items = subItems ?? [];
  const valuation = valueImprovementItems({
    subItems: items,
    floorAreaSqm: ctx.floorAreaSqm,
    bathrooms: ctx.bathrooms,
  });
  const valueById = new Map(valuation.items.map((v) => [v.id, v]));
  const costCtx = { floorSqm: ctx.floorAreaSqm, bedrooms: ctx.bedrooms };

  for (const s of items) {
    const meta = ITEM_BY_ID[s.id];
    const v = valueById.get(s.id);

    if (meta?.inspection === "improvements" && (s.estimatedReplacementCost || v)) {
      // Same band position the report uses to decide what to pre-tick.
      const frac = s.specTier ? tierBandFraction(s.specTier, s.score ?? 1) : (s.score ?? 6) / 10;
      if (s.score !== null && frac <= AUTO_INCLUDE_FRACTION) {
        const low = s.estimatedReplacementCost?.low ?? Math.round((v?.rcnNew ?? 0) * 0.8);
        const high = s.estimatedReplacementCost?.high ?? Math.round((v?.rcnNew ?? 0) * 1.25);
        if (high > 0) {
          const t = costThreeTier({ id: s.id, name: s.name, category: meta.category, ...costCtx, fallback: { low, high } });
          add(s.name, Math.round(t.budget.tradieTotal));
        }
      }
    }

    // A flagged remedy is work someone has specifically identified, so it counts
    // whatever the item scored — but legal/due-diligence items (a LIM, a title
    // check) are not building work and don't belong in a repair allowance.
    if (s.remediation && meta?.inspection !== "legal") {
      const t = costThreeTier({
        id: `${s.id}_rem`,
        name: s.remediation.renovationLineItem,
        ...costCtx,
        fallback: { low: s.remediation.low, high: s.remediation.high },
      });
      add(s.remediation.renovationLineItem, Math.round(t.budget.tradieTotal));
    }
  }

  return { total, breakdown };
}
