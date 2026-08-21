"use client";

// Gate hook — call at the top of a page that requires a signed-in user.
// Returns true once a session is confirmed; otherwise sends them to /login with
// a return path so they land back where they were trying to go.
//
// Replaces the prototype `useRequireAccount`, which gated on a localStorage
// "account" that no server ever saw — anyone could set it, and it identified
// nobody. Real sessions come from Supabase and the server can verify them.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "./session";

export function useRequireAuth(next: string): boolean {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading || user) return;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [loading, user, next, router]);

  // Don't render the gated page while we're still deciding — otherwise it
  // flashes up for a moment before the redirect.
  return !loading && !!user;
}
