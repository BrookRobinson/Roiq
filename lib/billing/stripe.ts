// ============================================================
// Stripe — SERVER ONLY.
//
// STRIPE_SECRET_KEY can create charges and read every customer on the account.
// Never import this from a client component. The publishable key is the one
// that's allowed in a browser, and this app doesn't even need it: checkout runs
// on Stripe's hosted page, so the browser only ever receives a redirect URL.
// ============================================================

import Stripe from "stripe";

import { describeGrant, grantFor, orderPrice, type Order } from "@/lib/billing/plans";
import { PRODUCT_NAME } from "@/lib/brand";

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
 * Billing needs a secret key and nothing else.
 *
 * There are no price IDs any more. The price depends on how many reports were
 * chosen and whether the map was added, which would have meant a Stripe price per quantity and an env
 * var for each — so the line item is built inline from PRICE, our own table,
 * and Stripe is told what to charge rather than asked. That removes six
 * environment variables AND the entire class of bug where Stripe charges $149
 * and the site advertises $99, because there is now only one number.
 */
export const isBillingConfigured = (): boolean => !!process.env.STRIPE_SECRET_KEY;

export const hasWebhookSecret = (): boolean => !!process.env.STRIPE_WEBHOOK_SECRET;

/** Test keys and live keys are indistinguishable in behaviour but not in money. */
export const stripeMode = (): "test" | "live" | null => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return key.startsWith("sk_live_") ? "live" : "test";
};

/**
 * The one line item on the checkout, priced from our own table.
 *
 * The name is what appears on the Stripe receipt and the customer's card
 * statement line, so it says what they got — "Tectara — 10 reports and the map for 12 months"
 * rather than a product code nobody can match to a charge three weeks later.
 */
export function lineItemFor(order: Order): Stripe.Checkout.SessionCreateParams.LineItem {
  const what = describeGrant(grantFor(order));
  return {
    quantity: 1,
    price_data: {
      currency: "nzd",
      unit_amount: orderPrice(order) * 100,
      product_data: {
        name: `${PRODUCT_NAME} — ${what.charAt(0).toUpperCase()}${what.slice(1)}`,
      },
    },
  };
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

