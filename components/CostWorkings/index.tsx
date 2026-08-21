"use client";

import { blurOnWheel } from "@/lib/ui/number-input";
import { useState } from "react";
import type { CostItem } from "@/lib/labour-rates";
import { ChevronDown, ChevronUp, PenLine, CheckCircle2 } from "lucide-react";

interface Props {
  item: CostItem;
  onQuoteEntered?: (amount: number) => void;
  withinHoldPeriod?: boolean;
}

export function CostWorkings({ item, onQuoteEntered, withinHoldPeriod = true }: Props) {
  const [showWorking, setShowWorking] = useState(false);
  const [quoteInput, setQuoteInput] = useState("");
  const [quoteSaved, setQuoteSaved] = useState(false);
  const [savedQuote, setSavedQuote] = useState<number | null>(item.userQuote ?? null);

  const display = savedQuote ?? item.mostLikely;
  const low     = savedQuote ? savedQuote : item.low;
  const high    = savedQuote ? savedQuote : item.high;

  function saveQuote() {
    const amt = parseFloat(quoteInput.replace(/[^0-9.]/g, ""));
    if (!isNaN(amt) && amt > 0) {
      setSavedQuote(amt);
      setQuoteSaved(true);
      onQuoteEntered?.(amt);
      setTimeout(() => setQuoteSaved(false), 2000);
    }
  }

  if (!withinHoldPeriod) {
    return (
      <div
        className="rounded-xl p-3 opacity-75"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
            {item.name}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          >
            Outside your hold period — monitor only
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      {/* Main row */}
      <div className="flex items-center justify-between p-4 gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm mb-0.5" style={{ color: "var(--text-primary)" }}>
            {item.name}
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {item.region} · {item.dataSource} · {item.jobCount} jobs · {item.lastUpdated}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          {savedQuote ? (
            <div>
              <div className="text-sm font-bold mono" style={{ color: "var(--green)" }}>
                ${savedQuote.toLocaleString()} <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>(your quote)</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm font-bold mono" style={{ color: "var(--text-primary)" }}>
                ${item.low.toLocaleString()} – ${item.high.toLocaleString()}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                most likely ${item.mostLikely.toLocaleString()}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowWorking(!showWorking)}
          className="flex items-center gap-1 text-xs cursor-pointer flex-shrink-0"
          style={{ color: "var(--brand)" }}
          aria-label="Show cost working"
        >
          Show working
          {showWorking ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Expanded working */}
      {showWorking && (
        <div
          className="px-4 pb-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {/* Working table */}
          <div
            className="rounded-lg p-4 mt-3 font-mono text-xs space-y-1"
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              lineHeight: 1.8,
            }}
          >
            <div className="font-bold mb-2" style={{ color: "var(--brand)", fontFamily: "inherit" }}>
              {item.name} — {item.region}
            </div>
            <div className="border-b mb-2" style={{ borderColor: "var(--border)" }} />

            <div className="flex justify-between">
              <span style={{ color: "var(--text-muted)" }}>Quantity:</span>
              <span>{item.quantityFormula}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "var(--text-muted)" }}>Material:</span>
              <span>
                ${item.materialRatePerUnit}/m² × {item.quantity}{item.quantityUnit} = ${item.materialCost.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "var(--text-muted)" }}>Labour:</span>
              <span>
                ${Math.round(item.labourRatePerUnit)}/m² ({item.region} rate ×{" "}
                {item.regionalMultiplier.toFixed(2)}) = ${item.labourCost.toLocaleString()}
              </span>
            </div>

            <div className="border-t mt-2 pt-2" style={{ borderColor: "var(--border)" }}>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>Total base:</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                  ${item.baseCost.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>±15% range:</span>
                <span>${item.low.toLocaleString()} – ${item.high.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span style={{ color: "var(--text-muted)" }}>Most likely:</span>
                <span style={{ color: "var(--brand)" }}>${item.mostLikely.toLocaleString()}</span>
              </div>
            </div>

            <div className="border-t mt-2 pt-2" style={{ borderColor: "var(--border)", fontFamily: "Space Grotesk, sans-serif" }}>
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
                Regional data: {item.dataSource} — {item.jobCount} {item.trade} jobs (last 6 months) ·
                Confidence:{" "}
                <span
                  style={{
                    color:
                      item.confidence === "high" ? "var(--green)"
                      : item.confidence === "medium" ? "var(--warning)"
                      : "var(--text-muted)",
                  }}
                >
                  {item.confidence}
                </span>
              </span>
            </div>
          </div>

          {/* Got a quote? input */}
          <div className="mt-3">
            <div className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Got a real quote? Enter it to update your equity calculation.
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold"
                  style={{ color: "var(--text-muted)" }}
                >
                  $
                </span>
                <input
                  type="number" onWheel={blurOnWheel}
                  className="input pl-7 text-sm"
                  placeholder="e.g. 14,500"
                  value={quoteInput}
                  onChange={(e) => setQuoteInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveQuote()}
                />
              </div>
              <button
                onClick={saveQuote}
                className="btn-primary text-sm py-2 px-4 flex-shrink-0"
              >
                {quoteSaved ? (
                  <><CheckCircle2 size={14} /> Saved</>
                ) : (
                  <><PenLine size={14} /> Use this</>
                )}
              </button>
            </div>
            {savedQuote && (
              <p className="text-xs mt-1.5" style={{ color: "var(--green)" }}>
                ✓ Your quote of ${savedQuote.toLocaleString()} is being used in the equity calculation.{" "}
                <button
                  className="underline cursor-pointer"
                  onClick={() => { setSavedQuote(null); setQuoteInput(""); }}
                  style={{ color: "var(--text-muted)" }}
                >
                  Remove
                </button>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
