// ============================================================
// Stripe — SERVER ONLY.
//
// STRIPE_SECRET_KEY can create charges and read every customer on the account.
// Never import this from a client component. The publishable key is the one
// that's allowed in a browser, and this app doesn't even need it: checkout runs
// on Stripe's hosted page, so the browser only ever receives a redirect URL.
// ============================================================

import Stripe from "stripe";

import { PAID_PLANS, type PaidPlan, type Plan } from "@/lib/billing/plans";

/** Env var holding the Stripe price for each paid plan. */
const PRICE_ENV: Record<PaidPlan, string> = {
  copper: "STRIPE_COPPER_PRICE_ID",
  bronze: "STRIPE_BRONZE_PRICE_ID",
  silver: "STRIPE_SILVER_PRICE_ID",
  gold: "STRIPE_GOLD_PRICE_ID",
  platinum: "STRIPE_PLATINUM_PRICE_ID",
  diamond: "STRIPE_DIAMOND_PRICE_ID",
};

let cached: Stripe | null = null;

/**
 * The Stripe client, or null when STRIPE_SECRET_KEY isn't set.
 *
 * Null rather than a throw, for the same reason the Supabase admin client does
 * it: the app has to run without billing configured — a local dev copy, or a
 * clone someone is reading. Callers turn null into "checkout isn't set up yet",
 * which is a truthful 503, not a 500.
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) cached = new Stripe(key, { typescript: true });
  return cached;
}

/**
 * Tiers that can actually be bought right now — a key, and a price for that one.
 *
 * Per-tier rather than all-or-nothing, because the tiers are meant to go on sale
 * as they're ready. Diamond in particular owes a customer a building inspector,
 * so it stays unbuyable until someone deliberately creates its Stripe price;
 * requiring every plan to have one would have reported billing as broken for as
 * long as that took, and hidden a real fault behind an expected one.
 */
export const sellablePlans = (): PaidPlan[] =>
  process.env.STRIPE_SECRET_KEY ? PAID_PLANS.filter((p) => !!priceIdFor(p)) : [];

export const isPlanSellable = (plan: PaidPlan): boolean =>
  !!process.env.STRIPE_SECRET_KEY && !!priceIdFor(plan);

export const isBillingConfigured = (): boolean => sellablePlans().length > 0;

export const hasWebhookSecret = (): boolean => !!process.env.STRIPE_WEBHOOK_SECRET;

/** Test keys and live keys are indistinguishable in behaviour but not in money. */
export const stripeMode = (): "test" | "live" | null => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return key.startsWith("sk_live_") ? "live" : "test";
};

export const priceIdFor = (plan: PaidPlan): string | null =>
  process.env[PRICE_ENV[plan]]?.trim() || null;

export const priceEnvName = (plan: PaidPlan): string => PRICE_ENV[plan];

/**
 * Which plan a price ID belongs to.
 *
 * The webhook trusts this over the session metadata it also carries: metadata
 * is set by our own checkout route, but the price is what Stripe actually
 * charged for. If the two ever disagree, the charge is the honest one.
 */
export function planForPriceId(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  return PAID_PLANS.find((p) => priceIdFor(p) === priceId) ?? null;
}

/** Absolute origin for Stripe's return URLs — they can't be relative. */
export function appOrigin(fallback?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  return configured || fallback?.replace(/\/+$/, "") || "http://localhost:3000";
}

/**
 * The Stripe customer for this user, reused if we've seen them before.
 *
 * Reuse matters: a fresh customer per purchase scatters one person's receipts
 * across several records, and Stripe's own dashboard then can't answer "what
 * has this person bought".
 */
export async function findOrCreateCustomer(
  stripe: Stripe,
  opts: { userId: string; email: string; existingId?: string | null }
): Promise<string> {
  if (opts.existingId) {
    // A customer deleted in the dashboard still leaves the id on our row.
    const existing = await stripe.customers.retrieve(opts.existingId).catch(() => null);
    if (existing && !existing.deleted) return existing.id;
  }

  const created = await stripe.customers.create({
    email: opts.email,
    metadata: { user_id: opts.userId },
  });
  return created.id;
}

export type { Plan, PaidPlan };
