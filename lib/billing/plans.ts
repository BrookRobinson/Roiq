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
