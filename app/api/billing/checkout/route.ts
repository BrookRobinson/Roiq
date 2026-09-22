import { NextRequest, NextResponse } from "next/server";

import {
  describeGrant,
  grantFor,
  isPackage,
  isReportQuantity,
  MAP_DAYS,
  NEEDS_FULFILMENT,
  PACKAGE_LABEL,
  PACKAGES,
  priceFor,
  type Package,
  type ReportQuantity,
} from "@/lib/billing/plans";
import { appOrigin, findOrCreateCustomer, getStripe, lineItemFor } from "@/lib/billing/stripe";
import { getUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/billing/checkout  { pkg: "bronze" | "silver" | "gold", quantity? }
 * → { ok: true, url } — send the browser there.
 *
 * One-off payments, not subscriptions: the site promises you buy a thing and it
 * ends there, so this is `mode: "payment"`. What was bought is granted by the
 * webhook, never here — this route only knows somebody *started* paying, and a
 * success redirect can be forged by typing the URL.
 *
 * There is no "you already have a better plan" refusal any more. Packages don't
 * replace each other: credits add up, map access extends, and an inspection is
 * owed per purchase. Buying Bronze while Silver is running is a perfectly
 * sensible thing to do — it's ten more reports.
 */
export async function POST(req: NextRequest) {
  let body: { pkg?: unknown; quantity?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const pkg = body.pkg;
  if (!isPackage(pkg)) {
    return NextResponse.json(
      { ok: false, error: `Choose one of: ${PACKAGES.map((p) => PACKAGE_LABEL[p]).join(", ")}.` },
      { status: 400 }
    );
  }

  // Bronze is the only one that carries a choice, and the choice has to be one
  // of ours — the price comes from a table keyed by it, so an arbitrary number
  // would either crash the lookup or, worse, resolve to undefined and charge 0.
  let quantity: ReportQuantity | undefined;
  if (pkg === "bronze") {
    if (!isReportQuantity(body.quantity)) {
      return NextResponse.json(
        { ok: false, error: "Choose how many reports you want." },
        { status: 400 }
      );
    }
    quantity = body.quantity;
  }

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

  const grant = grantFor(pkg, quantity);
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
      line_items: [lineItemFor(pkg, quantity)],
      // The webhook grants from THIS metadata, because there is no price ID to
      // look the package up by any more. It is set here, server-side, from the
      // same table that priced the line item — the browser never sends an
      // amount and cannot ask for 500 reports at the price of 5.
      metadata: {
        user_id: authUser.id,
        pkg,
        reports: String(grant.reports),
        map: grant.map ? "1" : "0",
        inspections: String(grant.inspections),
      },
      payment_intent_data: { metadata: { user_id: authUser.id, pkg } },
      // Stripe emails the receipt; ours is the row in `purchases`.
      success_url: `${origin}/account?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?purchase=cancelled`,
      allow_promotion_codes: true,
      custom_text: {
        submit: {
          message: confirmText(pkg, quantity),
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
 * It says what they get and what runs out, because the three things being sold
 * behave differently and the difference matters most here: credits are theirs
 * to keep, the map stops, and Gold owes them a visit somebody has to book.
 */
function confirmText(pkg: Package, quantity?: ReportQuantity): string {
  const grant = grantFor(pkg, quantity);
  const parts = [`${describeGrant(grant)} for $${priceFor(pkg, quantity).toLocaleString("en-NZ")}.`];
  parts.push("Reports don't expire.");
  if (grant.map) parts.push(`Map access runs ${MAP_DAYS} days.`);
  if (NEEDS_FULFILMENT[pkg]) parts.push("We'll be in touch to book the inspection.");
  parts.push("Nothing auto-renews.");
  return parts.join(" ");
}
