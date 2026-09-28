"use client";

// A standalone structure, laid out like an Improvements item: what it is and
// what it adds on the card, everything behind that figure in the drop-down.
// It used to open fully — value workings, summary, red flags, Healthy Homes —
// so three structures filled a screen before the reader knew what they were.

import { useState } from "react";
import { AlertTriangle, Camera, BedDouble, Shield, Wrench, ArrowRight } from "lucide-react";
import type { ExtraDwelling, DwellingHHStandard, DwellingHHStatus, RenoControls } from "@/lib/property-tab/types";
import type { DwellingValue } from "@/lib/scoring/extra-dwelling-value";
import { isPool } from "@/lib/scoring/structures";
import { conditionScoreColor } from "./ConditionScore";

const HH_LABEL: Record<DwellingHHStandard, string> = {
  heating: "Fixed heating",
  insulation: "Insulation",
  ventilation: "Ventilation",
  moisture: "Moisture & drainage",
  draught: "Draught stopping",
};

const HH_STATUS: Record<DwellingHHStatus, { label: string; color: string; bg: string }> = {
  met: { label: "Met", color: "var(--good)", bg: "var(--good-wash)" },
  not_visible: { label: "Not visible — verify", color: "var(--warn)", bg: "var(--warn-wash)" },
  absent: { label: "Non-existing", color: "var(--bad)", bg: "var(--bad-wash)" },
};

const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

function Chip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-xs rounded-md px-2 py-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}: </span>
      {children}
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
      {children}
    </div>
  );
}

