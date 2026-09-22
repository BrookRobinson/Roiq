import { createClient } from "@/lib/supabase/server";
import type { UserRow } from "@/lib/supabase/types";
import { includes, type Entitlements, type Feature } from "@/lib/billing/plans";
import { entitlementsFor } from "@/lib/billing/entitlements";

/**
 * Returns the authenticated Supabase user and their profile row.
 * Call from Server Components or Route Handlers only.
 * Returns null for both if not authenticated.
 */
export async function getUser(): Promise<{
  authUser: Awaited<ReturnType<ReturnType<typeof createClient>["auth"]["getUser"]>>["data"]["user"];
  profile: UserRow | null;
}> {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return { authUser: null, profile: null };

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  return { authUser, profile: profile ?? null };
}

/**
 * Everything the caller has bought and not yet used up.
 *
 * `users.plan` is NOT the answer and never was: it records what was last bought
 * and stays there afterwards. Access is computed from the purchase ledger —
 * see lib/billing/entitlements.ts. Reading the column directly is the bug that
 * hands somebody the map forever.
 */
export async function getEntitlements(): Promise<Entitlements> {
  const { authUser } = await getUser().catch(() => ({ authUser: null }));
  return entitlementsFor(authUser?.id ?? null);
}

/**
 * Does the caller have this feature?
 *
 * The question a route should ask. Comparing package names in a handler is how
 * a gate gets left behind when the packages change — and a gate that quietly
 * stops matching is a feature given away, which nothing in the app reports.
 */
export async function hasFeature(feature: Feature): Promise<boolean> {
  return includes(await getEntitlements(), feature);
}
