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
  formatAccessDate,
  MAP_DAYS,
  PACKAGE_LABEL,
  packageFor,
  priceFor,
  REPORT_PRICE_NZD,
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
  const { entitlements, creditsLeft, daysLeft, user, loading: sessionLoading, refresh } = useSession();
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
  // webhook that grants it by a second or two. Re-ask a couple of times rather
  // than showing someone who just paid that they have nothing.
  useEffect(() => {
    if (!justPurchased || entitlements.paid) return;
    const timers = [1500, 4000].map((ms) => setTimeout(refresh, ms));
    return () => timers.forEach(clearTimeout);
  }, [justPurchased, entitlements.paid, refresh]);

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
            {!entitlements.paid
              ? "Payment received — confirming with Stripe. This page will update in a moment."
              : `Payment received. You have ${creditsLeft} ${creditsLeft === 1 ? "report" : "reports"}${
                  entitlements.map ? ` and the map until ${formatAccessDate(entitlements.mapUntil)}` : ""
                }.`}
          </div>
        </div>
      )}

      {/* What this account holds. Three things, three different clocks — the
          panel says which is which, because "access until" meant one thing when
          everything expired together and means nothing now. */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          What you have
        </h2>

        <div className="grid sm:grid-cols-3 gap-4 mb-5">
          <Holding
            label="Reports"
            value={sessionLoading ? "…" : String(creditsLeft)}
            note="They don't expire"
            good={creditsLeft > 0}
          />
          <Holding
            label="Map"
            value={
              sessionLoading
                ? "…"
                : !entitlements.map
                  ? "Not active"
                  : daysLeft > 0
                    ? `${daysLeft}d left`
                    : "Active"
            }
            note={
              entitlements.map && entitlements.mapUntil
                ? `Until ${formatAccessDate(entitlements.mapUntil)}`
                : `${PACKAGE_LABEL[packageFor("map")]} includes it`
            }
            good={entitlements.map}
          />
          <Holding
            label="Inspection"
            value={
              sessionLoading
                ? "…"
                : entitlements.inspections > 0
                  ? `${entitlements.inspections} owed`
                  : "None booked"
            }
            note={
              entitlements.inspections > 0
                ? "We'll be in touch to book it"
                : `${PACKAGE_LABEL.gold} includes one`
            }
            good={entitlements.inspections > 0}
          />
        </div>

        {!sessionLoading && creditsLeft === 0 && (
          <div
            className="rounded-xl p-4 text-sm"
            style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
          >
            <div className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              You&rsquo;re out of reports
            </div>
            Credits don&rsquo;t expire, so buying more adds to the account rather than replacing
            anything — 10 for ${REPORT_PRICE_NZD[10]}, or {PACKAGE_LABEL.silver} at $
            {priceFor("silver").toLocaleString("en-NZ")} for 50 and the map for {MAP_DAYS} days.
            <div className="mt-3">
              <BuyPlanButton
                pkg="bronze"
                quantity={10}
                label={`Get 10 more — $${REPORT_PRICE_NZD[10]}`}
                className="btn-secondary text-sm gap-1.5"
                returnTo="/account"
              />
            </div>
          </div>
        )}

        {!sessionLoading && creditsLeft > 0 && !entitlements.map && (
          <div
            className="rounded-xl p-4 text-sm"
            style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
          >
            <div className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Add the map
            </div>
            Every property for sale in New Zealand, and the full report on the ones somebody has
            analysed. {PACKAGE_LABEL.silver} is 50 more reports and {MAP_DAYS} days of it.
            <div className="mt-3">
              <BuyPlanButton
                pkg="silver"
                label={`Get ${PACKAGE_LABEL.silver} — $${priceFor("silver").toLocaleString("en-NZ")}`}
                className="btn-secondary text-sm gap-1.5"
                returnTo="/account"
              />
            </div>
          </div>
        )}
      </div>

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

/** One of the three things an account can hold. */
function Holding({
  label,
  value,
  note,
  good,
}: {
  label: string;
  value: string;
  note: string;
  good: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div
        className="text-2xl font-bold mt-0.5"
        style={{ color: good ? "var(--brand)" : "var(--text-muted)" }}
      >
        {value}
      </div>
      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
        {note}
      </div>
    </div>
  );
}
