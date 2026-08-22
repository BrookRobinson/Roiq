// ============================================================
// How many reports this account has used — SERVER ONLY.
//
// Counted from the reports table rather than a counter column, because a
// counter can drift from reality and this one decides whether someone gets
// charged-for work. The rows are the truth; asking them is cheap.
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { emailKey } from "@/lib/auth/email-key";
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
  now: Date = new Date(),
  email: string | null = null
): Promise<QuotaState> {
  const supabase = createAdminClient();
  if (!supabase || (!userId && !ownerKey)) return quotaFrom(plan, 0, now);

  try {
    // Signed in → count the person, by inbox. Signed out → count the browser,
    // which is the only handle there is.
    //
    // A signed-in person is NOT counted by browser, deliberately. Two people
    // looking at houses on one laptop is the normal case for this product, and
    // the cookie can't tell a partner from a second account — it refused the
    // second person a report they had never used. The report they ran before
    // signing up still counts, because claimReports() attaches it to them.
    const ids = userId ? await accountsSharingInbox(supabase, userId, email) : [];

    const keys = userId
      ? ids.map((id) => `user_id.eq.${id}`)
      : [`owner_key.eq.${ownerKey}`];
    if (keys.length === 0) return quotaFrom(plan, 0, now);

    let query = supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("report_status", "complete")
      .or(keys.join(","));

    const since = allowanceWindowStart(plan, now);
    if (since) query = query.gte("created_at", since.toISOString());

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

/**
 * Every account that reaches the same inbox, including this one.
 *
 * you+1@gmail.com and y.o.u@gmail.com are one person collecting free reports;
 * two partners on one laptop are two inboxes and stay separate. An account
 * whose key can't be worked out is treated as its own person — erring toward
 * letting someone through rather than refusing them.
 */
async function accountsSharingInbox(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  email: string | null
): Promise<string[]> {
  let key = emailKey(email);

  if (!key) {
    const { data } = await supabase.from("users").select("email, email_key").eq("id", userId).single();
    key = emailKey(data?.email) ?? data?.email_key ?? null;
  }
  if (!key) return [userId];

  const { data } = await supabase.from("users").select("id").eq("email_key", key).limit(50);
  const ids = (data ?? []).map((r) => r.id);
  return ids.includes(userId) ? ids : [...ids, userId];
}
