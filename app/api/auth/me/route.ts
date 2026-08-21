import { NextResponse } from "next/server";

import { getUser } from "@/lib/supabase/auth";
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
    return NextResponse.json({ ok: true, user: null, plan: "free", claimed: 0 });
  }

  // Reports made before signing in are owned by this browser's cookie. Now that
  // there's a person to attach them to, hand them over — otherwise someone's
  // first act after signing up is watching their own reports disappear.
  const claimed = await claimReports(readOwnerKey(), authUser.id);

  return NextResponse.json({
    ok: true,
    user: { id: authUser.id, email: authUser.email ?? profile?.email ?? "" },
    plan: (profile?.plan as "free" | "starter" | "pro") ?? "free",
    claimed,
  });
}
