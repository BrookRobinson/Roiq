"use client";

import { AlertTriangle, Camera, BedDouble, Shield, Wrench, ArrowRight } from "lucide-react";
import type { ExtraDwelling, DwellingHHStandard, DwellingHHStatus, RenoControls } from "@/lib/property-tab/types";
import type { DwellingValue } from "@/lib/scoring/extra-dwelling-value";
import { ConditionScore } from "./ConditionScore";

const HH_LABEL: Record<DwellingHHStandard, string> = {
  heating: "Fixed heating",
  insulation: "Insulation",
  ventilation: "Ventilation",
  moisture: "Moisture & drainage",
  draught: "Draught stopping",
};

const HH_STATUS: Record<DwellingHHStatus, { label: string; color: string; bg: string }> = {
  met: { label: "Met", color: "#00e676", bg: "rgba(0,230,118,0.12)" },
  not_visible: { label: "Not visible — verify", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  absent: { label: "Non-existing", color: "#ff5f5f", bg: "rgba(255,95,95,0.12)" },
};

export function ExtraDwellingCard({ dwelling, noPhotos, value, renoControls, onOpenRenovations }: {
  dwelling: ExtraDwelling;
  noPhotos?: boolean;
  value?: DwellingValue;
  renoControls?: RenoControls;
  onOpenRenovations?: () => void;
}) {
  const complianceKey = `${dwelling.id}_compliance`;
  const canFix = renoControls?.has(complianceKey) ?? false;
  const fixInPlan = canFix && (renoControls?.included(complianceKey) ?? false);
  const consentColors = {
    consented:   { bg: "rgba(0,230,118,0.1)",  text: "#00e676",  label: "Consented" },
    unconsented: { bg: "rgba(255,95,95,0.1)",   text: "#ff5f5f",  label: "Unconsented — verify" },
    unknown:     { bg: "rgba(251,191,36,0.1)",  text: "#fbbf24",  label: "Consent unknown — LIM check required" },
  };
  const consent = consentColors[dwelling.consentStatus];
  const mid = (dwelling.estimatedReplacementCost.low + dwelling.estimatedReplacementCost.high) / 2;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: "2px dashed var(--border)",
        background: "var(--surface)",
      }}
    >
      {/* LIM warning banner */}
      <div
        className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold"
        style={{ background: consent.bg, color: consent.text }}
      >
        <AlertTriangle size={13} />
        {consent.label}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h4 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
                {dwelling.type}
              </h4>
              {dwelling.habitable && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(0,212,200,0.12)", color: "var(--brand)", border: "1px solid rgba(0,212,200,0.3)" }}>
                  <BedDouble size={10} /> Sleepable — assessed as a dwelling
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { label: "Size",          value: dwelling.sizeEstimate },
                { label: "Construction",  value: dwelling.construction },
              ].map((p) => (
                <div
                  key={p.label}
                  className="rounded-md px-2 py-1"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <span style={{ color: "var(--text-muted)" }}>{p.label}: </span>
                  <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>
          {noPhotos ? (
            <span className="inline-flex items-center gap-1 text-[11px] rounded-lg px-2 py-1 whitespace-nowrap flex-shrink-0" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <Camera size={11} /> No photos — not assessed
            </span>
          ) : (
            <ConditionScore score={dwelling.score} size="sm" />
          )}
        </div>

        {/* Value contribution */}
        <div
          className="rounded-xl p-3 mb-4"
          style={{ background: "rgba(0,212,200,0.06)", border: "1px solid rgba(0,212,200,0.15)" }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold" style={{ color: "var(--brand)" }}>Value it adds to the property</span>
            {value && !noPhotos && (
              <span className="mono font-bold" style={{ color: "var(--text-primary)", fontSize: 17 }}>
                ${value.addedValue.toLocaleString("en-NZ")}
              </span>
            )}
          </div>
          {noPhotos ? (
            <div className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              Upload photos to assess this structure&apos;s condition.
            </div>
          ) : value ? (
            <div className="mt-2 space-y-0.5 text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span style={{ color: "var(--text-secondary)" }}>Replacement cost new <span style={{ color: "var(--text-muted)" }}>· {value.costBasis}</span></span>
                <span className="mono flex-shrink-0" style={{ color: "var(--text-secondary)" }}>${value.replacementNew.toLocaleString("en-NZ")}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span style={{ color: "var(--text-secondary)" }}>Condition {dwelling.score}/10 &rarr; ×{value.conditionFactor}</span>
                <span className="mono" style={{ color: "var(--text-secondary)" }}>${value.depreciated.toLocaleString("en-NZ")}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span style={{ color: "var(--text-secondary)" }}>What a buyer pays for it &rarr; ×{value.retention}</span>
                <span className="mono" style={{ color: "var(--text-secondary)" }}>${Math.round(value.depreciated * value.retention).toLocaleString("en-NZ")}</span>
              </div>
              {value.complianceCost > 0 && (
                <div className="flex items-baseline justify-between gap-2">
                  <span style={{ color: "#fbbf24" }}>Less cost to make it compliant</span>
                  <span className="mono" style={{ color: "#fbbf24" }}>−${value.complianceCost.toLocaleString("en-NZ")}</span>
                </div>
              )}
              {value.chattel && (
                <div className="flex items-start gap-1.5 text-[11px] pt-1.5" style={{ color: "#fbbf24", lineHeight: 1.5 }}>
                  <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" /> Chattel, not part of the land — confirm it&apos;s included in the sale.
                </div>
              )}
              {value.note && <div className="text-[11px] pt-1" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>{value.note}</div>}
              <div className="text-[11px] pt-1.5 mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.5, borderTop: "1px solid rgba(0,212,200,0.15)" }}>
                Standalone structures add <strong style={{ color: "var(--text-secondary)" }}>value, not points</strong> — whether you want one is subjective, so the /1000 score stays comparable across every property.
              </div>
            </div>
          ) : null}
        </div>

        {/* What we can see — an honest summary, not a fitting-by-fitting list */}
        <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>What we can see</div>
        <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)", lineHeight: 1.75 }}>
          {dwelling.aiSummary}
        </p>

        {/* Red flags — material risks only */}
        {dwelling.redFlags && dwelling.redFlags.length > 0 && (
          <div className="rounded-xl p-3 mb-4" style={{ background: "rgba(255,95,95,0.07)", border: "1px solid rgba(255,95,95,0.25)" }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: "#ff5f5f" }}>
              <AlertTriangle size={12} /> Red flags
            </div>
            <div className="space-y-1.5">
              {dwelling.redFlags.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  <span style={{ color: "#ff5f5f" }}>•</span>{f}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Healthy Homes — only when you can sleep in it (then it's a rentable dwelling) */}
        {dwelling.habitable && dwelling.healthyHomes && dwelling.healthyHomes.length > 0 && (
          <div className="rounded-xl p-3 mb-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              <Shield size={12} style={{ color: "var(--brand)" }} /> Healthy Homes — applies if you rent this out
            </div>
            <p className="text-[11px] mb-2.5" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
              You can sleep in this, so as a tenanted dwelling it must meet the 5 standards in its own right.
            </p>
            <div className="space-y-1.5">
              {dwelling.healthyHomes.map((h) => {
                const meta = HH_STATUS[h.status];
                return (
                  <div key={h.standard} className="flex items-start justify-between gap-2 text-xs">
                    <span style={{ color: "var(--text-secondary)" }}>
                      {HH_LABEL[h.standard]}
                      {h.note && <span style={{ color: "var(--text-muted)" }}> · {h.note}</span>}
                    </span>
                    <span className="font-semibold px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Opt in to the compliance work — consent + Healthy Homes to make it rentable */}
        {canFix && (
          <div className="rounded-xl px-3 py-2.5 mb-4 flex items-center justify-between gap-2" style={{ background: fixInPlan ? "rgba(0,212,200,0.08)" : "var(--surface-2)", border: `1px solid ${fixInPlan ? "rgba(0,212,200,0.3)" : "var(--border)"}` }}>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={fixInPlan}
                onChange={(e) => renoControls?.toggle(complianceKey, e.target.checked)}
                className="w-4 h-4 cursor-pointer flex-shrink-0"
                aria-label="Add consent & compliance work to the renovation plan"
              />
              <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: fixInPlan ? "var(--brand)" : "var(--text-secondary)" }}>
                <Wrench size={11} />
                {fixInPlan ? "Compliance work in your renovation plan" : "Add consent & compliance work to renovation plan"}
              </span>
            </label>
            {fixInPlan && onOpenRenovations && (
              <button onClick={onOpenRenovations} className="inline-flex items-center gap-0.5 text-xs font-medium cursor-pointer hover:underline flex-shrink-0" style={{ color: "var(--brand)" }}>
                View <ArrowRight size={11} />
              </button>
            )}
          </div>
        )}

        {/* Photo refs */}
        {dwelling.photoReferences.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <Camera size={12} />
            Photos: {dwelling.photoReferences.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}
