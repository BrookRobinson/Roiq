"use client";

// ============================================================
// Narrow the map to the kinds of property you're actually looking for.
//
// "Not known yet" is a first-class option rather than a gap swept under the
// carpet. Most pins are discovered from OneRoof's sitemap, which carries an
// address and nothing else — so for the great majority of the country the type
// genuinely isn't known, and a filter that quietly dropped them would empty the
// map and look broken. Saying so lets someone filter it in or out on purpose.
// ============================================================

import { Check, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

export interface TypeOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Ordered the way someone shops: the things most people are looking for first,
 * then land, then the honest unknown.
 */
export const TYPE_OPTIONS: TypeOption[] = [
  { value: "house", label: "House" },
  { value: "townhouse", label: "Townhouse" },
  { value: "apartment", label: "Apartment" },
  { value: "unit", label: "Unit" },
  { value: "section", label: "Section", hint: "Bare land with no dwelling" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "rural", label: "Rural land", hint: "From OneRoof's rural listings" },
  { value: "unknown", label: "Not known yet", hint: "Discovered from the listing index — type isn't published there" },
];

export function TypeFilter({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const all = selected.length === 0;

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const summary = all
    ? "All property types"
    : selected.length === 1
      ? TYPE_OPTIONS.find((o) => o.value === selected[0])?.label ?? "1 type"
      : `${selected.length} types`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium"
        style={{
          background: all ? "var(--surface)" : "var(--accent-wash)",
          border: `1px solid ${all ? "var(--rule)" : "var(--brand)"}`,
          color: all ? "var(--text-secondary)" : "var(--brand)",
        }}
      >
        <SlidersHorizontal size={13} />
        {summary}
      </button>

      {open && (
        <>
          {/* Click-away. Behind the panel, over everything else. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute z-50 mt-2 w-72 rounded-2xl p-2"
            style={{ background: "var(--surface)", border: "1px solid var(--rule)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Property type
              </span>
              {!all && (
                <button
                  onClick={() => onChange([])}
                  className="flex items-center gap-1 text-[12px]"
                  style={{ color: "var(--brand)" }}
                >
                  <X size={11} /> Clear
                </button>
              )}
            </div>

            {TYPE_OPTIONS.map((o) => {
              const on = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left"
                  style={{ background: on ? "var(--surface-2)" : "transparent" }}
                >
                  <span
                    className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded"
                    style={{
                      border: `1px solid ${on ? "var(--brand)" : "var(--rule-strong)"}`,
                      background: on ? "var(--brand)" : "transparent",
                    }}
                  >
                    {on && <Check size={11} style={{ color: "var(--on-accent)" }} />}
                  </span>
                  <span>
                    <span className="block text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                      {o.label}
                    </span>
                    {o.hint && (
                      <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {o.hint}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}

            <p className="px-2 pb-1 pt-2 text-[11px]" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
              Nothing selected shows everything. Type is known for rural listings and for any
              property that has been analysed — it isn&rsquo;t published in the listing index the
              rest come from.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
