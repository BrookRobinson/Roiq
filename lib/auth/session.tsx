"use client";

// ============================================================
// Who's signed in, for the client.
//
// Every page in this app is a client component, so rather than thread a server
// session through all of them they read it from here. Fetched once at the root
// and shared, so nine pages don't each ask the same question.
// ============================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { daysRemaining, type Plan } from "@/lib/billing/plans";

export type { Plan };

export interface SessionUser {
  id: string;
  email: string;
}

interface SessionValue {
  user: SessionUser | null;
  /** The plan in force right now — already expiry-checked by /api/auth/me. */
  plan: Plan;
  /** ISO date the purchased month runs out, or null on the free plan. */
  planExpiresAt: string | null;
  /** Whole days left on the current month, 0 when there isn't one. */
  daysLeft: number;
  /** Still fetching — render neither a signed-in nor a signed-out state yet. */
  loading: boolean;
  isPro: boolean;
  isPaid: boolean;
  refresh: () => void;
}

const SessionContext = createContext<SessionValue>({
  user: null,
  plan: "free",
  planExpiresAt: null,
  daysLeft: 0,
  loading: true,
  isPro: false,
  isPaid: false,
  refresh: () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [plan, setPlan] = useState<Plan>("free");
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        setUser(d?.user ?? null);
        setPlan((d?.plan as Plan) ?? "free");
        setPlanExpiresAt((d?.planExpiresAt as string | null) ?? null);
      })
      .catch(() => {
        /* signed out is the safe assumption */
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [nonce]);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      plan,
      planExpiresAt,
      daysLeft: daysRemaining(planExpiresAt),
      loading,
      isPro: plan === "pro",
      isPaid: plan !== "free",
      refresh,
    }),
    [user, plan, planExpiresAt, loading, refresh]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = (): SessionValue => useContext(SessionContext);
