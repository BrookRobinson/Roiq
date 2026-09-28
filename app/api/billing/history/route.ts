import { NextResponse } from "next/server";

import type { PurchaseSummary } from "@/lib/billing/plans";
import { daysRemaining, planLabel } from "@/lib/billing/plans";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { getQuota } from "@/lib/reports/quota";
import { readOwnerKey } from "@/lib/reports/owner";
import { getUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/billing/history — what this account holds, and every purchase behind it.
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

  const supabase = createClient();

  const { data, error } = await supabase
    .from("purchases")
    .select(
      "id, plan, reports_granted, includes_map, inspections_granted, amount_cents, currency, status, receipt_url, access_until, created_at"
    )
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // No purchases table yet is a setup problem, not a broken account — show what
  // they hold and an empty list rather than an error page over the whole tab.
  const missingTable = !!error && /relation .*purchases.* does not exist|Could not find the table/i.test(error.message);

  const purchases: PurchaseSummary[] = (data ?? []).map((row) => ({
    id: row.id,
    label: planLabel(row.plan),
    reports: row.reports_granted ?? 0,
    map: !!row.includes_map,
    inspections: row.inspections_granted ?? 0,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    receiptUrl: row.receipt_url,
    // Only meaningful on a purchase that carried the map; the others show the
    // date they were bought and nothing that runs out.
    mapUntil: row.includes_map ? row.access_until : null,
    createdAt: row.created_at,
  }));

  const entitlements = await entitlementsFor(authUser.id);
  const quota = await getQuota(
    authUser.id,
    readOwnerKey(),
    entitlements,
    new Date(),
    authUser.email ?? profile?.email ?? null
  );

  return NextResponse.json({
    ok: true,
    entitlements,
    creditsLeft: quota.remaining,
    reportsUsed: quota.used,
    daysLeft: daysRemaining(entitlements.mapUntil),
    purchases,
    setupError: missingTable
      ? "Purchase history isn't set up yet — run supabase/migrations/20260922_packages.sql."
      : error
        ? error.message
        : null,
  });
}
