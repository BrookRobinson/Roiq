"use client";

import { useState } from "react";
import type { SubItem, SpecTier } from "@/lib/property-tab/types";
import { urgencyScoreToYears } from "@/lib/property-tab/types";
import { conditionScoreColor } from "./ConditionScore";
import { ConfidenceTierBadge } from "./ConfidenceTierBadge";
import { CostWorkings } from "@/components/CostWorkings";
import { useHoldPeriod } from "@/lib/hold-period/context";
import {
  roofReplacementCost,
  windowReplacementCost,
  ceilingInsulationCost,
  claddingRepaintCost,
  deckRepairCost,
} from "@/lib/labour-rates";
import { Camera, ArrowRight, Wrench, Shield } from "lucide-react";

/** Spec / finish badge — how UPDATED the materials look (separate from the condition score). */
const SPEC_META: Record<SpecTier, { label: string; color: string; bg: string; border: string }> = {
  original: { label: "Original", color: "var(--text-muted)", bg: "var(--surface)", border: "var(--border)" },
  dated: { label: "Dated", color: "var(--text-muted)", bg: "var(--surface)", border: "var(--border)" },
  modern: { label: "Modern", color: "var(--brand)", bg: "rgba(0,212,200,0.1)", border: "rgba(0,212,200,0.2)" },
  luxury: { label: "Luxury", color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)" },
};

/** A small labelled stat bubble — a header word (e.g. "Condition" / "Item") over a value. */
function StatBubble({ label, value, color, bg, border, title }: {
  label: string; value: string; color: string; bg: string; border: string; title?: string;
}) {
  return (
    <div
      title={title}
      className="inline-flex flex-col items-center rounded-lg"
      style={{ background: bg, border: `1px solid ${border}`, padding: "2px 10px", minWidth: 70 }}
    >
      <span className="uppercase font-medium" style={{ fontSize: 9, letterSpacing: "0.07em", color: "var(--text-muted)" }}>{label}</span>
      <span className="font-bold tabular-nums" style={{ color, fontFamily: "Fira Code, monospace", fontSize: 13, lineHeight: 1.3 }}>{value}</span>
    </div>
  );
}

/** Build a CostItem for this sub-item where we have the data */
function getCostItem(item: SubItem, region = "", floorSqm?: number | null) {
  if (!item.estimatedReplacementCost) return null;
  const floor = floorSqm && floorSqm > 0 ? floorSqm : 140; // fallback when floor area isn't stated
  // Match known sub-item IDs to specific cost calculators (region-aware labour).
  if (item.id === "ext_roof")        return roofReplacementCost(floor, region);
  if (item.id === "ext_cladding")    return claddingRepaintCost(floor, region);
  if (item.id === "ext_windows")     return windowReplacementCost(3, region);
  if (item.id === "kit_ceiling_ins" || item.id === "svc_insulation")
                                     return ceilingInsulationCost(floor, region);
  if (item.id === "out_deck")        return deckRepairCost(28, region);
  // Generic fallback — use raw replacement cost range
  return null;
}

