"use client";

// ============================================================
// The land value on the Land tab, line by line.
//
// A typical section of this size in the suburb, then one line per site fact
// with its dollar effect and the working behind it — so a reader can disagree
// with the slope discount without having to disbelieve the whole figure.
// ============================================================

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { AdjustedLand } from "@/lib/scoring/land-value";

const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-NZ")}`;
const signed = (n: number) => (n === 0 ? "$0" : `${n < 0 ? "−" : "+"}${money(n)}`);

export function LandValueWorkings({ land, landAreaSqm, shareNote, sources = {} }: {
  land: AdjustedLand;
  landAreaSqm: number | null;
  /** On a cross lease, the share of the site being valued. */
  shareNote?: string;
  /** Where each fact came from, by land item id — a figure keeps its source. */
  sources?: Record<string, string | undefined>;
}) {
  // The figure is the card; the line-by-line working is there to be checked,
  // so it starts folded — the same as the base-rate card on Improvements.
  const [showWorking, setShowWorking] = useState(false);
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Land value
          </div>
          <div className="font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
            This section, against a typical one
          </div>
          <p className="text-[13px] mt-1 max-w-xl" style={{ color: "var(--text-secondary)" }}>
            Starts from what a typical section of this size sells for in the suburb, then adjusts for this
            one&apos;s shape, slope, orientation and access. Better than typical adds value; worse takes it off.
          </p>
        </div>
        <div className="sm:text-right">
          <div className="mono text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{money(land.valueNZD)}</div>
          {landAreaSqm ? (
            <div className="mono text-[12px]" style={{ color: "var(--text-muted)" }}>
              {money(land.valueNZD / landAreaSqm)}/m² × {Math.round(landAreaSqm).toLocaleString("en-NZ")} m²
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowWorking(!showWorking)}
        className="mt-3 flex items-center gap-1 text-xs cursor-pointer"
        style={{ color: "var(--brand)" }}
        aria-expanded={showWorking}
      >
        {showWorking ? "Hide the breakdown" : "Show the breakdown"}
        {showWorking ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {showWorking && (
        <div className="mt-3 pt-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
          <Line
            label="Section size — a typical section"
            amount={money(land.baseNZD)}
            source={sources.land_size}
            working={`What a typical ${landAreaSqm ? `${Math.round(landAreaSqm).toLocaleString("en-NZ")} m² ` : ""}section fetches in the suburb, from recent house sales less the buildings on them. The first ~500 m² carry most of the value.${shareNote ? ` ${shareNote}` : ""}`}
          />
          {land.lines.map((l) => (
            <Line
              key={l.id}
              label={l.label}
              amount={l.established ? signed(l.deltaNZD) : "—"}
              tone={!l.established ? "muted" : l.deltaNZD > 0 ? "good" : l.deltaNZD < 0 ? "bad" : "neutral"}
              working={l.working}
              source={sources[l.id]}
            />
          ))}
          <div className="flex items-baseline justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Land value</span>
            <span className="mono text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>{money(land.valueNZD)}</span>
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
            The adjustments are industry-typical rates, not yet measured from sales. They will be recalibrated
            against real sale prices as that data arrives.
          </div>
        </div>
      )}
    </div>
  );
}

function Line({ label, amount, working, source, tone = "neutral" }: {
  label: string;
  amount: string;
  working: string;
  source?: string;
  tone?: "good" | "bad" | "neutral" | "muted";
}) {
  const color = tone === "good" ? "var(--good)" : tone === "bad" ? "var(--bad)" : tone === "muted" ? "var(--text-muted)" : "var(--text-primary)";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{label}</span>
        <span className="mono text-[13px] font-semibold whitespace-nowrap" style={{ color }}>{amount}</span>
      </div>
      <div className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{working}</div>
      {source && (
        <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Source: {source}</div>
      )}
    </div>
  );
}
