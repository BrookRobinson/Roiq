"use client";

// ============================================================
// Who's signed in, for the client.
//
// Every page in this app is a client component, so rather than thread a server
// session through all of them they read it from here. Fetched once at the root
// and shared, so nine pages don't each ask the same question.
// ============================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  daysRemaining,
  includes,
  NO_ENTITLEMENTS,
  type Entitlements,
  type Feature,
} from "@/lib/billing/plans";

export type { Entitlements };

export interface SessionUser {
  id: string;
  email: string;
}

interface SessionValue {
  user: SessionUser | null;
  /** Everything bought and not yet used — already computed by /api/auth/me. */
  entitlements: Entitlements;
  /** Report credits left, after what's been run. */
  creditsLeft: number;
  /** Whole days of map access left, 0 when there is none. */
  daysLeft: number;
  /** Still fetching — render neither a signed-in nor a signed-out state yet. */
  loading: boolean;
  /**
   * Does this account have the feature? The one question a gate should ask —
   * a package-name comparison goes stale the moment the packages change.
   */
  can: (feature: Feature) => boolean;
  /** Has ever bought anything. */
  isPaid: boolean;
  refresh: () => void;
}

const SessionContext = createContext<SessionValue>({
  user: null,
  entitlements: NO_ENTITLEMENTS,
  creditsLeft: 0,
  daysLeft: 0,
  loading: true,
  can: () => false,
  isPaid: false,
  refresh: () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements>(NO_ENTITLEMENTS);
  const [creditsLeft, setCreditsLeft] = useState(0);
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
        setEntitlements((d?.entitlements as Entitlements) ?? NO_ENTITLEMENTS);
        setCreditsLeft(Number(d?.creditsLeft ?? 0));
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
      entitlements,
      creditsLeft,
      daysLeft: daysRemaining(entitlements.mapUntil),
      loading,
      can: (feature: Feature) => includes(entitlements, feature),
      isPaid: entitlements.paid,
      refresh,
    }),
    [user, entitlements, creditsLeft, loading, refresh]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = (): SessionValue => useContext(SessionContext);