export function ExtraDwellingCard({ dwelling, noPhotos, value, renoControls, onOpenRenovations }: {
  dwelling: ExtraDwelling;
  noPhotos?: boolean;
  value?: DwellingValue;
  renoControls?: RenoControls;
  onOpenRenovations?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const complianceKey = `${dwelling.id}_compliance`;
  const canFix = renoControls?.has(complianceKey) ?? false;
  const fixInPlan = canFix && (renoControls?.included(complianceKey) ?? false);
  const color = conditionScoreColor(dwelling.score);

  const consentColors = {
    consented:   { text: "var(--good)", short: "Consented", long: "Consented." },
    unconsented: { text: "var(--bad)",  short: "Unconsented", long: "Recorded as unconsented. It can't be legally rented until it is regularised." },
    // Consent can't be looked up, so it is assumed — and the reader is asked to check.
    unknown:     { text: "var(--warn)", short: "Assumed — please check", long: "Assumed consented — please check this. Council consent records aren't public, so the LIM or the council property file is where to confirm it." },
  };
  // On a pool the status is the safety FENCE, not a building consent, and an
  // unconfirmed fence is still costed — so it must not read "assumed consented".
  const pool = isPool(dwelling.structureType);
  const consent =
    pool && dwelling.consentStatus === "unknown"
      ? { text: "var(--warn)", short: "Not confirmed", long: "Pool fence compliance can't be confirmed from the photos — check it at the viewing. A compliant fence is a legal requirement." }
      : consentColors[dwelling.consentStatus];

  // What it is, in one line: size and construction.
  const what = [dwelling.sizeEstimate, dwelling.construction].filter(Boolean).join(" · ");

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderLeft: `3px solid ${color}` }}
    >
      {/* Header row — always visible */}
      <button className="w-full text-left p-4 cursor-pointer" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{dwelling.type}</span>
          {dwelling.habitable && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--accent-wash)", color: "var(--brand)" }}>
              <BedDouble size={9} /> Sleepable
            </span>
          )}
        </div>
        {what && (
          <div className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>{what}</div>
        )}

        {noPhotos ? (
          <span className="inline-flex items-center gap-1 text-[11px] rounded-lg px-2 py-1" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            <Camera size={11} /> No photos — not assessed
          </span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {value && (
              <Chip label="Adds">
                <span className="font-bold mono" style={{ color }}>{money(value.addedValue)}</span>
              </Chip>
            )}
            <Chip label={pool ? "Fence" : "Consent"}>
              <span className="font-medium" style={{ color: consent.text }}>{consent.short}</span>
            </Chip>
          </div>
        )}

        {!noPhotos && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs" style={{ color: "var(--brand)" }}>{expanded ? "Hide detail" : "See breakdown"}</span>
            <ArrowRight size={11} style={{ color: "var(--brand)", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
          </div>
        )}
      </button>

      {/* Opt in to the compliance work — kept on the card, like an item's
          "Add to renovation plan", because it's a decision rather than detail. */}
      {canFix && (
        <div className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ borderTop: "1px solid var(--border)", background: fixInPlan ? "var(--accent-wash)" : "transparent" }}>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={fixInPlan}
              onChange={(e) => renoControls?.toggle(complianceKey, e.target.checked)}
              className="w-4 h-4 cursor-pointer flex-shrink-0"
              aria-label="Add compliance work to the renovation plan"
            />
            <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: fixInPlan ? "var(--brand)" : "var(--text-secondary)" }}>
              <Wrench size={11} />
              {fixInPlan ? "Compliance work in your renovation plan" : "Add compliance work to renovation plan"}
            </span>
          </label>
          {fixInPlan && onOpenRenovations && (
            <button onClick={onOpenRenovations} className="inline-flex items-center gap-0.5 text-xs font-medium cursor-pointer hover:underline flex-shrink-0" style={{ color: "var(--brand)" }}>
              View <ArrowRight size={11} />
            </button>
          )}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && !noPhotos && (
        <div className="px-4 pb-4 pt-4 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-start gap-2 text-xs" style={{ color: consent.text, lineHeight: 1.55 }}>
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
            {consent.long}
          </div>

          {value && (
            <div>
              <Heading>What it adds</Heading>
              <div className="space-y-0.5 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span style={{ color: "var(--text-secondary)" }}>Replacement cost new <span style={{ color: "var(--text-muted)" }}>· {value.costBasis}</span></span>
                  <span className="mono flex-shrink-0" style={{ color: "var(--text-secondary)" }}>{money(value.replacementNew)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span style={{ color: "var(--text-secondary)" }}>Condition {dwelling.score}/10 &rarr; ×{value.conditionFactor}</span>
                  <span className="mono" style={{ color: "var(--text-secondary)" }}>{money(value.depreciated)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span style={{ color: "var(--text-secondary)" }}>What a buyer pays for it &rarr; ×{value.retention}</span>
                  <span className="mono" style={{ color: "var(--text-secondary)" }}>{money(value.depreciated * value.retention)}</span>
                </div>
                {value.complianceCost > 0 && (
                  <div className="flex items-baseline justify-between gap-2">
                    <span style={{ color: "var(--warn)" }}>Less cost to make it compliant</span>
                    <span className="mono" style={{ color: "var(--warn)" }}>−{money(value.complianceCost)}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-2 pt-1 mt-1 font-semibold" style={{ borderTop: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--text-primary)" }}>Adds to the property</span>
                  <span className="mono" style={{ color: "var(--text-primary)" }}>{money(value.addedValue)}</span>
                </div>
                {value.chattel && (
                  <div className="flex items-start gap-1.5 text-[11px] pt-1.5" style={{ color: "var(--warn)", lineHeight: 1.5 }}>
                    <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" /> Chattel, not part of the land — confirm it&apos;s included in the sale.
                  </div>
                )}
                {value.note && <div className="text-[11px] pt-1" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>{value.note}</div>}
                <div className="text-[11px] pt-1.5" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Valued the same way the house is: what it would cost to build today, less the life already used,
                  less anything needed to make it compliant.
                </div>
              </div>
            </div>
          )}

          {/* What we can see — an honest summary, not a fitting-by-fitting list */}
          <div>
            <Heading>What we can see</Heading>
            <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>{dwelling.aiSummary}</p>
          </div>

          {/* Red flags — material risks only */}
          {dwelling.redFlags && dwelling.redFlags.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: "var(--bad-wash)" }}>
              <div className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: "var(--bad)" }}>
                <AlertTriangle size={12} /> Red flags
              </div>
              <div className="space-y-1.5">
                {dwelling.redFlags.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>
                    <span style={{ color: "var(--bad)" }}>•</span>{f}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Healthy Homes — only when you can sleep in it (then it's a rentable dwelling) */}
          {dwelling.habitable && dwelling.healthyHomes && dwelling.healthyHomes.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
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

          {dwelling.photoReferences.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
              <Camera size={12} />
              Photos: {dwelling.photoReferences.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