export function SubItemCard({ item, region, floorSqm, showCost = false }: { item: SubItem; region?: string; floorSqm?: number | null; showCost?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { holdYears, withinHold } = useHoldPeriod();
  const urgencyYears = urgencyScoreToYears(item.score);
  const isWithinHold = withinHold(urgencyYears);
  const color = conditionScoreColor(item.score);
  const costItem = getCostItem(item, region, floorSqm);

  return (
    <div
      className="rounded-xl overflow-hidden transition-opacity"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${color}`,
        opacity: !isWithinHold && item.score !== null && item.score <= 7 ? 0.55 : 1,
      }}
    >
      {/* Header row — always visible */}
      <button
        className="w-full text-left p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                {item.name}
              </span>
              {item.renovationLink && (
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(0,212,200,0.1)", color: "var(--brand)", border: "1px solid rgba(0,212,200,0.2)" }}
                >
                  <Wrench size={9} />
                  Reno tab
                </span>
              )}
              {item.healthyHomesLink && (
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}
                >
                  <Shield size={9} />
                  Healthy Homes
                </span>
              )}
            </div>

            {/* Data pills — or, with no photos, the "upload to assess" prompt */}
            {item.noPhotoNotAssessed ? (
              <div className="mb-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                Upload photos to get a condition score for this area.{" "}
                <a href="/report/upload" className="inline-flex items-center gap-0.5 font-medium hover:underline" style={{ color: "var(--brand)" }}>Add photos <ArrowRight size={11} /></a>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  { label: "Material", value: item.material },
                  { label: "Age",      value: item.estimatedAge },
                ].map((pill) => (
                  <div
                    key={pill.label}
                    className="text-xs rounded-md px-2 py-1 max-w-xs"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>{pill.label}: </span>
                    <span className="font-medium" style={{ color: "var(--text-secondary)" }}>
                      {pill.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Condition score + spec badge — or "No photos — not assessed" when there were none */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
            {item.noPhotoNotAssessed ? (
              <span className="inline-flex items-center gap-1 text-[11px] rounded-lg px-2 py-1 whitespace-nowrap" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                <Camera size={11} /> No photos — not assessed
              </span>
            ) : (
              <>
                <StatBubble
                  label="Condition"
                  value={item.score !== null ? `${item.score}/10` : "N/A"}
                  color={conditionScoreColor(item.score)}
                  bg={`${conditionScoreColor(item.score)}1f`}
                  border={`${conditionScoreColor(item.score)}55`}
                  title="Condition — how worn or new the item is (1–10). Not about how modern it looks."
                />
                {item.specTier && (
                  <StatBubble
                    label="Item"
                    value={SPEC_META[item.specTier].label}
                    color={SPEC_META[item.specTier].color}
                    bg={SPEC_META[item.specTier].bg}
                    border={SPEC_META[item.specTier].border}
                    title="Item — how updated the materials / finish look (separate from condition)."
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Confidence + photo refs — hidden for no-photo items (no T3 / source shown) */}
        {!item.noPhotoNotAssessed && (
          <div className="flex items-center gap-3 flex-wrap mt-1">
            <ConfidenceTierBadge tier={item.confidenceTier} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {item.evidenceSource}
            </span>
            {item.photoReferences.length > 0 && (
              <div className="flex items-center gap-1">
                <Camera size={11} style={{ color: "var(--text-muted)" }} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Photos: {item.photoReferences.join(", ")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Outside hold period label */}
        {!isWithinHold && item.score !== null && item.score <= 7 && (
          <div
            className="mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            Outside your {holdYears}-year hold period — monitor only
          </div>
        )}

        {/* Expand toggle hint — no AI assessment to read for a no-photo item */}
        {!item.noPhotoNotAssessed && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs" style={{ color: "var(--brand)" }}>
              {expanded ? "Hide detail" : "Read AI assessment"}
            </span>
            <ArrowRight
              size={11}
              style={{
                color: "var(--brand)",
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
          </div>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && !item.noPhotoNotAssessed && (
        <div
          className="px-4 pb-4 space-y-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {/* AI summary */}
          <div className="pt-4">
            <div
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              AI Assessment
            </div>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--text-secondary)", lineHeight: 1.75 }}
            >
              {item.aiSummary}
            </p>
          </div>

          {/* Replacement cost — kept on the Renovation tab only (showCost gates it). */}
          {showCost && item.estimatedReplacementCost && (
            costItem ? (
              <CostWorkings item={costItem} withinHoldPeriod={isWithinHold} />
            ) : (
              <div
                className="rounded-lg p-3"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: isWithinHold ? 1 : 0.5 }}
              >
                <div className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                  Estimated replacement cost
                  {!isWithinHold && (
                    <span className="ml-2 font-normal" style={{ color: "var(--text-muted)" }}>
                      (outside your {holdYears}-yr hold)
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold mono" style={{ color: "var(--text-primary)" }}>
                    ${item.estimatedReplacementCost.low.toLocaleString()} – ${item.estimatedReplacementCost.high.toLocaleString()}
                  </span>
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {item.estimatedReplacementCost.notes}
                </div>
              </div>
            )
          )}

          {/* Renovation link */}
          {item.renovationLink && (
            <button
              className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer"
              style={{ color: "var(--brand)" }}
            >
              <Wrench size={13} />
              View in Renovation tab
              <ArrowRight size={13} />
            </button>
          )}

          {/* Healthy Homes link */}
          {item.healthyHomesLink && (
            <button
              className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer"
              style={{ color: "#fbbf24" }}
            >
              <Shield size={13} />
              View Healthy Homes assessment
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
