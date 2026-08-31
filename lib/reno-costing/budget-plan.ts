// ============================================================
// Tectara — "If you spent X% on this house, here's what we'd do"
//
// A PRIORITISED SPEND PLAN, deliberately NOT a return prediction.
//
// We don't publish a "this will add $Y" figure, and that's on purpose. Our
// building value is built from replacement cost × spec tier × condition, so
// asking it "what if this item were modern and as-new?" just returns the
// difference the model already assumed. That's arithmetic, not market
// evidence, and quoting it as resale upside would overstate what renovation
// actually returns in NZ. So this module answers the honest question instead:
// given a budget, WHAT WOULD WE DO FIRST — and why.
//
// Ordering runs by what a buyer or valuer reacts to first:
//   1. compliance   — legally required (Healthy Homes), investor only
//   2. failing      — absent or end-of-life; actively costing you now
//   3. maintenance  — deferred work already due
//   4. worthwhile   — everything else, cheapest-first so the budget goes further
// ============================================================

import type { Tier, ThreeTierCost } from "./three-tier";

export type PlanPriority = "compliance" | "failing" | "maintenance" | "worthwhile";

const PRIORITY_RANK: Record<PlanPriority, number> = {
  compliance: 0,
  failing: 1,
  maintenance: 2,
  worthwhile: 3,
};

export const PRIORITY_META: Record<PlanPriority, { label: string; color: string }> = {
  compliance: { label: "Required by law", color: "#ff5f5f" },
  failing: { label: "Not there / end of life", color: "#ff5f5f" },
  maintenance: { label: "Already due", color: "#fbbf24" },
  worthwhile: { label: "Worth doing", color: "var(--brand)" },
};

/** The subset of a RenoLine this planner needs. */
export interface PlanInput {
  key: string;
  name: string;
  low: number;
  high: number;
  costing?: ThreeTierCost;
  autoInclude: boolean;
  urgencyYears: number;
  /** Derived from the build era rather than observed. Never recommended as due. */
  inferred?: boolean;
  legal?: boolean;
  nonExisting?: boolean;
  /** A full strip-out and rebuild of a room — never recommended as a patch. */
  wholeRoom?: boolean;
  /** Used ONLY to break ties within a priority band — never shown to the user. */
  valueGap?: number;
  category?: string;
  /** What's actually visible in THIS property's photos — keeps the plan specific. */
  observedDefect?: string;
  photoRefs?: number[];
  /**
   * Overrides the costing recipe's scope text. Compliance and paperwork items fall
   * back to a generic allowance ("full replacement to a sound, compliant standard"),
   * which is plainly wrong for, say, certifying a pool fence — so those lines pass
   * the real scope in here.
   */
  scopeHint?: string;
}

export interface PlanLine {
  key: string;
  name: string;
  tier: Tier;
  tierLabel: string;
  scope: string;
  cost: number;
  priority: PlanPriority;
  reason: string;
  category?: string;
  /** The photo-grounded observation, when the AI gave one. Leads the card. */
  observedDefect?: string;
  photoRefs?: number[];
}

export interface BudgetPlan {
  budget: number;
  spent: number;
  remaining: number;
  included: PlanLine[];
  /** Ranked but didn't fit — the "next thing we'd do" list. */
  deferred: PlanLine[];
  /** True when even the single highest-priority job costs more than the budget. */
  firstJobExceedsBudget: boolean;
}

/**
 * Cheapest tier that genuinely resolves the item. You can't "patch up" something
 * that isn't there or has reached end of life, so those go straight to a budget
 * replacement; everything else starts at a patch.
 */
function chooseTier(input: PlanInput): Tier {
  // A line that IS the replacement cannot be recommended as a patch. The
  // whole-room refits came back "We'd do — Patch Up: re-seal, re-grout, replace
  // tap and vanity" on a line called "Whole bathroom — full refit", which is
  // the recommendation contradicting the item's own name.
  if (input.wholeRoom) return "budget";
  return input.nonExisting || input.legal ? "budget" : "patch";
}

/** Costed at tradie rates — most buyers hire out, and it's the conservative read. */
function tierCost(input: PlanInput, tier: Tier): { cost: number; label: string; scope: string } {
  const t = input.costing?.[tier];
  if (t) {
    // An un-itemised tier is a generic allowance, so its scope text is boilerplate —
    // prefer the caller's real scope when it gave us one.
    const scope = !t.itemised && input.scopeHint ? input.scopeHint : t.scope;
    return { cost: t.tradieTotal, label: !t.itemised && input.scopeHint ? "Scope" : t.label, scope };
  }
  // No costing recipe → fall back to the line's own band.
  const mid = Math.round((input.low + input.high) / 2);
  return { cost: mid, label: tier === "budget" ? "Replace (budget)" : "Patch up", scope: input.scopeHint ?? input.name };
}

function classify(input: PlanInput, persona: "buyer" | "investor"): { priority: PlanPriority; reason: string } {
  if (persona === "investor" && input.legal && input.nonExisting) {
    return { priority: "compliance", reason: "A Healthy Homes standard isn't met — you must fix this to rent it out." };
  }
  if (input.nonExisting) {
    return { priority: "failing", reason: "It's absent or at the end of its life, so it counts against the property today." };
  }
  if (input.autoInclude || input.urgencyYears <= 3) {
    return { priority: "maintenance", reason: "Work that's already due — leaving it tends to get more expensive, not less." };
  }
  return { priority: "worthwhile", reason: "Not urgent — but cheap to do while you're in there, and it lifts how the place presents and lives." };
}

/**
 * Fill the budget in priority order. Within a band, the cheapest jobs go first so
 * the money covers more ground; value-gap only breaks ties and is never surfaced.
 */
export function buildBudgetPlan(
  inputs: PlanInput[],
  budget: number,
  persona: "buyer" | "investor"
): BudgetPlan {
  const ranked: PlanLine[] = inputs
    // Era-derived lines never enter the recommendation. Draught stopping is the
    // only one today: it is computed from the build year alone, because no
    // photograph shows a draught. Recommending it reads as a finding, and it was
    // proposing $1,600 of sealing — as "work that's already due" — on a house
    // whose own listing advertises new double glazing and Insulmax wall
    // insulation. It stays available to tick by hand once someone has been.
    .filter((i) => !i.inferred)
    .map((i) => {
      const tier = chooseTier(i);
      const { cost, label, scope } = tierCost(i, tier);
      const { priority, reason } = classify(i, persona);
      return {
        key: i.key, name: i.name, tier, tierLabel: label, scope, cost, priority, reason,
        category: i.category, observedDefect: i.observedDefect, photoRefs: i.photoRefs,
        _gap: i.valueGap ?? 0,
      };
    })
    .filter((l) => l.cost > 0)
    .sort((a, b) => {
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (p !== 0) return p;
      if (a.cost !== b.cost) return a.cost - b.cost; // stretch the budget further
      return b._gap - a._gap;
    })
    .map(({ _gap, ...rest }) => rest);

  const included: PlanLine[] = [];
  const deferred: PlanLine[] = [];
  let spent = 0;
  for (const line of ranked) {
    if (spent + line.cost <= budget) {
      included.push(line);
      spent += line.cost;
    } else {
      deferred.push(line);
    }
  }

  return {
    budget,
    spent,
    remaining: Math.max(0, budget - spent),
    included,
    deferred,
    firstJobExceedsBudget: included.length === 0 && ranked.length > 0,
  };
}
