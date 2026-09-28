import { NextRequest, NextResponse } from "next/server";

import { describeGrant, grantFor, isOrder, MAP_TERM, orderPrice, planKey, type Order } from "@/lib/billing/plans";
import { appOrigin, findOrCreateCustomer, getStripe, lineItemFor } from "@/lib/billing/stripe";
import { getUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/billing/checkout  { reports: 0 | 1 | 3 | 5 | 10 | 20, map: boolean }
 * → { ok: true, url } — send the browser there.
 *
 * One-off payments, not subscriptions: the site promises you buy a thing and it
 * ends there, so this is `mode: "payment"`. What was bought is granted by the
 * webhook, never here — this route only knows somebody *started* paying, and a
 * success redirect can be forged by typing the URL.
 *
 * There is no "you already have that" refusal. Purchases don't replace each
 * other: credits add up and map access extends, so buying more reports while
 * the map is running is a perfectly sensible thing to do.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  // The order has to be one of ours — the price comes from a table keyed by
  // it, so an arbitrary report count would either crash the lookup or, worse,
  // resolve to undefined and charge 0. Nothing at all is not an order either.
  if (!isOrder(body)) {
    return NextResponse.json(
      { ok: false, error: "Choose how many reports you want, the map, or both." },
      { status: 400 }
    );
  }
  const order: Order = { reports: body.reports, map: body.map };

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { ok: false, error: "Payments aren't set up yet — STRIPE_SECRET_KEY is missing." },
      { status: 503 }
    );
  }

  // Signing in first is the point: the webhook grants what was bought to a user
  // id, and an anonymous checkout has nobody to grant it to.
  const { authUser, profile } = await getUser().catch(() => ({ authUser: null, profile: null }));
  if (!authUser) {
    return NextResponse.json(
      { ok: false, error: "Sign in before buying so it lands on your account.", needsAuth: true },
      { status: 401 }
    );
  }

  const grant = grantFor(order);
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
      line_items: [lineItemFor(order)],
      // The webhook grants from THIS metadata, because there is no price ID to
      // look the package up by any more. It is set here, server-side, from the
      // same table that priced the line item — the browser never sends an
      // amount and cannot ask for 500 reports at the price of 5.
      metadata: {
        user_id: authUser.id,
        plan: planKey(order),
        reports: String(grant.reports),
        map: grant.map ? "1" : "0",
        inspections: String(grant.inspections),
      },
      payment_intent_data: { metadata: { user_id: authUser.id, plan: planKey(order) } },
      // Stripe emails the receipt; ours is the row in `purchases`.
      success_url: `${origin}/account?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?purchase=cancelled`,
      allow_promotion_codes: true,
      custom_text: {
        submit: {
          message: confirmText(order),
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

/**
 * The last sentence before somebody's card is charged.
 *
 * It says what they get and what runs out, because the two things being sold
 * behave differently: credits are theirs to keep, the map stops.
 */
function confirmText(order: Order): string {
  const grant = grantFor(order);
  const what = describeGrant(grant);
  const parts = [`${what.charAt(0).toUpperCase()}${what.slice(1)} for $${orderPrice(order).toLocaleString("en-NZ")}.`];
  if (grant.reports > 0) parts.push("Reports don't expire.");
  if (grant.map) parts.push(`Map access runs ${MAP_TERM}.`);
  parts.push("Nothing auto-renews.");
  return parts.join(" ");
}
