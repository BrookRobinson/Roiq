"use client";

// ============================================================
// "Who is this report for?" — asked before the analysis, not after.
//
// The report page has always had a Home Buyer / Investor toggle, but it defaults
// to Home Buyer, and someone who skims past it reads a whole investor decision
// through an owner-occupier lens. Asking here makes the choice deliberate: the
// analysis won't start until one is picked.
//
// It costs nothing to ask late OR early — both persona scores are computed from
// the same single pass, so this picks which lens the report OPENS in, not what
// gets analysed. The toggle on the report still works, and still wins.
// ============================================================

import { Home, TrendingUp, AlertCircle, X } from "lucide-react";

import type { Persona } from "@/lib/scoring/model";

const OPTIONS: { id: Persona; label: string; blurb: string; Icon: typeof Home }[] = [
  {
    id: "buyer",
    label: "Home buyer",
    blurb: "You'll live in it. Weighted toward condition, comfort and what it costs to put right.",
    Icon: Home,
  },
  {
    id: "investor",
    label: "Investor",
    blurb: "You'll rent it out. Weighted toward yield, Healthy Homes and 10-year return.",
    Icon: TrendingUp,
  },
];

/** The two boxes. `value` is null until the person actually chooses. */
export function PersonaChoice({
  value,
  onChange,
}: {
  value: Persona | null;
  onChange: (persona: Persona) => void;
}) {
  return (
    <div>
      <label className="label text-sm font-semibold block" style={{ color: "var(--text-primary)", marginBottom: 10 }}>
        Who is this report for?
        <span className="font-normal ml-1" style={{ color: "var(--danger)" }}>*</span>
      </label>

      <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Who is this report for?">
        {OPTIONS.map(({ id, label, blurb, Icon }) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(id)}
              className="text-left rounded-xl p-4 cursor-pointer transition-all"
              style={{
                background: selected ? "var(--brand-light)" : "var(--bg)",
                border: `2px solid ${selected ? "var(--brand)" : "var(--border)"}`,
              }}
            >
              <Icon
                size={18}
                className="mb-2"
                style={{ color: selected ? "var(--brand)" : "var(--text-muted)" }}
              />
              <div className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                {label}
              </div>
              <div className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {blurb}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
        You can switch lenses on the report at any time — this just decides where it starts.
      </p>
    </div>
  );
}

/**
 * Shown when someone hits Analyse without choosing.
 *
 * It offers the two choices rather than only scolding, so the interruption costs
 * one click instead of sending them back up the page to find the boxes.
 */
export function PersonaRequiredDialog({
  onChoose,
  onClose,
}: {
  onChoose: (persona: Persona) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="persona-required-title"
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} style={{ color: "var(--brand)" }} />
            <h2 id="persona-required-title" className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Choose who this report is for
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:opacity-70" style={{ color: "var(--text-muted)" }} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            The score is weighted differently for an owner-occupier than for a
            landlord, so pick one before we analyse the property.
          </p>

          <div className="space-y-2">
            {OPTIONS.map(({ id, label, blurb, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onChoose(id)}
                className="w-full text-left rounded-xl p-3 flex items-start gap-3 cursor-pointer transition-all"
                style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
              >
                <Icon size={17} style={{ color: "var(--brand)", flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{label}</div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{blurb}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
