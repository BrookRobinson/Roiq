import { NextResponse } from "next/server";

import { MAP_PRICE_NZD, MAP_TERM, REPORT_PRICE_NZD, REPORT_QUANTITIES } from "@/lib/billing/plans";
import { hasWebhookSecret, isBillingConfigured, stripeMode } from "@/lib/billing/stripe";
import { hasAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health/billing — can this deployment actually take money, and would
 * the customer get what they paid for afterwards?
 *
 * Much shorter than it used to be. There are no Stripe price IDs any more: the
 * checkout builds its line item inline from the table in lib/billing/plans.ts,
 * so the entire class of "Stripe charges $149, the site advertises $99" is
 * gone, and with it the six env vars and the six round trips that checked them.
 *
 * What is left are the two failures that actually cost a customer money:
 * nothing to grant with, and nothing to tell us the payment happened.
 */
export async function GET() {
  const configured = isBillingConfigured();
  const mode = stripeMode();
  const webhook = hasWebhookSecret();
  // The service role is what the webhook writes purchases with. Without it a
  // customer can pay in full and get nothing, which is the worst failure here.
  const canGrant = hasAdminClient();

  const catalogue = {
    reports: REPORT_QUANTITIES.map((n) => ({
      reports: n,
      price: REPORT_PRICE_NZD[n],
      each: +(REPORT_PRICE_NZD[n] / n).toFixed(2),
    })),
    map: { price: MAP_PRICE_NZD, lasts: MAP_TERM, soldAlone: true, addOn: true },
  };

  const summary = !canGrant
    ? "SUPABASE_SERVICE_ROLE_KEY is missing — payments would succeed and nothing would be granted. Fix this before taking money."
    : !configured
      ? "STRIPE_SECRET_KEY isn't set — the buy buttons will return a 503 rather than a checkout."
      : !webhook
        ? "STRIPE_WEBHOOK_SECRET isn't set — checkout works, but nothing grants the purchase afterwards."
        : mode === "test"
          ? "Ready in TEST mode. No real money moves until the keys are live."
          : "Ready.";

  return NextResponse.json({
    ok: canGrant && configured && webhook,
    configured,
    mode,
    webhook,
    canGrant,
    summary,
    catalogue,
    note:
      "Prices come from lib/billing/plans.ts and are sent to Stripe per checkout. " +
      "There is nothing to configure in the Stripe dashboard beyond the key and the webhook.",
  });
}
