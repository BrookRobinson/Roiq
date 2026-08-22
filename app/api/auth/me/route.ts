import { NextResponse } from "next/server";

import { getUser } from "@/lib/supabase/auth";
import { daysRemaining, effectivePlan } from "@/lib/billing/plans";
import { emailKey } from "@/lib/auth/email-key";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimReports } from "@/lib/reports/store";
import { readOwnerKey } from "@/lib/reports/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — who's signed in, and on what plan.
 *
 * The whole UI is client components, so rather than thread a server session
 * through every page they ask here once. Returns a null user rather than a 401
 * when signed out: "nobody is signed in" is a normal answer, not an error.
 */
export async function GET() {
  const { authUser, profile } = await getUser().catch(() => ({ authUser: null, profile: null }));

  if (!authUser) {
    return NextResponse.json({
      ok: true,
      user: null,
      plan: "free",
      planExpiresAt: null,
      daysLeft: 0,
      claimed: 0,
    });
  }

  // Reports made before signing in are owned by this browser's cookie. Now that
  // there's a person to attach them to, hand them over — otherwise someone's
  // first act after signing up is watching their own reports disappear.
  const claimed = await claimReports(readOwnerKey(), authUser.id);

  // Keep the account's inbox key current. Done here rather than in the signup
  // trigger because the normalisation rules live in lib/auth/email-key.ts, and
  // a second copy of them in PL/pgSQL would drift from the first. This runs on
  // every session check, so it self-heals for accounts that predate the column.
  await syncEmailKey(authUser.id, authUser.email ?? profile?.email ?? null, profile?.email_key ?? null);

  // The effective plan, not the stored one: a month that has run out reads as
  // free everywhere, and the client must not be the place that forgets to check.
  const expiresAt = profile?.plan_expires_at ?? null;

  return NextResponse.json({
    ok: true,
    user: { id: authUser.id, email: authUser.email ?? profile?.email ?? "" },
    plan: effectivePlan(profile?.plan, expiresAt),
    planExpiresAt: expiresAt,
    daysLeft: daysRemaining(expiresAt),
    claimed,
  });
}

/** Best-effort: a stale key costs someone an extra free report, never access. */
async function syncEmailKey(userId: string, email: string | null, current: string | null): Promise<void> {
  const key = emailKey(email);
  if (!key || key === current) return;
  try {
    const admin = createAdminClient();
    await admin?.from("users").update({ email_key: key } as never).eq("id", userId);
  } catch {
    /* non-fatal */
  }
}
