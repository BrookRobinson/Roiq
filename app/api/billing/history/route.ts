import { NextResponse } from "next/server";

import type { Plan, PurchaseSummary } from "@/lib/billing/plans";
import { daysRemaining, effectivePlan } from "@/lib/billing/plans";
import { getUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/billing/history — this account's plan and every month it has bought.
 *
 * Read through the user's own session, not the service role: `purchases` has a
 * select policy scoped to auth.uid(), so the database enforces that nobody
 * reads someone else's receipts even if this route someday forgets to.
 */
export async function GET() {
  const { authUser, profile } = await getUser().catch(() => ({ authUser: null, profile: null }));

  if (!authUser) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const expiresAt = profile?.plan_expires_at ?? null;
  const supabase = createClient();

  const { data, error } = await supabase
    .from("purchases")
    .select("id, plan, amount_cents, currency, status, receipt_url, access_until, created_at")
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // No purchases table yet is a setup problem, not a broken account — show the
  // plan and an empty list rather than an error page over the whole tab.
  const missingTable = !!error && /relation .*purchases.* does not exist|Could not find the table/i.test(error.message);

  const purchases: PurchaseSummary[] = (data ?? []).map((row) => ({
    id: row.id,
    plan: row.plan as Plan,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    receiptUrl: row.receipt_url,
    accessUntil: row.access_until,
    createdAt: row.created_at,
  }));

  return NextResponse.json({
    ok: true,
    plan: effectivePlan(profile?.plan, expiresAt),
    planExpiresAt: expiresAt,
    daysLeft: daysRemaining(expiresAt),
    purchases,
    setupError: missingTable
      ? "Purchase history isn't set up yet — run supabase/migrations/20260822_billing.sql."
      : error
        ? error.message
        : null,
  });
}
