import { NextResponse } from "next/server";

import { getUser } from "@/lib/supabase/auth";
import { NO_ENTITLEMENTS } from "@/lib/billing/plans";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { getQuota } from "@/lib/reports/quota";
import { emailKey } from "@/lib/auth/email-key";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimReports } from "@/lib/reports/store";
import { readOwnerKey } from "@/lib/reports/owner";
import { isDevOwner, DEV_OWNER_ENTITLEMENTS, DEV_OWNER_EMAIL } from "@/lib/auth/dev-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — who's signed in, and what they've bought.
 *
 * The whole UI is client components, so rather than thread a server session
 * through every page they ask here once. Returns a null user rather than a 401
 * when signed out: "nobody is signed in" is a normal answer, not an error.
 */
export async function GET() {
  const { authUser, profile } = await getUser().catch(() => ({ authUser: null, profile: null }));

  // Owner mode: report a fully paid-up account without touching the database,
  // so the navbar, the report tabs and the map all behave as they would for a
  // paying customer. Local only — isDevOwner() refuses in production before it
  // reads the flag. See lib/auth/dev-owner.ts.
  if (!authUser && isDevOwner()) {
    return NextResponse.json({
      ok: true,
      user: { id: "dev-owner", email: DEV_OWNER_EMAIL },
      entitlements: DEV_OWNER_ENTITLEMENTS,
      creditsLeft: DEV_OWNER_ENTITLEMENTS.credits,
      claimed: 0,
      devOwner: true,
    });
  }

  if (!authUser) {
    return NextResponse.json({
      ok: true,
      user: null,
      entitlements: NO_ENTITLEMENTS,
      creditsLeft: 0,
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

  // Computed from the purchase ledger, never read off the user row: that column
  // records what was last bought and stays there afterwards. Map access that
  // has run out reads as gone everywhere, and the client must not be the place
  // that remembers to check.
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
    user: { id: authUser.id, email: authUser.email ?? profile?.email ?? "" },
    entitlements,
    creditsLeft: quota.remaining,
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
