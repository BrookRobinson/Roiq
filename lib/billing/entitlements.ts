// ============================================================
// What an account actually has — SERVER ONLY.
//
// Computed from the `purchases` rows every time, never read off a counter on
// the user. The rows are the ledger: credits are SUMMED from them and spending
// is counted separately from the reports table, so nothing is ever decremented
// and there is no balance to drift, double-spend or lose to a replayed webhook.
// It is the same reasoning as lib/reports/quota.ts — a number that can be wrong
// silently should be derived, not stored.
//
// A refunded purchase grants nothing. That is the one case where the ledger has
// to be read rather than trusted: the row stays for the receipt, so status is
// part of the sum, not a reason to delete it.
// ============================================================

import {
  mapActive,
  NO_ENTITLEMENTS,
  type Entitlements,
} from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevOwner, DEV_OWNER_ENTITLEMENTS } from "@/lib/auth/dev-owner";

/** Rows that count. A refund revokes what it bought. */
const COUNTS = (status: string) => status === "paid";

/**
 * Everything `userId` is entitled to right now.
 *
 * Signed out, or with no database, returns nothing — the free report is granted
 * by the quota, not here, so "no entitlements" is the correct answer for an
 * anonymous visitor rather than a failure.
 */
export async function entitlementsFor(
  userId: string | null,
  now: Date = new Date()
): Promise<Entitlements> {
  if (isDevOwner()) return DEV_OWNER_ENTITLEMENTS;
  if (!userId) return NO_ENTITLEMENTS;

  const supabase = createAdminClient();
  if (!supabase) return NO_ENTITLEMENTS;

  const { data, error } = await supabase
    .from("purchases")
    .select(
      "status, reports_granted, includes_map, inspections_granted, inspection_fulfilled_at, access_until"
    )
    .eq("user_id", userId);

  // Fail CLOSED. Handing out entitlements on a database blip would give away
  // the paid product to anyone who hit it at the right moment; refusing costs a
  // paying customer a retry and a line in the log, which someone will report.
  if (error || !data) {
    if (error) console.warn("[entitlements] read failed:", error.message);
    return NO_ENTITLEMENTS;
  }

  let credits = 0;
  let inspections = 0;
  let paid = false;
  let mapUntil: string | null = null;

  for (const row of data) {
    if (!COUNTS(row.status)) continue;
    paid = true;
    credits += row.reports_granted ?? 0;
    if (row.inspections_granted && !row.inspection_fulfilled_at) {
      inspections += row.inspections_granted;
    }
    // The furthest-out map expiry wins. Purchases extend rather than reset, so
    // this is already the accumulated date rather than one month from one row.
    if (row.includes_map && row.access_until) {
      if (!mapUntil || new Date(row.access_until) > new Date(mapUntil)) {
        mapUntil = row.access_until;
      }
    }
  }

  return {
    credits,
    paid,
    map: mapActive(mapUntil, now),
    mapUntil,
    inspections,
  };
}

/**
 * Credits minus what's been spent.
 *
 * Spending is the count of complete reports, which lives in lib/reports/quota
 * because it has to count a signed-out browser's reports too. This is the
 * grant half.
 */
export const creditsGranted = (ent: Entitlements): number => ent.credits;
