import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  mapAccessUntil,
  MAP_DAYS,
} from "@/lib/billing/plans";
import { getStripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe — the only thing in this app that grants anything.
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

  // The grant is read from OUR metadata, which this app's checkout route set
  // server-side from its own price table. There is no price ID to look it up by
  // any more — the line item is priced inline — so the metadata is the record,
  // and the browser never had a hand in writing it.
  const grant = grantFromMetadata(session);
  if (!grant) return { skipped: "no recognisable package on the session" };

  const { data: profile } = await admin
    .from("users")
    .select("plan, plan_expires_at")
    .eq("id", userId)
    .single();

  const now = new Date();
  // Only a purchase carrying the map moves the map clock. Reports bought
  // mid-year must not quietly extend map access nobody paid for again.
  const until = grant.map
    ? mapAccessUntil(profile?.plan_expires_at ?? null, now)
    : new Date(profile?.plan_expires_at ?? now);

  const charge = await chargeDetails(stripe, session);

  // Insert first. The unique session id means a replayed event conflicts here
  // and returns before anything is granted a second time.
  //
  // This row IS the grant — lib/billing/entitlements.ts sums these columns
  // rather than reading a balance off the user, so there is no counter to
  // increment twice and nothing to reconcile if this runs at an odd moment.
  const { error: insertError } = await admin.from("purchases").insert({
    user_id: userId,
    stripe_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
    plan: grant.plan,
    reports_granted: grant.reports,
    includes_map: grant.map,
    inspections_granted: grant.inspections,
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

  // `users.plan` is a record of what was last bought and nothing reads it for
  // access — kept so the account page can say what was last bought without a join.
  const { error: updateError } = await admin
    .from("users")
    .update({ plan: grant.plan, plan_expires_at: until.toISOString() } as never)
    .eq("id", userId);

  if (updateError) throw new Error(`Recording what was bought failed: ${updateError.message}`);

  return {
    granted: grant.plan,
    reports: grant.reports,
    map: grant.map,
    inspections: grant.inspections,
    until: grant.map ? until.toISOString() : null,
    days: grant.map ? MAP_DAYS : 0,
  };
}

interface GrantedPurchase {
  /** planKey() of the order — "reports-10+map" — or a legacy package name. */
  plan: string;
  reports: number;
  map: boolean;
  inspections: number;
}

/**
 * What this checkout bought, from the metadata our own route wrote.
 *
 * Every field is parsed defensively and a nonsensical one collapses the whole
 * grant rather than granting a guess: a NaN report count that reached the
 * ledger as 0 would look exactly like a purchase that bought nothing, and the
 * customer would be told they had no credits with a receipt in their hand.
 */
function grantFromMetadata(session: Stripe.Checkout.Session): GrantedPurchase | null {
  // `plan` since 2026-09-29; `pkg` on sessions opened before that.
  const plan = session.metadata?.plan ?? session.metadata?.pkg;
  if (!plan || typeof plan !== "string") return null;

  const reports = Number(session.metadata?.reports);
  if (!Number.isInteger(reports) || reports < 0) return null;

  const inspections = Number(session.metadata?.inspections ?? 0);
  if (!Number.isInteger(inspections) || inspections < 0) return null;

  const map = session.metadata?.map === "1";
  // A purchase that grants nothing is not a purchase we can honour.
  if (reports === 0 && !map && inspections === 0) return null;
  return { plan, reports, map, inspections };
}

/**
 * Pull back what a refunded charge bought.
 *
 * Marking the row is the whole revocation. Entitlements are SUMMED from the
 * purchases that are still `paid`, so flipping this one to `refunded` removes
 * its credits, its map days and any inspection it owed, in the same query that
 * reads them — there is no balance to claw back by hand and no way for the two
 * to disagree. The row stays for the receipt.
 *
 * Partial refunds are left alone: someone who got $10 back on a $149 purchase
 * still bought it, and guessing at a pro-rata cutoff would be worse than doing
 * nothing.
 *
 * One known edge: map access extends, so a purchase made AFTER this one carries
 * a date that was calculated from it. Refunding the earlier one leaves those
 * days on the later one. It is rare, it favours the customer, and unpicking it
 * would mean recomputing a chain — worth knowing about, not worth guessing at.
 */
async function revokeFromRefund(charge: Stripe.Charge) {
  if (!charge.refunded) return { skipped: "partial refund — access left in place" };

  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing — cannot revoke access.");

  const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!intentId) return { skipped: "no payment_intent on the charge" };

  const { data: purchase } = await admin
    .from("purchases")
    .select("id, user_id, status")
    .eq("stripe_payment_intent_id", intentId)
    .single();

  if (!purchase) return { skipped: "no purchase matches that payment intent" };
  if (purchase.status === "refunded") return { duplicate: true };

  const { error } = await admin
    .from("purchases")
    .update({ status: "refunded" } as never)
    .eq("id", purchase.id);
  if (error) throw new Error(`Marking the refund failed: ${error.message}`);

  return { revoked: true, purchase: purchase.id };
}

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
