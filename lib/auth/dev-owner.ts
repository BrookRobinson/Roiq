// ============================================================
// Owner mode — sign-in skipped, top plan granted, LOCAL ONLY.
//
// The owner builds this app on his own machine and does not want to log into it
// to look at his own work. This makes the whole product behave as though a Pro
// account is signed in: no login wall, no upgrade wall, every tab open.
//
// The dangerous version of this feature is a flag that grants Pro to everybody,
// so the guard is deliberately not a setting. `NODE_ENV === "production"` is
// checked FIRST and is not overridable from the environment file — Next sets it
// to "production" for `next build`/`next start` and on Vercel, so a stray
// DEV_OWNER_MODE=true in a deployed environment is inert rather than a free
// giveaway of the paid product. There is no way to turn this on in production
// short of editing this file, which is the point.
//
// It also deliberately does NOT invent a Supabase user. Nothing here writes to
// the database as somebody, and reports made in owner mode still belong to the
// browser's own owner cookie exactly as they did before — so turning it off
// doesn't orphan anything.
// ============================================================

import type { Plan } from "@/lib/billing/plans";

/** The plan owner mode reports. The top tier, which is the whole request. */
export const DEV_OWNER_PLAN: Plan = "pro";

/** A stable label for the UI, so it's obvious this isn't a real account. */
export const DEV_OWNER_EMAIL = "owner@localhost";

/**
 * Is owner mode on?
 *
 * Production is refused before the flag is even read. Both a server-only and a
 * NEXT_PUBLIC_ name are accepted so the same switch works in server routes and
 * in client components, where only NEXT_PUBLIC_ vars exist.
 */
export function isDevOwner(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return (
    process.env.DEV_OWNER_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEV_OWNER_MODE === "true"
  );
}
