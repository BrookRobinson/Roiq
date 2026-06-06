import { createClient } from "@/lib/supabase/server";
import type { UserRow } from "@/lib/supabase/types";

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
 * Returns the user's plan, defaulting to "free".
 */
export async function getUserPlan(): Promise<"free" | "starter" | "pro"> {
  const { profile } = await getUser();
  return (profile?.plan as "free" | "starter" | "pro") ?? "free";
}

/**
 * Checks whether the current user has access to a given plan level.
 * Pro ⊃ Starter ⊃ Free.
 */
export async function requirePlan(
  minimum: "free" | "starter" | "pro"
): Promise<boolean> {
  const plan = await getUserPlan();
  const rank: Record<string, number> = { free: 0, starter: 1, pro: 2 };
  return rank[plan] >= rank[minimum];
}
