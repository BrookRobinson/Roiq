"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Home, TrendingUp, ArrowRight } from "lucide-react";

type Role = "buyer" | "investor" | "both";

export default function SimpleOnboardingPage() {
  const router = useRouter();
  const [role, setRole]       = useState<Role | null>(null);
  const [holdYears, setHold]  = useState(10);
  const [budget, setBudget]   = useState("");
  const [saving, setSaving]   = useState(false);

  async function finish() {
    if (!role) return;
    setSaving(true);
    // TODO: save to Supabase user profile
    await new Promise((r) => setTimeout(r, 600));
    router.push("/dashboard");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="font-bold text-2xl mb-1" style={{ color: "var(--brand)" }}>BDR Report</div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Quick setup — 30 seconds</p>
        </div>

        <div className="rounded-2xl p-7" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="text-xl font-bold mb-5" style={{ color: "var(--text-primary)" }}>Tell us about yourself</h2>

          {/* Role */}
          <div className="mb-5">
            <label className="label">Are you a home buyer or investor?</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "buyer",    icon: Home,        label: "Buyer"    },
                { id: "investor", icon: TrendingUp,  label: "Investor" },
                { id: "both",     icon: null,        label: "Both"     },
              ] as const).map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className="p-3 rounded-xl text-sm font-semibold cursor-pointer transition-all text-center"
                  style={{
                    border: `1.5px solid ${role === r.id ? "var(--brand)" : "var(--border)"}`,
                    background: role === r.id ? "var(--brand-light)" : "var(--surface-2)",
                    color: role === r.id ? "var(--brand)" : "var(--text-secondary)",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hold period */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="label" style={{ marginBottom: 0 }}>
                How long do you plan to hold?
              </label>
              <span className="font-bold mono text-sm" style={{ color: "var(--brand)" }}>{holdYears} yrs</span>
            </div>
            <input
              type="range" min={1} max={40} value={holdYears}
              onChange={(e) => setHold(Number(e.target.value))}
              className="w-full cursor-pointer"
              style={{ accentColor: "var(--brand)" }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              <span>1 yr</span><span>10 yrs</span><span>20 yrs</span><span>40 yrs</span>
            </div>
          </div>

          {/* Budget */}
          <div className="mb-6">
            <label className="label">Maximum budget</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold" style={{ color: "var(--text-muted)" }}>$</span>
              <input
                type="text"
                className="input pl-7"
                placeholder="e.g. 750,000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={finish}
            disabled={!role || saving}
            className="btn-primary w-full justify-center py-3 text-base"
            style={{ opacity: !role || saving ? 0.5 : 1 }}
          >
            {saving ? "Setting up…" : <>Take me to my dashboard <ArrowRight size={16} /></>}
          </button>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "var(--text-muted)" }}>
          These can be changed anytime from Account → Preferences
        </p>
      </div>
    </div>
  );
}
