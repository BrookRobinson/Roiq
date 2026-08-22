import { NextRequest, NextResponse } from "next/server";

import {
  ACCESS_DAYS,
  effectivePlan,
  formatAccessDate,
  isPaidPlan,
  PLAN_LABEL,
  PLAN_RANK,
} from "@/lib/billing/plans";
import {
  appOrigin,
  findOrCreateCustomer,
  getStripe,
  priceEnvName,
  priceIdFor,
} from "@/lib/billing/stripe";
import { getUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/billing/checkout  { plan: "starter" | "pro" }
 * → { ok: true, url } — send the browser there.
 *
 * One-off payments, not subscriptions: the site promises a month at a time with
 * nothing auto-renewing, so this is `mode: "payment"`. The plan is granted by
 * the webhook, never here — this route only knows someone *started* paying, and
 * a success redirect can be forged by typing the URL.
 */
export async function POST(req: NextRequest) {
  let plan: unknown;
  try {
    plan = ((await req.json()) as { plan?: unknown })?.plan;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isPaidPlan(plan)) {
    return NextResponse.json(
      { ok: false, error: "Choose the Starter or Pro plan." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { ok: false, error: "Payments aren't set up yet — STRIPE_SECRET_KEY is missing." },
      { status: 503 }
    );
  }

  const priceId = priceIdFor(plan);
  if (!priceId) {
    return NextResponse.json(
      {
        ok: false,
        error: `The ${PLAN_LABEL[plan]} plan has no Stripe price yet — set ${priceEnvName(plan)}.`,
      },
      { status: 503 }
    );
  }

  // Signing in first is the point: the webhook grants the plan to a user id, and
  // an anonymous checkout has nobody to grant it to.
  const { authUser, profile } = await getUser().catch(() => ({ authUser: null, profile: null }));
  if (!authUser) {
    return NextResponse.json(
      { ok: false, error: "Sign in before buying so the plan lands on your account.", needsAuth: true },
      { status: 401 }
    );
  }

  // Buying a lower tier while a higher one is still running would replace it —
  // one plan column can't hold both. Say so instead of quietly taking Pro away
  // from someone who just paid for Starter.
  const active = effectivePlan(profile?.plan, profile?.plan_expires_at);
  if (PLAN_RANK[active] > PLAN_RANK[plan]) {
    return NextResponse.json(
      {
        ok: false,
        error: `You already have ${PLAN_LABEL[active]} until ${formatAccessDate(profile?.plan_expires_at)}. Buying ${PLAN_LABEL[plan]} now would replace it — wait until it runs out, or buy another month of ${PLAN_LABEL[active]}.`,
      },
      { status: 409 }
    );
  }

  const email = authUser.email ?? profile?.email ?? "";
  const origin = appOrigin(req.nextUrl.origin);

  try {
    const customerId = await findOrCreateCustomer(stripe, {
      userId: authUser.id,
      email,
      existingId: profile?.stripe_customer_id ?? null,
    });

    // Remember the customer now rather than in the webhook: this is the request
    // that has a session, and the next purchase should reuse the same record
    // even if the webhook never arrives.
    if (customerId !== profile?.stripe_customer_id) {
      const admin = createAdminClient();
      await admin?.from("users").update({ stripe_customer_id: customerId } as never).eq("id", authUser.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // The webhook reads the price to decide what was bought; this metadata is
      // how it knows *who* bought it.
      metadata: { user_id: authUser.id, plan },
      payment_intent_data: { metadata: { user_id: authUser.id, plan } },
      // Stripe emails the receipt; ours is the row in `purchases`.
      success_url: `${origin}/account?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?purchase=cancelled`,
      allow_promotion_codes: true,
      custom_text: {
        submit: {
          message: `${ACCESS_DAYS} days of ${PLAN_LABEL[plan]} access. Nothing auto-renews.`,
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Stripe created the checkout but returned no URL." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    const message = (err as Error).message || "Stripe rejected the checkout.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
