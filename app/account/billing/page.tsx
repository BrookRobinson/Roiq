"use client";

// ============================================================
// Everything this account has bought.
//
// This used to be a link to a Stripe customer portal, which was wrong twice
// over: the URL was a literal placeholder, and there is no subscription to
// manage — a purchase buys a fixed window and stops. What someone actually
// needs from a billing page here is their receipts and the date access ends.
// ============================================================

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { CreditCard } from "lucide-react";

import PurchaseRow from "@/components/billing/PurchaseRow";
import BuyPlanButton from "@/components/billing/BuyPlanButton";
import { useSession } from "@/lib/auth/session";
import {
  formatAccessDate,
  MAP_DAYS,
  PACKAGE_LABEL,
  priceFor,
  REPORT_PRICE_NZD,
  type PurchaseSummary,
} from "@/lib/billing/plans";

interface HistoryResponse {
  ok?: boolean;
  purchases?: PurchaseSummary[];
  setupError?: string | null;
  error?: string;
}

export default function BillingPage() {
  const { entitlements, creditsLeft, user, loading: sessionLoading } = useSession();
  const [purchases, setPurchases] = useState<PurchaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setPurchases([]);
      setError("Sign in to see your purchases.");
      return;
    }

    let live = true;
    fetch("/api/billing/history")
      .then((r) => r.json() as Promise<HistoryResponse>)
      .then((d) => {
        if (!live) return;
        setPurchases(d.purchases ?? []);
        setError(d.setupError ?? d.error ?? null);
      })
      .catch(() => {
        if (live) {
          setPurchases([]);
          setError("Couldn't load your purchases just now.");
        }
      });
    return () => {
      live = false;
    };
  }, [user, sessionLoading]);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          Purchases
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Reports are yours once you buy them and never expire. Map access is the one
          thing on a clock — {MAP_DAYS} days from purchase, and buying again adds to what
          is left rather than replacing it. Nothing auto-renews, so there is no card on
          file to update and no subscription to cancel.
        </p>

        <div className="card p-6 mb-5">
          <div className="flex items-center gap-3 mb-2">
            <CreditCard size={18} style={{ color: "var(--brand)" }} />
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {sessionLoading
                ? "…"
                : `${creditsLeft} ${creditsLeft === 1 ? "report" : "reports"} left`}
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {sessionLoading
              ? ""
              : entitlements.map && entitlements.mapUntil
                ? `Reports don't expire. Map access runs to ${formatAccessDate(entitlements.mapUntil)}.`
                : "Reports don't expire. No map access at the moment."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <BuyPlanButton
              pkg="bronze"
              quantity={10}
              label={`10 more reports — $${REPORT_PRICE_NZD[10]}`}
              className="btn-secondary text-sm gap-1.5"
              returnTo="/account/billing"
            />
            <BuyPlanButton
              pkg="silver"
              label={`${PACKAGE_LABEL.silver} — $${priceFor("silver").toLocaleString("en-NZ")}`}
              className="btn-secondary text-sm gap-1.5"
              returnTo="/account/billing"
            />
          </div>
        </div>

        <div className="card p-6">
          {error ? (
            <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
          ) : purchases === null ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
          ) : purchases.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No purchases yet.
            </p>
          ) : (
            <div className="space-y-2">
              {purchases.map((p) => (
                <PurchaseRow key={p.id} purchase={p} />
              ))}
            </div>
          )}
        </div>

        <a href="/account" className="text-sm mt-6 inline-block cursor-pointer hover:underline" style={{ color: "var(--text-muted)" }}>
          ← Back to account settings
        </a>
      </div>
    </div>
  );
}
