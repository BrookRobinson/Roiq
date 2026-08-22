"use client";

import { blurOnWheel } from "@/lib/ui/number-input";
import Navbar from "@/components/Navbar";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, AlertTriangle, ExternalLink, CreditCard, User, Bell, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/context";
import { useSession } from "@/lib/auth/session";
import BuyPlanButton from "@/components/billing/BuyPlanButton";
import PurchaseRow from "@/components/billing/PurchaseRow";
import {
  ACCESS_DAYS,
  formatAccessDate,
  PLAN_LABEL,
  PLAN_PRICE_NZD,
  type PurchaseSummary,
} from "@/lib/billing/plans";

export default function AccountPage() {
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState<"profile" | "plan" | "notifications">("plan");

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
          Account settings
        </h1>

        {/* Tab nav */}
        <div className="tab-nav mb-6 w-fit">
          {[
            { id: "profile", label: "Profile", icon: User },
            { id: "plan", label: "Plan & billing", icon: CreditCard },
            { id: "notifications", label: "Notifications", icon: Bell },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`tab-btn flex items-center gap-1.5 ${tab === t.id ? "active" : ""}`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "profile" && <ProfileTab theme={theme} onToggleTheme={toggle} />}
        {tab === "plan" && <PlanTab />}
        {tab === "notifications" && <NotificationsTab />}
      </div>
    </div>
  );
}

function ProfileTab({ theme, onToggleTheme }: { theme: string; onToggleTheme: () => void }) {
  const { user, loading } = useSession();
  return (
    <div className="space-y-5 max-w-lg">
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Personal information</h2>
        <div>
          <label className="label">Email address</label>
          {/* Read-only: the email IS the login, so changing it is an auth
              operation (re-verification), not a profile edit. */}
          <input
            className="input"
            value={loading ? "" : (user?.email ?? "Not signed in")}
            type="email"
            readOnly
            disabled
          />
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Preferences</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Dark mode</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>Switch between light and dark theme</div>
          </div>
          <button
            onClick={onToggleTheme}
            className="w-12 h-6 rounded-full relative cursor-pointer transition-colors"
            style={{ background: theme === "dark" ? "var(--brand)" : "var(--surface-2)", border: "2px solid var(--border)" }}
            role="switch"
            aria-checked={theme === "dark"}
          >
            <div
              className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform"
              style={{ left: 2, transform: theme === "dark" ? "translateX(24px)" : "translateX(0)" }}
            />
          </button>
        </div>
        <div>
          <label className="label">Default deposit %</label>
          <input className="input" defaultValue="30" type="number" onWheel={blurOnWheel} min={5} max={60} />
          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Used as default in map and calculator</div>
        </div>
        <div>
          <label className="label">Currency</label>
          <select className="input cursor-pointer">
            <option value="NZD">NZD — New Zealand Dollar</option>
            <option value="AUD">AUD — Australian Dollar</option>
          </select>
        </div>
      </div>

      <div className="card p-6 space-y-3">
        <h2 className="font-semibold" style={{ color: "var(--danger)" }}>Danger zone</h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Deleting your account permanently removes all reports and data. This cannot be undone.
        </p>
        <button className="btn-secondary text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          Delete my account
        </button>
      </div>
    </div>
  );
}

function PlanTab() {
  return (
    <Suspense fallback={null}>
      <PlanTabInner />
    </Suspense>
  );
}

/**
 * Plan and receipts, read from the account rather than mocked.
 *
 * There is no subscription and no billing portal: a purchase buys a fixed
 * window and stops. So this answers the two questions someone actually has —
 * when does my access run out, and what have I paid — instead of a next
 * billing date that will never arrive.
 */
