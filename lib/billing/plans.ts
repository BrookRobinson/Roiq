// ============================================================
// What the plans are, and when access runs out.
//
// Pure and import-safe from client components — no Stripe SDK, no env secrets,
// no database. The server maps these to Stripe price IDs in ./stripe.ts.
// ============================================================

export type Plan = "free" | "starter" | "pro";
export type PaidPlan = Exclude<Plan, "free">;

/** A purchase buys this many days. Nothing auto-renews — see the migration. */
export const ACCESS_DAYS = 30;

export const PLAN_RANK: Record<Plan, number> = { free: 0, starter: 1, pro: 2 };

export const PAID_PLANS: PaidPlan[] = ["starter", "pro"];

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
};

/**
 * Display price in whole NZD. This is copy, not a source of truth — the amount
 * actually charged is whatever the Stripe price says, and the receipt records
 * it. Keep the two in step by hand; showing $99 and charging $149 is the kind
 * of mismatch nobody notices until a customer does.
 */
export const PLAN_PRICE_NZD: Record<PaidPlan, number> = {
  starter: 49,
  pro: 99,
};

export const isPaidPlan = (v: unknown): v is PaidPlan =>
  v === "starter" || v === "pro";

/**
 * The plan a user actually has right now.
 *
 * A stored plan of "pro" means nothing on its own: it's a record of what was
 * bought, and it stays there after the month runs out. Access is the pair —
 * plan AND an expiry still in the future. Anything unparseable, missing or past
 * resolves to "free", because every failure here should fail closed.
 */
export function effectivePlan(
  storedPlan: string | null | undefined,
  expiresAt: string | Date | null | undefined,
  now: Date = new Date()
): Plan {
  if (storedPlan !== "starter" && storedPlan !== "pro") return "free";
  if (!expiresAt) return "free";

  const end = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return "free";

  return end.getTime() > now.getTime() ? storedPlan : "free";
}

/** Whole days of access left, floored at 0. Used for "renews in 6 days" copy. */
export function daysRemaining(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date()
): number {
  if (!expiresAt) return 0;
  const end = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}

/**
 * When a purchase made now should run out.
 *
 * Buying again while a month is still running EXTENDS it rather than resetting
 * it — otherwise paying early quietly throws away the days already paid for.
 */
export function accessUntil(
  currentExpiry: string | Date | null | undefined,
  now: Date = new Date()
): Date {
  const base =
    currentExpiry && new Date(currentExpiry).getTime() > now.getTime()
      ? new Date(currentExpiry)
      : now;
  return new Date(base.getTime() + ACCESS_DAYS * 86_400_000);
}

/** Does `plan` clear the `minimum` bar? Pro ⊃ Starter ⊃ Free. */
export const planMeets = (plan: Plan, minimum: Plan): boolean =>
  PLAN_RANK[plan] >= PLAN_RANK[minimum];

/** "21 September 2026" — one date format across the billing UI. */
export function formatAccessDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * One row of purchase history, as the account page reads it.
 *
 * Lives here rather than beside the route because a Next.js route file may only
 * export handlers, and the client component that renders the list needs the
 * shape too.
 */
export interface PurchaseSummary {
  id: string;
  plan: Plan;
  amountCents: number | null;
  currency: string;
  status: "paid" | "refunded" | string;
  receiptUrl: string | null;
  accessUntil: string;
  createdAt: string;
}

/** "$99.00" from 9900 — Stripe deals in cents, people don't. */
export function formatAmount(cents: number | null, currency = "nzd"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

// ── Report allowances ────────────────────────────────────────────────────────
//
// A full report costs real money to produce (measured at roughly NZ$1.45 from
// September 2026 — the Claude vision pass plus the market lookups), so an
// allowance isn't a growth lever, it's the thing standing between a curious
// visitor and an unbounded bill. "Unlimited" on the pricing page was written
// before anyone had measured that.

export interface Allowance {
  /** How many reports the plan includes. */
  reports: number;
  /**
   * "lifetime" never resets. The free report is a taster, not a monthly
   * handout: a monthly reset turns every account into a renewable cost and
   * gives someone farming accounts a reason to keep each one.
   */
  period: "lifetime" | "month";
}

export const PLAN_ALLOWANCE: Record<Plan, Allowance> = {
  free:    { reports: 1,  period: "lifetime" },
  starter: { reports: 10, period: "month" },
  pro:     { reports: 20, period: "month" },
};

/** "1 report" / "10 reports a month" — one phrasing everywhere. */
export function describeAllowance(plan: Plan): string {
  const { reports, period } = PLAN_ALLOWANCE[plan];
  const noun = reports === 1 ? "report" : "reports";
  return period === "month" ? `${reports} ${noun} a month` : `${reports} ${noun}`;
}

/** Start of the window the allowance is counted over. Null = count everything. */
export function allowanceWindowStart(plan: Plan, now: Date = new Date()): Date | null {
  if (PLAN_ALLOWANCE[plan].period === "lifetime") return null;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** When the allowance next refills, or null if it never does. */
export function allowanceResetsAt(plan: Plan, now: Date = new Date()): Date | null {
  if (PLAN_ALLOWANCE[plan].period === "lifetime") return null;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export interface QuotaState {
  plan: Plan;
  used: number;
  limit: number;
  remaining: number;
  period: Allowance["period"];
  /** ISO date the count resets, or null for a lifetime allowance. */
  resetsAt: string | null;
}

export function quotaFrom(plan: Plan, used: number, now: Date = new Date()): QuotaState {
  const { reports, period } = PLAN_ALLOWANCE[plan];
  const reset = allowanceResetsAt(plan, now);
  return {
    plan,
    used,
    limit: reports,
    remaining: Math.max(0, reports - used),
    period,
    resetsAt: reset ? reset.toISOString() : null,
  };
}

/**
 * What to tell someone who has run out.
 *
 * Names the number they've used and the way out, because "quota exceeded" tells
 * a person nothing they can act on.
 */
export function quotaExhaustedMessage(q: QuotaState): string {
  if (q.plan === "free") {
    return "You've used your free report. Upgrade to Starter for 10 reports a month, including the score and valuation.";
  }
  const when = q.resetsAt
    ? new Date(q.resetsAt).toLocaleDateString("en-NZ", { day: "numeric", month: "long" })
    : "next month";
  const upgrade = q.plan === "starter" ? " Pro doubles it to 20." : "";
  return `You've used all ${q.limit} reports for this month. Your allowance refills on ${when}.${upgrade}`;
}
