"use client";

import { useState } from "react";
import type { SubItem } from "@/lib/property-tab/types";
import type { DocAnalysis } from "@/lib/report-store";
import { urgencyColor } from "@/lib/property-tab/types";
import { SOURCE_TYPE_LABEL, isVerifiedDocItem, TITLE_ITEM } from "@/lib/scoring/catalog";
import { ConfidenceTierBadge } from "@/components/PropertyTab/ConfidenceTierBadge";
import { DocUpload } from "./DocUpload";
import { useHoldPeriod } from "@/lib/hold-period/context";
import {
  Camera, Landmark, Map as MapIcon, FileText, ScrollText, Activity, TrendingUp, MapPin,
  GraduationCap, Lightbulb, Wrench, ArrowRight, ChevronRight, CheckCircle2, ShieldCheck, Lock, FileSearch,
} from "lucide-react";

const accent = { green: "var(--good)", amber: "var(--warn)", red: "var(--bad)", muted: "var(--text-muted)" } as const;

const SOURCE_ICON: Record<string, React.ElementType> = {
  photo: Camera, council_data: Landmark, linz: MapIcon, title: FileText, lim: ScrollText,
  gns: Activity, market_data: TrendingUp, map_poi: MapPin, moe_zones: GraduationCap, inference: Lightbulb,
};

// Friendly names for the upload prompts.
const DOC_NAME: Record<string, string> = {
  leg_lim: "your LIM report",
  leg_consents: "the building consent / CCC records",
  leg_eqc: "the EQC / insurance claim history",
  leg_title: "the record of title / title search",
};

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

