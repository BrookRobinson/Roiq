// ============================================================
// How many reports this account has used — SERVER ONLY.
//
// Counted from the reports table rather than a counter column, because a
// counter can drift from reality and this one decides whether someone gets
// charged-for work. The rows are the truth; asking them is cheap.
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import {
  allowanceWindowStart,
  quotaFrom,
  type Plan,
  type QuotaState,
} from "@/lib/billing/plans";

/**
 * The account's quota right now.
 *
 * Reports made before signing in belong to a browser cookie until
 * claimReports() attaches them, so counting by user_id alone would miss the
 * report someone ran two minutes before creating their account — which is the
 * normal path through the funnel, not an edge case. Both keys are counted.
 *
 * With no database configured this returns a full allowance rather than zero:
 * local development without Supabase should not be a locked app.
 */
export async function getQuota(
  userId: string | null,
  ownerKey: string | null,
  plan: Plan,
  now: Date = new Date()
): Promise<QuotaState> {
  const supabase = createAdminClient();
  if (!supabase || (!userId && !ownerKey)) return quotaFrom(plan, 0, now);

  try {
    let query = supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("report_status", "complete");

    const since = allowanceWindowStart(plan, now);
    if (since) query = query.gte("created_at", since.toISOString());

    // Either identifier marks the report as this person's.
    const keys = [
      userId ? `user_id.eq.${userId}` : null,
      ownerKey ? `owner_key.eq.${ownerKey}` : null,
    ].filter(Boolean);
    query = query.or(keys.join(","));

    const { count, error } = await query;
    if (error) throw new Error(error.message);

    return quotaFrom(plan, count ?? 0, now);
  } catch (err) {
    // A failed count must not become a free-for-all OR a hard block. Treating
    // it as "allowance used" would lock out paying customers over a transient
    // database blip; treating it as zero would hand out unlimited analyses.
    // Reporting it as one-used splits the difference: the first report of the
    // window still runs, and the logs say why.
    console.warn("[quota] count failed, assuming one used:", (err as Error)?.message);
    return quotaFrom(plan, 1, now);
  }
}