function PlanTabInner() {
  const { plan, planExpiresAt, daysLeft, user, loading: sessionLoading, refresh } = useSession();
  const params = useSearchParams();
  const justPurchased = params.get("purchase") === "success";

  const [purchases, setPurchases] = useState<PurchaseSummary[] | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let live = true;
    fetch("/api/billing/history")
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        setPurchases((d?.purchases as PurchaseSummary[]) ?? []);
        setSetupError((d?.setupError as string | null) ?? null);
      })
      .catch(() => live && setPurchases([]));
    return () => {
      live = false;
    };
  }, [user]);

  // Stripe redirects back the moment the payment is taken, which can beat the
  // webhook that grants the plan by a second or two. Re-ask a couple of times
  // rather than showing someone who just paid that they're still on Free.
  useEffect(() => {
    if (!justPurchased || plan !== "free") return;
    const timers = [1500, 4000].map((ms) => setTimeout(refresh, ms));
    return () => timers.forEach(clearTimeout);
  }, [justPurchased, plan, refresh]);

  const expiringSoon = plan !== "free" && daysLeft <= 5;

  return (
    <div className="space-y-5 max-w-lg">
      {justPurchased && (
        <div
          className="card p-4 flex items-start gap-3"
          style={{ borderColor: "var(--success)" }}
          role="status"
        >
          <CheckCircle2 size={18} style={{ color: "var(--success)", flexShrink: 0, marginTop: 1 }} />
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {plan === "free"
              ? "Payment received — confirming with Stripe. This page will update in a moment."
              : `Payment received. ${PLAN_LABEL[plan]} is active until ${formatAccessDate(planExpiresAt)}.`}
          </div>
        </div>
      )}

      {/* Current plan */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Current plan</h2>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold" style={{ color: "var(--brand)" }}>
                {sessionLoading ? "…" : PLAN_LABEL[plan]}
              </span>
              {plan !== "free" && (
                <span className="badge badge-blue">${PLAN_PRICE_NZD[plan]} / month</span>
              )}
            </div>
          </div>
          {plan === "free" ? (
            <AlertTriangle size={24} style={{ color: "var(--text-muted)" }} />
          ) : (
            <CheckCircle2 size={24} style={{ color: "var(--success)" }} />
          )}
        </div>

        <div className="text-sm mb-4" style={{ color: expiringSoon ? "var(--danger)" : "var(--text-secondary)" }}>
          {sessionLoading ? (
            "Checking your plan…"
          ) : plan === "free" ? (
            `You're on the free plan. A paid month lasts ${ACCESS_DAYS} days and nothing auto-renews.`
          ) : (
            <>
              Access until <strong>{formatAccessDate(planExpiresAt)}</strong>
              {daysLeft > 0 ? ` — ${daysLeft} day${daysLeft === 1 ? "" : "s"} left.` : "."}
              {" "}Nothing auto-renews, so it simply stops on that date.
            </>
          )}
        </div>

        {plan !== "free" && (
          <BuyPlanButton
            plan={plan}
            label={`Add another month of ${PLAN_LABEL[plan]}`}
            className="btn-secondary text-sm gap-1.5"
            returnTo="/account"
          />
        )}
      </div>

      {/* Upgrade prompt — only when there's something to upgrade to. */}
      {plan !== "pro" && (
        <div
          className="rounded-2xl p-6"
          style={{
            background: "linear-gradient(160deg, #091e1e 0%, #0a2420 100%)",
          }}
        >
          <div className="font-bold text-lg mb-1">Upgrade to Pro</div>
          <div className="text-[var(--text-secondary)] text-sm mb-4">Get the NZ investment map + batch reports</div>
          <ul className="space-y-2 mb-5">
            {[
              "NZ-wide investment map",
              "10-year profit on every listing",
              "Filters, alerts, watchlist",
              "Batch reports & compare mode",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <CheckCircle2 size={14} style={{ color: "var(--green)" }} />
                {f}
              </li>
            ))}
          </ul>
          <BuyPlanButton
            plan="pro"
            label={`Get Pro, $${PLAN_PRICE_NZD.pro} for ${ACCESS_DAYS} days`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[var(--brand)] font-semibold text-sm cursor-pointer hover:bg-[var(--brand-light)] transition-colors"
            returnTo="/account"
          />
        </div>
      )}

      {/* Purchase history */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Purchases</h2>
          <a href="/account/billing" className="text-xs cursor-pointer hover:underline" style={{ color: "var(--brand)" }}>
            See all
          </a>
        </div>

        {setupError ? (
          <p className="text-sm" style={{ color: "var(--danger)" }}>{setupError}</p>
        ) : purchases === null ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
        ) : purchases.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nothing yet. Anything you buy shows up here with its Stripe receipt.
          </p>
        ) : (
          <div className="space-y-2">
            {purchases.slice(0, 5).map((inv) => (
              <PurchaseRow key={inv.id} purchase={inv} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [alerts, setAlerts] = useState([
    { id: 1, label: "New high-score listing in saved suburb", enabled: true },
    { id: 2, label: "Price reduction on watchlisted property", enabled: true },
    { id: 3, label: "Report generation complete", enabled: true },
    { id: 4, label: "Weekly market digest", enabled: false },
    { id: 5, label: "Product updates and new features", enabled: false },
  ]);

  function toggle(id: number) {
    setAlerts((a) => a.map((n) => n.id === id ? { ...n, enabled: !n.enabled } : n));
  }

  return (
    <div className="max-w-lg">
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Email notifications</h2>
        {alerts.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-1">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{a.label}</span>
            <button
              onClick={() => toggle(a.id)}
              className="w-10 h-5 rounded-full relative cursor-pointer transition-colors"
              style={{ background: a.enabled ? "var(--brand)" : "var(--surface-2)", border: "2px solid var(--border)" }}
              role="switch"
              aria-checked={a.enabled}
            >
              <div
                className="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform"
                style={{ left: 2, transform: a.enabled ? "translateX(20px)" : "translateX(0)" }}
              />
            </button>
          </div>
        ))}
        <button className="btn-primary mt-2">Save preferences</button>
      </div>
    </div>
  );
}
