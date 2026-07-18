"use client";

import { useState } from "react";
import type { SubItem } from "@/lib/property-tab/types";
import type { DocAnalysis } from "@/lib/report-store";
import type { ScoreResult } from "@/lib/scoring/engine";
import type { Inspection } from "@/lib/scoring/model";
import { INSPECTION_META, ITEM_BY_ID } from "@/lib/scoring/catalog";
import { isFactsOnly } from "@/lib/scoring/model";
import { InspectionCard } from "./InspectionCard";
import { ChevronRight, Info } from "lucide-react";

// v4: the Address tab scores Land + Legal; the Location tab shows location as
// un-scored facts (location desirability is subjective, so it never scores).
const ADDRESS_SECTIONS: Inspection[] = ["land", "legal"];
const TOWN_SECTIONS: Inspection[] = ["location"];

const barColor = (pct: number) => (pct >= 80 ? "#00e676" : pct >= 55 ? "#fbbf24" : "#ff5f5f");

export function PropertyInspections({
  scored,
  subItems,
  onSeeRenovations,
  verifiedDocs,
  onVerified,
  mode = "address",
}: {
  scored: ScoreResult;
  subItems: SubItem[];
  onSeeRenovations: () => void;
  verifiedDocs?: Record<string, DocAnalysis>;
  onVerified?: (itemId: string, doc: DocAnalysis) => void;
  mode?: "address" | "town";
}) {
  const town = mode === "town";
  const SECTIONS = town ? TOWN_SECTIONS : ADDRESS_SECTIONS;
  const byInspection: Record<string, SubItem[]> = {};
  for (const s of subItems) {
    const insp = ITEM_BY_ID[s.id]?.inspection;
    if (insp !== "location" && insp !== "land" && insp !== "legal") continue;
    // Location tab shows the facts-only location items; Address tab shows the scored rest.
    if (isFactsOnly(s.id) !== town) continue;
    (byInspection[insp] ??= []).push(s);
  }
  // Worst-first within each section (nulls last).
  for (const k of Object.keys(byInspection)) {
    byInspection[k].sort((a, b) => (a.score ?? 99) - (b.score ?? 99));
  }

  return (
    <div className="space-y-3">
      <div className="card p-4 text-sm flex items-start gap-2" style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
        <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
        {town
          ? "Location facts — schools, transport, amenities, sun, views and outlook. Shown so you can weigh them yourself; location is subjective, so it is NOT counted in the score. Objective location negatives (highway, flight path…) are handled as penalties on the Overview."
          : "Land and Legal factors specific to THIS address — each carries a 1–10 score, a named source, a confidence tier, and reasoning. Ordered worst-first; remediable findings link to the Renovations tab."}
      </div>

      {SECTIONS.map((insp, i) => {
        const items = byInspection[insp] ?? [];
        const v = scored.byInspection[insp];
        const worst = items.reduce<number | null>((m, s) => (s.score !== null && (m === null || s.score < m) ? s.score : m), null);
        const defaultOpen = i === 0 || (worst !== null && worst <= 4);
        return (
          <Section
            key={insp}
            inspection={insp}
            items={items}
            earned={v.earned}
            max={v.max}
            pct={v.pct}
            showScore={!town}
            defaultOpen={defaultOpen}
            onSeeRenovations={onSeeRenovations}
            verifiedDocs={verifiedDocs}
            onVerified={onVerified}
          />
        );
      })}
    </div>
  );
}

function Section({
  inspection,
  items,
  earned,
  max,
  pct,
  showScore,
  defaultOpen,
  onSeeRenovations,
  verifiedDocs,
  onVerified,
}: {
  inspection: Inspection;
  items: SubItem[];
  earned: number;
  max: number;
  pct: number;
  showScore: boolean;
  defaultOpen: boolean;
  onSeeRenovations: () => void;
  verifiedDocs?: Record<string, DocAnalysis>;
  onVerified?: (itemId: string, doc: DocAnalysis) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = INSPECTION_META[inspection];
  const col = showScore ? barColor(pct) : "var(--text-muted)";
  const issues = items.filter((s) => s.score !== null && s.score <= 4).length;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${open ? col + "40" : "var(--border)"}`, background: "var(--surface)", transition: "border-color 0.2s" }}>
      <button className="w-full text-left p-5 cursor-pointer flex items-center gap-4" onClick={() => setOpen(!open)} style={{ borderLeft: `4px solid ${col}` }}>
        <span className="text-2xl flex-shrink-0">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{meta.label}</div>
          <div className="flex items-center gap-3 flex-wrap mt-0.5">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{items.length} items</span>
            {issues > 0 && <span className="text-xs font-semibold" style={{ color: "#ff5f5f" }}>{issues} concern{issues > 1 ? "s" : ""}</span>}
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{meta.blurb}</span>
          </div>
        </div>
        {/* Section score bar — hidden for City/Town (context only, not scored) */}
        {showScore ? (
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0 w-48">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
            </div>
            <span className="text-xs mono w-16 text-right" style={{ color: "var(--text-secondary)" }}>{earned}/{max}</span>
          </div>
        ) : (
          <span className="hidden sm:inline text-[11px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>not scored</span>
        )}
        <ChevronRight size={18} className="flex-shrink-0" style={{ color: "var(--text-muted)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="pt-4" />
          {items.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No items assessed for this section.</p>
          ) : (
            items.map((item) => (
              <InspectionCard
                key={item.id}
                item={item}
                inspectionLabel={meta.label}
                onSeeRenovations={onSeeRenovations}
                verifiedDoc={verifiedDocs?.[item.id]}
                onVerified={onVerified ? (doc) => onVerified(item.id, doc) : undefined}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
