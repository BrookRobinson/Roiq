"use client";

// ============================================================
// The button that actually takes money.
//
// Used on the pricing page and in the account tab so both start checkout the
// same way — including the awkward cases (signed out, already on a higher
// plan), which are the ones that get forgotten when this is inlined twice.
// ============================================================

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { PLAN_LABEL, type PaidPlan } from "@/lib/billing/plans";
import { useSession } from "@/lib/auth/session";

interface Props {
  plan: PaidPlan;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Where to come back to after signing in. */
  returnTo?: string;
}

export default function BuyPlanButton({ plan, label, className, style, returnTo = "/pricing" }: Props) {
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);

    // Checkout needs an account to grant the plan to. Send them to sign up with
    // the plan remembered, rather than letting the API turn them away with a 401.
    if (!user) {
      router.push(`/signup?plan=${plan}&next=${encodeURIComponent(returnTo)}`);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;

      if (data?.ok && data.url) {
        // Full navigation, not router.push — Stripe's checkout is another origin.
        window.location.href = data.url;
        return;
      }

      setError(data?.error ?? "Couldn't start checkout. Try again in a moment.");
    } catch {
      setError("Couldn't reach the payment service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={busy || sessionLoading}
        className={className}
        style={{ ...style, opacity: busy || sessionLoading ? 0.65 : 1 }}
      >
        {busy ? "Opening checkout…" : (label ?? `Get ${PLAN_LABEL[plan]}`)}
        {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
      </button>
      {error && (
        <p className="text-xs mt-2 text-center" style={{ color: "var(--danger)" }} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
