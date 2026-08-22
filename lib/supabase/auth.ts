import { createClient } from "@/lib/supabase/server";
import type { UserRow } from "@/lib/supabase/types";
import { effectivePlan, planMeets, type Plan } from "@/lib/billing/plans";

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
 * The plan the user actually has right now.
 *
 * `users.plan` alone is not the answer: it records what was last bought and
 * stays there after the month runs out. Access is the plan paired with an
 * expiry still in the future, which is what effectivePlan checks. Reading the
 * column directly is the bug that hands someone Pro forever.
 */
export async function getUserPlan(): Promise<Plan> {
  const { profile } = await getUser();
  return effectivePlan(profile?.plan, profile?.plan_expires_at);
}

/**
 * Checks whether the current user has access to a given plan level.
 * Pro ⊃ Starter ⊃ Free.
 */
export async function requirePlan(minimum: Plan): Promise<boolean> {
  return planMeets(await getUserPlan(), minimum);
}