export function InspectionCard({
  item,
  inspectionLabel,
  bandLabel,
  statOverride,
  onSeeRenovations,
  verifiedDoc,
  onVerified,
}: {
  item: SubItem;
  inspectionLabel: string;
  bandLabel?: string;
  /** Show a real-world measurement in the badge instead of a 1–10 score (e.g. section size in m²). */
  statOverride?: { value: string; unit: string; note?: string };
  onSeeRenovations: () => void;
  verifiedDoc?: DocAnalysis;
  onVerified?: (doc: DocAnalysis) => void;
}) {
  const isDoc = isVerifiedDocItem(item.id);
  const isTitle = item.id === TITLE_ITEM;
  const verified = verifiedDoc && verifiedDoc.docTypeConfirmed && verifiedDoc.score != null ? verifiedDoc : null;

  // Displayed score: verified items use the document score; doc items show none
  // until verified; everything else uses the AI score.
  const displayScore = isDoc ? (verified ? (verified.score as number) : null) : item.score;
  const concerning = displayScore !== null && displayScore <= 4;
  const [open, setOpen] = useState(concerning || (isDoc && !verified));
  const { withinHold, holdYears } = useHoldPeriod();
  const color = accent[urgencyColor(displayScore as 1 | null)];

  const SourceIcon = item.sourceType ? SOURCE_ICON[item.sourceType] : null;
  const rem = item.remediation && item.remediation.urgencyYears <= holdYears ? item.remediation : null;

  // Status pill
  const pill = verified
    ? { label: "Verified ✓", bg: "var(--good-wash)", fg: "var(--good)" }
    : isDoc
    ? { label: "Needs document", bg: "var(--warn-wash)", fg: "var(--warn)" }
    : isTitle
    ? { label: "Indicative", bg: "var(--surface)", fg: "var(--text-muted)" }
    : item.remediation
    ? { label: "Reno tab", bg: "var(--accent-wash)", fg: "var(--brand)" }
    : null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderLeft: `3px solid ${isDoc && !verified ? "var(--warn)" : color}` }}>
      <button className="w-full text-left p-4 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{item.name}</span>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--text-muted)" }}>{inspectionLabel}</span>
              {bandLabel && (
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${color}1a`, color, border: `1px solid ${color}40` }}>{bandLabel}</span>
              )}
              {pill && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: pill.bg, color: pill.fg }}>
                  {verified && <ShieldCheck size={9} />}{pill.label}
                </span>
              )}
            </div>

            {/* Header line */}
            {isDoc && !verified ? (
              <div className="text-sm mt-1" style={{ color: "var(--warn)" }}>Upload {DOC_NAME[item.id]} to get a verified score.</div>
            ) : verified ? (
              <div className="flex items-center gap-1.5 text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                <FileText size={11} /> Verified from <span style={{ color: "var(--text-secondary)" }}>{verified.fileName}</span> · read by Claude
              </div>
            ) : (
              <>
                {item.finding && (
                  <div className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--text-muted)" }}>Finding: </span>{item.finding}
                  </div>
                )}
                <div className="flex items-center gap-3 flex-wrap mt-1.5">
                  {item.source && (
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      {SourceIcon && <SourceIcon size={11} />}
                      <span>{item.sourceType && <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{SOURCE_TYPE_LABEL[item.sourceType]}: </span>}{item.source}</span>
                    </span>
                  )}
                  <ConfidenceTierBadge tier={item.confidenceTier} />
                </div>
              </>
            )}
          </div>

          {/* Score badge on the RIGHT (matches the Improvements tab) — or a lock for
              unverified document items. */}
          {isDoc && !verified ? (
            <div className="flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: "var(--warn-wash)", border: "1px solid var(--warn-wash)" }}>
              <Lock size={16} style={{ color: "var(--warn)" }} />
            </div>
          ) : statOverride ? (
            // A measurement beats a 1–10 here: "612m²" is the fact the buyer wants,
            // where "7/10 section size" means nothing on its own.
            <div className="flex-shrink-0 min-w-[2.75rem] h-11 px-1.5 rounded-lg flex flex-col items-center justify-center" style={{ background: `${color}1a`, border: `1px solid ${color}40` }}>
              <span className={`${statOverride.value.length > 4 ? "text-xs" : "text-sm"} font-bold mono leading-none`} style={{ color }}>{statOverride.value}</span>
              <span className="text-[9px] leading-none mt-0.5" style={{ color: "var(--text-muted)" }}>{statOverride.unit}</span>
            </div>
          ) : (
            <div className="flex-shrink-0 w-11 h-11 rounded-lg flex flex-col items-center justify-center" style={{ background: `${color}1a`, border: `1px solid ${color}40` }}>
              <span className="text-sm font-bold mono leading-none" style={{ color }}>{displayScore ?? "—"}</span>
              <span className="text-[9px] leading-none mt-0.5" style={{ color: "var(--text-muted)" }}>/10</span>
            </div>
          )}

          <ChevronRight size={16} className="flex-shrink-0 mt-1" style={{ color: "var(--text-muted)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
        </div>

        {/* Expand hint — makes the click-for-reasoning affordance obvious (mirrors the
            Improvements tab's "Read AI assessment" cue). */}
        {!isDoc && item.aiSummary && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs font-medium" style={{ color: "var(--brand)" }}>
              {open ? "Hide reasoning" : "Read reasoning"}
            </span>
            <ArrowRight size={11} style={{ color: "var(--brand)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
          </div>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
          {isDoc && !verified ? (
            <UploadPrompt itemId={item.id} onVerified={onVerified} />
          ) : verified ? (
            <VerifiedView doc={verified} itemId={item.id} onVerified={onVerified} />
          ) : (
            <>
              {statOverride?.note && (
                <div className="pt-3">
                  <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>How it rates</div>
                  <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.75 }}>{statOverride.note}</p>
                </div>
              )}
              {item.aiSummary && (
                <div className="pt-3">
                  <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Reasoning</div>
                  <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.75 }}>{item.aiSummary}</p>
                </div>
              )}
              {item.verifyAgainst && (
                <div className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                  <CheckCircle2 size={12} /> Verify against: <span style={{ color: "var(--text-secondary)" }}>{item.verifyAgainst}</span>
                </div>
              )}
              {isTitle && <TitleVerify itemId={item.id} onVerified={onVerified} />}
              {rem && (
                <div className="rounded-lg p-3" style={{ background: "var(--surface)", border: "1px solid var(--accent-wash)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-secondary)" }}>Est. cost to remedy</div>
                      <div className="text-base font-bold mono" style={{ color: "var(--text-primary)" }}>{fmt(rem.low)}–{fmt(rem.high)}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{rem.description}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onSeeRenovations(); }} className="flex items-center gap-1 text-sm font-semibold cursor-pointer flex-shrink-0" style={{ color: "var(--brand)" }}>
                      See in Renovations <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function UploadPrompt({ itemId, onVerified }: { itemId: string; onVerified?: (doc: DocAnalysis) => void }) {
  return (
    <div className="pt-3 rounded-lg p-3 mt-3" style={{ background: "var(--surface)", border: "1px dashed var(--warn-wash)" }}>
      <div className="flex items-start gap-2 mb-3">
        <FileSearch size={15} className="mt-0.5 flex-shrink-0" style={{ color: "var(--warn)" }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          This item isn&apos;t scored from a guess. Upload {DOC_NAME[itemId]} and Claude will read the whole document,
          summarise it in plain English, give it a verified 1–10 score, and update your overall property score.
        </p>
      </div>
      {onVerified && <DocUpload itemId={itemId} onVerified={onVerified} />}
    </div>
  );
}

function VerifiedView({ doc, itemId, onVerified }: { doc: DocAnalysis; itemId: string; onVerified?: (doc: DocAnalysis) => void }) {
  return (
    <div className="pt-3 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Plain-English summary</div>
      <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.75 }}>{doc.summary}</p>

      {doc.keyFindings.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Key findings</div>
          <ul className="space-y-1">
            {doc.keyFindings.map((f, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                <CheckCircle2 size={11} className="mt-0.5 flex-shrink-0" style={{ color: "var(--good)" }} />{f}
              </li>
            ))}
          </ul>
        </div>
      )}
      {doc.redFlags.length > 0 && (
        <div className="rounded-lg p-2.5" style={{ background: "var(--bad-wash)", border: "1px solid var(--bad-wash)" }}>
          <div className="text-xs font-semibold mb-1.5" style={{ color: "var(--bad)" }}>Red flags</div>
          <ul className="space-y-1">
            {doc.redFlags.map((f, i) => (
              <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>• {f}</li>
            ))}
          </ul>
        </div>
      )}
      {onVerified && (
        <div className="flex items-center gap-2 pt-1">
          <DocUpload itemId={itemId} label="Replace document" onVerified={onVerified} />
        </div>
      )}
    </div>
  );
}

function TitleVerify({ itemId, onVerified }: { itemId: string; onVerified?: (doc: DocAnalysis) => void }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "var(--surface)", border: "1px dashed var(--border)" }}>
      <div className="text-xs" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
        The score above is <strong style={{ color: "var(--text-secondary)" }}>indicative</strong> — inferred from the listing&apos;s stated title type.
        An official title can&apos;t be scraped freely (Toitū Te Whenua LINZ title searches are a paid Landonline service).
        Order one, then upload the PDF here for a <strong style={{ color: "var(--text-secondary)" }}>verified</strong> score.
      </div>
      {onVerified && <div className="mt-2.5"><DocUpload itemId={itemId} label="Upload title search PDF" onVerified={onVerified} /></div>}
    </div>
  );
}
