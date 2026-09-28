"use client";

import { blurOnWheel } from "@/lib/ui/number-input";
import { useEffect, useState } from "react";
import { Wallet, ArrowRight, X, Search, Check } from "lucide-react";
import { TYPE_OPTIONS } from "@/lib/map/type-options";
import type { UserVariables, MapMode } from "@/lib/map/types";
import type { LoanType } from "@/lib/finance/calculator";
import { DEFAULT_VARIABLES, saveVariables } from "@/lib/map/variables";

/**
 * Screen 1 — the user's personal financial variables. Starts EMPTY: every number
 * blank and nothing chosen, because these are the reader's numbers and a
 * pre-filled one is ours pretending to be theirs. Editable any time from the
 * Variables button on the map. Saved to localStorage and
 * (best effort) the users row.
 */
export function VariablesScreen({
  initial,
  liveRatePct,
  rateNote,
  rateSource,
  onSaved,
  onClose,
}: {
  initial?: UserVariables | null;
  /** Today's mortgage rate, once the lookup returns. */
  liveRatePct?: number | null;
  /** Short attribution for the pre-filled interest rate, when it came from a live lookup. */
  rateNote?: string | null;
  /** The full citation behind `rateNote`, shown on hover. */
  rateSource?: string | null;
  onSaved: (v: UserVariables) => void;
  onClose?: () => void; // present when reopened from the map
}) {
  const [v, setV] = useState<UserVariables>(initial ?? DEFAULT_VARIABLES);
  // The numbers are held as TEXT so a box can be empty (a number can't be), and
  // the two choices as null until picked. A first visit starts with nothing.
  const blank = !initial;
  const [nums, setNums] = useState<Record<NumKey, string>>(() => ({
    budget: blank || !initial.budget ? "" : String(initial.budget),
    depositAmount: blank ? "" : String(initial.depositAmount),
    interestRatePct: blank ? "" : String(initial.interestRatePct),
    loanTermYears: blank ? "" : String(initial.loanTermYears),
    holdPeriodYears: blank ? "" : String(initial.holdPeriodYears),
  }));
  const [repayment, setRepayment] = useState<LoanType | null>(blank ? null : initial.repaymentType ?? "pi");
  const [defaultMode, setDefaultMode] = useState<MapMode | null>(blank ? null : initial.defaultMode);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const setNum = (k: NumKey, val: string) => setNums((p) => ({ ...p, [k]: val }));
  const num = (k: NumKey) => (nums[k].trim() === "" ? null : Number(nums[k]));
  // What the map can't work without. Budget, types and default view may stay blank.
  const missing = [
    num("depositAmount") == null && "deposit",
    num("interestRatePct") == null && "interest rate",
    num("loanTermYears") == null && "loan term",
    num("holdPeriodYears") == null && "hold period",
    repayment == null && "loan repayments",
  ].filter(Boolean) as string[];
  // How many of each type the map can draw right now. A listing is found by
  // address first and located later, so a type can hold thousands with only a
  // few placed — and picking it with no warning looks like a broken, empty map.
  const [counts, setCounts] = useState<Record<string, { total: number; mapped: number }> | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/map/type-counts")
      .then((r) => r.json())
      .then((d) => { if (live && d?.ok) setCounts(d.counts); })
      .catch(() => { /* the choices still work without the numbers */ });
    return () => { live = false; };
  }, []);

  const set = <K extends keyof UserVariables>(k: K, val: UserVariables[K]) => setV((p) => ({ ...p, [k]: val }));

  async function save() {
    setTried(true);
    if (missing.length) return;
    setSaving(true);
    const out: UserVariables = {
      ...v,
      budget: num("budget") ?? 0, // blank = no limit
      depositAmount: num("depositAmount")!,
      interestRatePct: num("interestRatePct")!,
      loanTermYears: Math.max(1, Math.min(30, Math.round(num("loanTermYears")!))),
      holdPeriodYears: Math.max(1, Math.min(30, Math.round(num("holdPeriodYears")!))),
      repaymentType: repayment!,
      defaultMode: defaultMode ?? "homebuyer",
    };
    saveVariables(out);
    try {
      await fetch("/api/map/user-variables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(out),
      });
    } catch {
      /* localStorage is the source of truth while auth is bypassed */
    }
    onSaved(out);
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
              These drive every deal colour on the map. Fill in your own — nothing is assumed.
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} className="cursor-pointer mt-1" style={{ color: "var(--text-muted)" }} aria-label="Close">
              <X size={20} />
            </button>
          )}
        </div>

        <div className="space-y-4 mt-6">
          {/* What they're shopping for. It narrows the pins and the Top list, so a
              great deal on a bare section never tops the list for someone who
              only wants a house. */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Search size={15} style={{ color: "var(--brand)" }} />
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Property types you want</span>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              Only these show on the map and in Best deals for you. Leave all unticked to see every type.
            </p>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((o) => {
                const on = v.propertyTypes.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() =>
                      set("propertyTypes", on ? v.propertyTypes.filter((t) => t !== o.value) : [...v.propertyTypes, o.value])
                    }
                    aria-pressed={on}
                    title={o.hint}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer"
                    style={{
                      background: on ? "var(--accent-wash)" : "var(--surface-2)",
                      border: `1px solid ${on ? "var(--brand)" : "var(--border)"}`,
                      color: on ? "var(--brand)" : "var(--text-secondary)",
                    }}
                  >
                    {on && <Check size={12} />}
                    {o.label}
                    {counts?.[o.value] && (
                      <span className="mono text-[11px]" style={{ opacity: 0.7 }}>
                        {counts[o.value].mapped.toLocaleString("en-NZ")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* The honest gap, for the types chosen: silence here is what made a
                half-located type look like one with nothing in it. */}
            {counts &&
              v.propertyTypes
                .filter((t) => counts[t] && counts[t].total > counts[t].mapped)
                .map((t) => (
                  <p key={t} className="text-[11px] mt-2" style={{ color: "var(--warn)" }}>
                    {TYPE_OPTIONS.find((o) => o.value === t)?.label}:{" "}
                    {(counts[t].total - counts[t].mapped).toLocaleString("en-NZ")} more found, still being located on the map.
                  </p>
                ))}
            <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
              The number is how many can be shown on the map right now.
            </p>
          </div>

          <Section icon={Wallet} title="Purchase">
            <NumField label="Budget" hint="max price · optional" prefix="$" placeholder="No limit" value={nums.budget} onChange={(x) => setNum("budget", x)} />
            <NumField label="Deposit amount" prefix="$" value={nums.depositAmount} onChange={(x) => setNum("depositAmount", x)} flag={tried && num("depositAmount") == null} />
            <NumField
              label="Interest rate"
              suffix="%"
              step="0.01"
              value={nums.interestRatePct}
              onChange={(x) => setNum("interestRatePct", x)}
              flag={tried && num("interestRatePct") == null}
              below={
                // Offered, not filled in — the reader decides whether it's theirs.
                liveRatePct != null && nums.interestRatePct.trim() === "" ? (
                  <button
                    type="button"
                    onClick={() => setNum("interestRatePct", String(liveRatePct))}
                    className="text-[11px] text-left cursor-pointer hover:underline"
                    style={{ color: "var(--brand)" }}
                    title={rateSource ?? rateNote ?? undefined}
                  >
                    Use today&rsquo;s rate: {liveRatePct}%{rateNote ? ` (${rateNote})` : ""}
                  </button>
                ) : null
              }
            />
            <NumField label="Loan term" suffix="yrs" placeholder="e.g. 30" value={nums.loanTermYears} onChange={(x) => setNum("loanTermYears", x)} flag={tried && num("loanTermYears") == null} />
            <NumField label="Hold period" hint="years you'd own it" suffix="yrs" value={nums.holdPeriodYears} onChange={(x) => setNum("holdPeriodYears", x)} flag={tried && num("holdPeriodYears") == null} />
            {/* How the loan is paid off. Interest only costs less each month but
                leaves the whole loan owing at sale; P&I pays it down. */}
            <FieldShell label="Loan repayments">
              <div
                className="flex rounded-lg p-0.5"
                style={{ background: "var(--surface-2)", border: `1px solid ${tried && repayment == null ? "var(--bad)" : "var(--border)"}` }}
              >
                {(
                  [
                    ["pi", "Principal & interest"],
                    ["io", "Interest only"],
                  ] as const
                ).map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRepayment(t)}
                    aria-pressed={repayment === t}
                    className="flex-1 px-2 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
                    style={{
                      background: repayment === t ? "var(--brand-light)" : "transparent",
                      color: repayment === t ? "var(--brand)" : "var(--text-muted)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </FieldShell>
          </Section>

          {/* Selling, ongoing costs and growth are NOT the reader's to set here:
              each property's report works them out for that property (its
              suburb's growth, its own insurance and rates). The map uses the
              standard figures in lib/map/variables.ts for them. */}
          <p className="text-xs px-1" style={{ color: "var(--text-muted)", lineHeight: 1.55 }}>
            Buying costs, the building report, selling costs, running costs and growth aren&apos;t set here — each property&apos;s report works them out for
            that property.
          </p>

          <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Default view <span style={{ color: "var(--text-muted)" }}>· optional, home buyer if left</span>
            </span>
            <div className="flex rounded-lg p-0.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              {(["homebuyer", "investor"] as MapMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setDefaultMode(m)}
                  aria-pressed={defaultMode === m}
                  className="px-3 py-1 rounded-md text-xs font-semibold cursor-pointer capitalize"
                  style={{
                    background: defaultMode === m ? "var(--brand-light)" : "transparent",
                    color: defaultMode === m ? "var(--brand)" : "var(--text-muted)",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {tried && missing.length > 0 && (
          <p className="mt-4 text-[13px]" style={{ color: "var(--bad)" }}>
            Fill in your {missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}` : missing[0]} to open the map.
          </p>
        )}
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

type NumKey = "budget" | "depositAmount" | "interestRatePct" | "loanTermYears" | "holdPeriodYears";

/** A number box that can be EMPTY — it holds text, so clearing it leaves it clear. */
function NumField({
  label,
  hint,
  prefix,
  suffix,
  step,
  placeholder,
  value,
  onChange,
  flag,
  below,
}: {
  label: string;
  hint?: string;
  prefix?: string;
  suffix?: string;
  step?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  /** Required and still blank after a save attempt. */
  flag?: boolean;
  below?: React.ReactNode;
}) {
  return (
    <FieldShell label={label} hint={hint}>
      <div className="relative">
        {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>{prefix}</span>}
        <input
          className={`input text-sm py-1.5 w-full mono ${prefix ? "pl-6" : ""} ${suffix ? "pr-9" : ""}`}
          type="number"
          inputMode="decimal"
          onWheel={blurOnWheel}
          step={step}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={flag ? { borderColor: "var(--bad)" } : undefined}
        />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>{suffix}</span>}
      </div>
      {below}
    </FieldShell>
  );
}
