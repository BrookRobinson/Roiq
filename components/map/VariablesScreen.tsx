"use client";

import { useState } from "react";
import { Wallet, Home, TrendingUp, Sprout, ArrowRight, X } from "lucide-react";
import type { UserVariables, MapMode } from "@/lib/map/types";
import { DEFAULT_VARIABLES, saveVariables } from "@/lib/map/variables";

/**
 * Screen 1 — the user's personal financial variables. Filled once (smart defaults),
 * editable any time via the settings gear on the map. Saved to localStorage and
 * (best effort) the users row.
 */
export function VariablesScreen({
  initial,
  onSaved,
  onClose,
}: {
  initial?: UserVariables | null;
  onSaved: (v: UserVariables) => void;
  onClose?: () => void; // present when reopened from the map
}) {
  const [v, setV] = useState<UserVariables>(initial ?? DEFAULT_VARIABLES);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof UserVariables>(k: K, val: UserVariables[K]) => setV((p) => ({ ...p, [k]: val }));

  async function save() {
    setSaving(true);
    saveVariables(v);
    try {
      await fetch("/api/map/user-variables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
    } catch {
      /* localStorage is the source of truth while auth is bypassed */
    }
    onSaved(v);
  }

  return (
    <div className="min-h-[calc(100vh-64px)] py-8 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Set your numbers
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              These drive every deal colour on the map. Smart defaults are filled in — adjust any that differ for you.
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} className="cursor-pointer mt-1" style={{ color: "var(--text-muted)" }} aria-label="Close">
              <X size={20} />
            </button>
          )}
        </div>

        <div className="space-y-4 mt-6">
          <Section icon={Wallet} title="Purchase">
            <Money label="Deposit amount" value={v.depositAmount} onChange={(n) => set("depositAmount", n)} />
            <Pct label="Interest rate" value={v.interestRatePct} onChange={(n) => set("interestRatePct", n)} />
            <Slider label="Loan term" unit="yrs" value={v.loanTermYears} onChange={(n) => set("loanTermYears", n)} />
            <Slider label="Hold period" unit="yrs" value={v.holdPeriodYears} onChange={(n) => set("holdPeriodYears", n)} />
            <Money label="Buying costs" hint="legal + LIM" value={v.buyingCosts} onChange={(n) => set("buyingCosts", n)} />
            <Money label="Building report" value={v.buildingReport} onChange={(n) => set("buildingReport", n)} />
          </Section>

          <Section icon={Home} title="Selling">
            <Pct label="Agent commission" value={v.agentCommissionPct} onChange={(n) => set("agentCommissionPct", n)} />
            <Money label="Selling legal costs" value={v.sellingLegalCosts} onChange={(n) => set("sellingLegalCosts", n)} />
          </Section>

          <Section icon={TrendingUp} title="Ongoing" note="investor mode">
            <Pct label="Property management" hint="% of rent" value={v.propertyMgmtFeePct} onChange={(n) => set("propertyMgmtFeePct", n)} />
            <Money label="Annual insurance" value={v.annualInsurance} onChange={(n) => set("annualInsurance", n)} />
            <Pct label="Maintenance budget" hint="% of value/yr" value={v.maintenancePct} onChange={(n) => set("maintenancePct", n)} />
            <Pct label="Vacancy rate" hint="% of year" value={v.vacancyRatePct} onChange={(n) => set("vacancyRatePct", n)} />
          </Section>

          <Section icon={Sprout} title="Growth">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs" style={{ color: "var(--text-secondary)" }}>Annual capital growth</label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>
                  <input
                    type="checkbox"
                    checked={v.capitalGrowthPct === null}
                    onChange={(e) => set("capitalGrowthPct", e.target.checked ? null : 5)}
                    style={{ accentColor: "var(--brand)" }}
                  />
                  Auto (each suburb)
                </label>
                {v.capitalGrowthPct !== null && (
                  <div className="relative flex-1">
                    <input
                      className="input text-sm py-1.5 pr-7 w-full"
                      type="number"
                      step="0.1"
                      value={v.capitalGrowthPct}
                      onChange={(e) => set("capitalGrowthPct", Number(e.target.value))}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>%</span>
                  </div>
                )}
              </div>
            </div>
            <Pct label="Rental growth" hint="% pa" value={v.rentalGrowthPct} onChange={(n) => set("rentalGrowthPct", n)} />
          </Section>

          <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Default view</span>
            <div className="flex rounded-lg p-0.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              {(["homebuyer", "investor"] as MapMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => set("defaultMode", m)}
                  className="px-3 py-1 rounded-md text-xs font-semibold cursor-pointer capitalize"
                  style={{
                    background: v.defaultMode === m ? "var(--brand-light)" : "transparent",
                    color: v.defaultMode === m ? "var(--brand)" : "var(--text-muted)",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving} className="btn-primary w-full justify-center mt-6 py-2.5" style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Save & open map"} <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, note, children }: { icon: React.ElementType; title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={15} style={{ color: "var(--brand)" }} />
        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{title}</span>
        {note && (
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{note}</span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function FieldShell({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {label} {hint && <span style={{ color: "var(--text-muted)" }}>· {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Money({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (n: number) => void }) {
  return (
    <FieldShell label={label} hint={hint}>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>$</span>
        <input
          className="input text-sm py-1.5 pl-6 w-full mono"
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    </FieldShell>
  );
}

function Pct({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (n: number) => void }) {
  return (
    <FieldShell label={label} hint={hint}>
      <div className="relative">
        <input
          className="input text-sm py-1.5 pr-7 w-full mono"
          type="number"
          step="0.1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>%</span>
      </div>
    </FieldShell>
  );
}

function Slider({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (n: number) => void }) {
  return (
    <FieldShell label={label}>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={1}
          max={30}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="cursor-pointer flex-1"
          style={{ accentColor: "var(--brand)" }}
        />
        <span className="text-sm font-bold mono w-12 text-right" style={{ color: "var(--brand)" }}>{value}{unit}</span>
      </div>
    </FieldShell>
  );
}
