import { NextResponse } from "next/server";

import { PAID_PLANS, PLAN_LABEL, PLAN_PRICE_NZD, formatAmount } from "@/lib/billing/plans";
import {
  appOrigin,
  getStripe,
  hasWebhookSecret,
  priceEnvName,
  priceIdFor,
  stripeMode,
} from "@/lib/billing/stripe";
import { hasAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health/billing — is anyone actually able to buy a plan?
 *
 * Checkout fails loudly, but the two ways billing breaks silently are a price
 * ID pointing at the wrong thing and a webhook that never arrives. The first is
 * checked here by asking Stripe what each price really is — including whether
 * it's recurring, which would quietly turn the "nothing auto-renews" promise
 * into a subscription. The second can only be proved by a real event, so this
 * reports whether the secret exists and leaves the rest to `stripe listen`.
 */
export async function GET() {
  const stripe = getStripe();
  const mode = stripeMode();

  if (!stripe) {
    return NextResponse.json({
      ok: false,
      configured: false,
      summary: "STRIPE_SECRET_KEY isn't set — the plan CTAs will return a 503 rather than a checkout.",
    });
  }

  const prices = await Promise.all(
    PAID_PLANS.map(async (plan) => {
      const id = priceIdFor(plan);
      if (!id) {
        return {
          plan,
          env: priceEnvName(plan),
          id: null,
          ok: false,
          detail: `${priceEnvName(plan)} isn't set.`,
        };
      }

      try {
        const price = await stripe.prices.retrieve(id);
        const recurring = !!price.recurring;
        const amount = formatAmount(price.unit_amount, price.currency);
        const expected = PLAN_PRICE_NZD[plan];
        const matchesCopy = price.unit_amount === expected * 100;

        return {
          plan,
          env: priceEnvName(plan),
          id,
          ok: price.active && !recurring && matchesCopy,
          amount,
          active: price.active,
          recurring,
          detail: !price.active
            ? "That price is archived in Stripe."
            : recurring
              ? "That price is RECURRING. The site promises nothing auto-renews — use a one-off price."
              : !matchesCopy
                ? `Stripe charges ${amount} but the site advertises $${expected}.`
                : null,
        };
      } catch (err) {
        return {
          plan,
          env: priceEnvName(plan),
          id,
          ok: false,
          detail: `Stripe couldn't find that price: ${(err as Error).message}`,
        };
      }
    })
  );

  const webhook = hasWebhookSecret();
  const canGrant = hasAdminClient();
  const broken = prices.filter((p) => !p.ok);

  // The service role is what the webhook writes plans with. Without it a
  // customer can pay in full and get nothing, which is the worst failure here.
  const summary = !canGrant
    ? "SUPABASE_SERVICE_ROLE_KEY is missing — payments would succeed and the plan would never be granted. Fix this before taking money."
    : !webhook
      ? "STRIPE_WEBHOOK_SECRET isn't set — checkout works, but nothing grants the plan afterwards."
      : broken.length
        ? broken.map((p) => `${PLAN_LABEL[p.plan]}: ${p.detail}`).join(" ")
        : mode === "test"
          ? `Ready in TEST mode — ${prices.map((p) => `${PLAN_LABEL[p.plan]} ${p.amount}`).join(", ")}. No real money moves until the keys are live.`
          : `Ready — ${prices.map((p) => `${PLAN_LABEL[p.plan]} ${p.amount}`).join(", ")}.`;

  return NextResponse.json({
    ok: canGrant && webhook && broken.length === 0,
    configured: true,
    mode,
    webhookSecret: webhook,
    canGrantPlans: canGrant,
    returnUrlOrigin: appOrigin(),
    prices,
    summary,
  });
}
