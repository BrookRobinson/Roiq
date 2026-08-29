"use client";

import { useState } from "react";
import type { SubItem } from "@/lib/property-tab/types";
import type { DocAnalysis } from "@/lib/report-store";
import type { ScoreResult } from "@/lib/scoring/engine";
import { itemMaxPoints } from "@/lib/scoring/engine";
import type { Inspection, Persona } from "@/lib/scoring/model";
import { INSPECTION_META, ITEM_BY_ID } from "@/lib/scoring/catalog";
import { isFactsOnly } from "@/lib/scoring/model";
import { DEV_TIERS, developmentBonus, type DevelopmentPotential } from "@/lib/scoring/development";
import { AddStructure, type PlacedStructure } from "./AddStructure";
import {
  landBandLabel, sectionSizeStat, topographyStat, shapeStat, treesStat, aspectStat, frontageStat,
} from "@/lib/scoring/land-quality";
import { InspectionCard } from "./InspectionCard";
import { ChevronRight, Info, Home, Check, AlertTriangle } from "lucide-react";

const fmtNZD = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

const DEV_TIER_COLOR: Record<string, string> = { none: "var(--text-muted)", minor_dwelling: "var(--brand)", second_dwelling: "var(--good)", subdivision: "var(--warn)" };

// Headline "can you add a dwelling?" card — a positive opportunity on the Land tab.
function DevelopmentPotentialCard({ dev, persona, onAddStructure, addedStructureIds }: {
  dev: DevelopmentPotential;
  persona: Persona;
  onAddStructure?: (s: PlacedStructure) => void;
  addedStructureIds?: string[];
}) {
  const meta = DEV_TIERS[dev.tier];
  const c = DEV_TIER_COLOR[dev.tier];
  const bonus = developmentBonus(dev.tier, persona, dev.restrictedByTitle);
  const has = dev.tier !== "none";
  return (
    <div className="rounded-2xl p-5" style={{ border: `1px solid ${has ? c + "55" : "var(--border)"}`, background: "var(--surface)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Home size={16} style={{ color: "var(--brand)" }} />
          <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>Add a structure — what this section will take</h3>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: `${c}1f`, color: c, border: `1px solid ${c}55` }}>{meta.short}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{meta.label}{has ? ` · ${dev.confidence}` : ""}</span>
        {has && dev.valueUpliftHigh > 0 && (
          <span className="text-sm mono" style={{ color: "var(--good)" }}>+{fmtNZD(dev.valueUpliftLow)}–{fmtNZD(dev.valueUpliftHigh)} potential value</span>
        )}
        {bonus > 0 && <span className="text-xs mono" style={{ color: "var(--text-muted)" }}>+{bonus} to your {persona === "investor" ? "investor" : "buyer"} score</span>}
        {/* Withheld, and SAID rather than silently absent. The points are
            awarded for a development we can no longer confirm is permitted, and
            a bonus that just disappears reads as a bug. */}
        {has && dev.restrictedByTitle && (
          <span className="text-xs mono" style={{ color: "var(--warn)" }}>
            score bonus withheld — {dev.titleRestrictions.length === 1 ? "an instrument is" : `${dev.titleRestrictions.length} instruments are`} registered on the title
          </span>
        )}
      </div>

      <p className="text-sm mt-2" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{dev.summary}</p>

      {(dev.enablers.length > 0 || dev.blockers.length > 0) && (
        <div className="mt-3 space-y-1.5">
          {dev.enablers.map((e, i) => (
            <div key={`e${i}`} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <Check size={13} className="mt-0.5 flex-shrink-0" style={{ color: "var(--good)" }} />{e}
            </div>
          ))}
          {dev.blockers.map((b, i) => (
            <div key={`b${i}`} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" style={{ color: "var(--warn)" }} />{b}
            </div>
          ))}
        </div>
      )}
      {/* Measured, so the reader can place their own. The static plan is only
          drawn when there is no geometry to drive the interactive one. */}
      {dev.layout ? (
        <div className="mt-4">
          <AddStructure layout={dev.layout} onAdd={onAddStructure} added={addedStructureIds} />
        </div>
      ) : null}

      {/* This used to read "estimated from the section size vs the house
          footprint … must be confirmed with the council / LIM" — wrong on both
          counts once the parcel is measured, and the second half is the
          homework rule failing: telling the reader to go and find out is the
          job they came here to avoid. */}
      <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
        {dev.measured ? (
          <>
            Measured from the LINZ parcel boundary and building footprints, against the{" "}
            <strong style={{ color: "var(--text-secondary)" }}>National Environmental Standards for Detached Minor Residential Units</strong>{" "}
            (in force 15 January 2026): 70m² maximum, 2m from boundaries and from other buildings, 50% maximum site
            coverage in residential zones. The NES does not override the district plan&apos;s hazard rules, a covenant on
            the title, or a cross-lease or unit-title arrangement — so this says what fits and what the national
            standard permits, never that a council has agreed to it.
          </>
        ) : (
          <>
            Indicative — estimated from the section size against the house footprint. We couldn&apos;t retrieve this
            property&apos;s parcel boundary, so where the buildings actually sit isn&apos;t in this figure.
          </>
        )}
      </p>
    </div>
  );
}

