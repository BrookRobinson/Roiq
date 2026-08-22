import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  ACCESS_DAYS,
  accessUntil,
  effectivePlan,
  isPaidPlan,
  PLAN_RANK,
  type PaidPlan,
} from "@/lib/billing/plans";
import { getStripe, planForPriceId } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe — the only thing in this app that grants a plan.
 *
 * The success redirect can be typed into a browser; a signed webhook can't, so
 * access is written here and nowhere else. The root middleware's matcher
 * deliberately skips `api/webhooks` — a session refresh on Stripe's request
 * would be pointless, and the raw body must reach us untouched for the
 * signature to verify.
 *
 * Stripe retries until it gets a 2xx and may deliver the same event twice, so
 * everything below is idempotent: the unique constraint on
 * purchases.stripe_session_id is what stops a replay granting a second month.
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    // 503, not 500: Stripe will retry, and the fix is configuration.
    return NextResponse.json(
      { ok: false, error: "Billing isn't configured — STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is missing." },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, error: "Missing stripe-signature header." }, { status: 400 });
  }

  // Raw text, never req.json() — the signature is over the exact bytes sent.
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch (err) {
    // A bad signature is either a misconfigured secret or someone forging a
    // grant. 400 tells Stripe not to bother retrying.
    return NextResponse.json(
      { ok: false, error: `Signature verification failed: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const result = await grantFromSession(stripe, event.data.object);
        return NextResponse.json({ ok: true, handled: event.type, ...result });
      }

      case "charge.refunded": {
        const result = await revokeFromRefund(event.data.object);
        return NextResponse.json({ ok: true, handled: event.type, ...result });
      }

      default:
        // Everything else is acknowledged and ignored — returning an error for
        // events we didn't ask for just fills the Stripe dashboard with red.
        return NextResponse.json({ ok: true, ignored: event.type });
    }
  } catch (err) {
    // A 500 makes Stripe retry, which is what we want for a transient database
    // failure: the purchase is real and the grant must not be lost.
    return NextResponse.json(
      { ok: false, error: (err as Error).message, event: event.type },
      { status: 500 }
    );
  }
}

/** Grant a month of access for a paid checkout session. */
async function grantFromSession(stripe: Stripe, session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") {
    // Delayed methods land here first and come back as
    // async_payment_succeeded once the money actually clears.
    return { skipped: `payment_status=${session.payment_status}` };
  }

  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing — cannot record the purchase.");

  const userId = session.metadata?.user_id;
  if (!userId) return { skipped: "no user_id in session metadata" };

  // What was actually charged for beats what our own metadata claims.
  const plan = (await planFromSession(stripe, session)) ?? metadataPlan(session);
  if (!plan) return { skipped: "no recognisable plan on the session" };

  const { data: profile } = await admin
    .from("users")
    .select("plan, plan_expires_at")
    .eq("id", userId)
    .single();

  const now = new Date();
  const currentExpiry = profile?.plan_expires_at ?? null;
  const until = accessUntil(currentExpiry, now);

  // Buying again mid-month extends rather than resets — see accessUntil.
  // If someone somehow buys a *lower* tier while a higher one is still running,
  // keep the higher one: checkout blocks that case, and if it slips through, the
  // safe direction is never to strip access already paid for.
  const active = effectivePlan(profile?.plan, currentExpiry, now);
  const granted: PaidPlan =
    isPaidPlan(active) && PLAN_RANK[active] > PLAN_RANK[plan] ? active : plan;

  const charge = await chargeDetails(stripe, session);

  // Insert first. The unique session id means a replayed event conflicts here
  // and returns before the plan is extended a second time.
  const { error: insertError } = await admin.from("purchases").insert({
    user_id: userId,
    stripe_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
    plan: granted,
    amount_cents: session.amount_total ?? null,
    currency: (session.currency ?? "nzd").toLowerCase(),
    status: "paid",
    receipt_url: charge?.receipt_url ?? null,
    access_from: now.toISOString(),
    access_until: until.toISOString(),
  } as never);

  if (insertError) {
    if (isDuplicate(insertError)) return { duplicate: true, session: session.id };
    throw new Error(`Recording the purchase failed: ${insertError.message}`);
  }

  const { error: updateError } = await admin
    .from("users")
    .update({ plan: granted, plan_expires_at: until.toISOString() } as never)
    .eq("id", userId);

  if (updateError) throw new Error(`Granting the plan failed: ${updateError.message}`);

  return { granted, until: until.toISOString(), days: ACCESS_DAYS };
}

/**
 * Pull access back when a charge is refunded.
 *
 * Partial refunds are left alone: someone who got $10 back on a $99 month still
 * bought the month, and guessing at a pro-rata cutoff would be worse than doing
 * nothing.
 */
async function revokeFromRefund(charge: Stripe.Charge) {
  if (!charge.refunded) return { skipped: "partial refund — access left in place" };

  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing — cannot revoke access.");

  const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!intentId) return { skipped: "no payment_intent on the charge" };

  const { data: purchase } = await admin
    .from("purchases")
    .select("id, user_id, status, access_until")
    .eq("stripe_payment_intent_id", intentId)
    .single();

  if (!purchase) return { skipped: "no purchase matches that payment intent" };
  if (purchase.status === "refunded") return { duplicate: true };

  await admin.from("purchases").update({ status: "refunded" } as never).eq("id", purchase.id);

  // Take back exactly the days this purchase added, rather than ending access
  // outright — an earlier month they haven't been refunded for may still have
  // time on it.
  const now = new Date();
  const { data: profile } = await admin
    .from("users")
    .select("plan_expires_at")
    .eq("id", purchase.user_id)
    .single();

  const current = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null;
  if (!current || Number.isNaN(current.getTime())) return { revoked: false };

  const pulled = new Date(current.getTime() - ACCESS_DAYS * 86_400_000);
  const next = pulled.getTime() < now.getTime() ? now : pulled;

  await admin
    .from("users")
    .update({ plan_expires_at: next.toISOString() } as never)
    .eq("id", purchase.user_id);

  return { revoked: true, until: next.toISOString() };
}

/** The plan behind the price that was actually charged. */
async function planFromSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<PaidPlan | null> {
  try {
    const items =
      session.line_items?.data ??
      (await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 })).data;
    return planForPriceId(items[0]?.price?.id ?? null);
  } catch {
    return null;
  }
}

const metadataPlan = (session: Stripe.Checkout.Session): PaidPlan | null => {
  const plan = session.metadata?.plan;
  return isPaidPlan(plan) ? plan : null;
};

/** The charge, for its hosted receipt URL. Best-effort — a missing one is fine. */
async function chargeDetails(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<Stripe.Charge | null> {
  const intentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
  if (!intentId) return null;
  try {
    const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
    const latest = intent.latest_charge;
    return latest && typeof latest !== "string" ? latest : null;
  } catch {
    return null;
  }
}

const isDuplicate = (error: { code?: string; message?: string }): boolean =>
  error.code === "23505" || /duplicate key|already exists/i.test(error.message ?? "");
