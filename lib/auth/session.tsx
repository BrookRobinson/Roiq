"use client";

// ============================================================
// Who's signed in, for the client.
//
// Every page in this app is a client component, so rather than thread a server
// session through all of them they read it from here. Fetched once at the root
// and shared, so nine pages don't each ask the same question.
// ============================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Plan = "free" | "starter" | "pro";

export interface SessionUser {
  id: string;
  email: string;
}

interface SessionValue {
  user: SessionUser | null;
  plan: Plan;
  /** Still fetching — render neither a signed-in nor a signed-out state yet. */
  loading: boolean;
  isPro: boolean;
  refresh: () => void;
}

const SessionContext = createContext<SessionValue>({
  user: null,
  plan: "free",
  loading: true,
  isPro: false,
  refresh: () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [plan, setPlan] = useState<Plan>("free");
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
    () => ({ user, plan, loading, isPro: plan === "pro", refresh }),
    [user, plan, loading, refresh]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = (): SessionValue => useContext(SessionContext);
