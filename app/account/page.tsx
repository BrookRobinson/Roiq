"use client";

import Navbar from "@/components/Navbar";
import { useState } from "react";
import { CheckCircle2, AlertTriangle, ExternalLink, CreditCard, User, Bell, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/context";

export default function AccountPage() {
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState<"profile" | "plan" | "notifications">("plan");

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Navbar user={{ email: "jane@example.com" }} plan="starter" />
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
  return (
    <div className="space-y-5 max-w-lg">
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Personal information</h2>
        <div>
          <label className="label">Email address</label>
          <input className="input" defaultValue="jane@example.com" type="email" />
        </div>
        <div>
          <label className="label">Display name</label>
          <input className="input" defaultValue="Jane Smith" />
        </div>
        <button className="btn-primary">Save changes</button>
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
          <input className="input" defaultValue="30" type="number" min={5} max={60} />
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
    <div className="space-y-5 max-w-lg">
      {/* Current plan */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Current plan</h2>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold" style={{ color: "var(--brand)" }}>Starter</span>
              <span className="badge badge-blue">$49/mo</span>
            </div>
          </div>
          <CheckCircle2 size={24} style={{ color: "var(--success)" }} />
        </div>
        <div className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          Next billing date: <strong>4 July 2026</strong>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/account/billing"
            className="btn-secondary text-sm gap-1.5"
          >
            <ExternalLink size={13} />
            Manage billing (Stripe)
          </a>
        </div>
      </div>

      {/* Upgrade prompt */}
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
        <a
          href="/pricing"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[var(--brand)] font-semibold text-sm cursor-pointer hover:bg-[var(--brand-light)] transition-colors"
        >
          Upgrade to Pro — $99/mo
        </a>
      </div>

      {/* Invoice history */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Invoice history</h2>
        <div className="space-y-2">
          {[
            { date: "4 Jun 2026", amount: "$49.00", status: "Paid" },
            { date: "4 May 2026", amount: "$49.00", status: "Paid" },
            { date: "4 Apr 2026", amount: "$49.00", status: "Paid" },
          ].map((inv) => (
            <div key={inv.date} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{inv.date}</div>
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{inv.amount}</div>
              <span className="badge badge-green text-xs">{inv.status}</span>
              <a href="/account/billing" className="text-xs cursor-pointer hover:underline" style={{ color: "var(--brand)" }}>
                View
              </a>
            </div>
          ))}
        </div>
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
