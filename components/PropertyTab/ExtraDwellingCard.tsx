"use client";

import { AlertTriangle, Camera } from "lucide-react";
import type { ExtraDwelling } from "@/lib/property-tab/types";
import { UrgencyBadge } from "./UrgencyBadge";
import { urgencyLabel } from "@/lib/property-tab/types";

export function ExtraDwellingCard({ dwelling }: { dwelling: ExtraDwelling }) {
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
            <h4 className="font-bold text-base mb-0.5" style={{ color: "var(--text-primary)" }}>
              {dwelling.type}
            </h4>
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
          <UrgencyBadge score={dwelling.score} label={urgencyLabel(dwelling.score)} size="sm" />
        </div>

        {/* Value contribution */}
        <div
          className="rounded-xl p-3 mb-4"
          style={{ background: "rgba(0,212,200,0.06)", border: "1px solid rgba(0,212,200,0.15)" }}
        >
          <div className="text-xs font-semibold mb-1" style={{ color: "var(--brand)" }}>
            Value contribution to overall score
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold mono" style={{ color: "var(--text-primary)", fontSize: 15 }}>
              ${dwelling.estimatedReplacementCost.low.toLocaleString()} – ${dwelling.estimatedReplacementCost.high.toLocaleString()}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>estimated replacement value</span>
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {dwelling.estimatedReplacementCost.notes}
          </div>
          <div className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
            At condition score {dwelling.score}/10, this structure adds{" "}
            <strong style={{ color: "var(--brand)" }}>
              +{Math.round((mid / 500_000) * 100 * (dwelling.score / 10))} points
            </strong>{" "}
            to the overall property score.
          </div>
        </div>

        {/* AI summary */}
        <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-secondary)", lineHeight: 1.75 }}>
          {dwelling.aiSummary}
        </p>

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