// v4: the Address tab scores Land + Legal; the Location tab shows location as
// un-scored facts (location desirability is subjective, so it never scores).
const ADDRESS_SECTIONS: Inspection[] = ["land", "legal"];
const TOWN_SECTIONS: Inspection[] = ["location"];

const barColor = (pct: number) => (pct >= 80 ? "var(--good)" : pct >= 55 ? "var(--warn)" : "var(--bad)");

export function PropertyInspections({
  scored,
  subItems,
  onSeeRenovations,
  verifiedDocs,
  onVerified,
  mode = "address",
  development,
  persona = "buyer",
  landAreaSqm,
  onAddStructure,
  addedStructureIds,
}: {
  scored: ScoreResult;
  subItems: SubItem[];
  onSeeRenovations: () => void;
  verifiedDocs?: Record<string, DocAnalysis>;
  onVerified?: (itemId: string, doc: DocAnalysis) => void;
  mode?: "address" | "town";
  development?: DevelopmentPotential;
  persona?: Persona;
  landAreaSqm?: number | null;
  /** A structure the reader placed on their own section, bound for Renovations. */
  onAddStructure?: (s: PlacedStructure) => void;
  addedStructureIds?: string[];
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
          : "Land and Legal factors specific to THIS address — each carries a rating (section size shows its actual area), a named source, a confidence tier, and reasoning. Ordered worst-first; remediable findings link to the Renovations tab."}
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
            landAreaSqm={landAreaSqm}
            persona={persona}
          />
        );
      })}

      {/* Sits BELOW Land and Legal deliberately. It is the one thing on this tab
          that looks forward rather than reporting what is: everything above is
          what the property IS, and this is what could be done with it. Reading
          the findings first and then being offered the section to build on is
          the order the decision is actually made in. */}
      {!town && development && (
        <DevelopmentPotentialCard
          dev={development}
          persona={persona}
          onAddStructure={onAddStructure}
          addedStructureIds={addedStructureIds}
        />
      )}
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
  landAreaSqm,
  persona,
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
  landAreaSqm?: number | null;
  /** Legal points are persona-weighted — the title is 28 to a buyer, 30 to an investor. */
  persona: Persona;
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
            {issues > 0 && <span className="text-xs font-semibold" style={{ color: "var(--bad)" }}>{issues} concern{issues > 1 ? "s" : ""}</span>}
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
                bandLabel={
                  inspection === "land"
                    ? landBandLabel(item.id, item.score, landAreaSqm, item.slopeBand, item.shapeType, item.treeMaturity, item.aspectDirection, item.accessType)
                    : undefined
                }
                statOverride={
                  item.id === "land_size"
                    ? sectionSizeStat(landAreaSqm) ?? undefined
                    : item.id === "land_topography"
                    ? topographyStat(item.slopeBand, item.usableLandPct, landAreaSqm) ?? undefined
                    : item.id === "land_shape"
                    ? shapeStat(item.shapeType, item.workableLandPct, landAreaSqm) ?? undefined
                    : item.id === "land_trees"
                    ? treesStat(item.treeMaturity, item.treeUpkeep, item.treesProtected) ?? undefined
                    : item.id === "land_aspect"
                    ? aspectStat(item.aspectDirection, item.sunObstruction) ?? undefined
                    : item.id === "land_frontage"
                    ? frontageStat(item.accessType, item.homesOnAccess) ?? undefined
                    : undefined
                }
                // Legal items print POINTS rather than a mark out of ten. The
                // title is worth 28 of a buyer's 1,000 and 30 of an investor's,
                // and "5/10" says neither — nor does it say that the same cross
                // lease costs the two readers different amounts.
                pointsMax={inspection === "legal" ? itemMaxPoints(item.id, persona) : null}
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
