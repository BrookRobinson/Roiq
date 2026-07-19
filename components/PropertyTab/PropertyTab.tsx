"use client";

import { useState } from "react";
import type { PropertyTabData } from "@/lib/property-tab/types";
import type { Persona } from "@/lib/scoring/model";
import type { ItemValue } from "@/lib/scoring/improvement-values";
import { worstSubItemScore } from "@/lib/property-tab/types";
import { CategoryAccordion } from "./CategoryAccordion";
import { ConditionScore } from "./ConditionScore";
import { ExtraDwellingCard } from "./ExtraDwellingCard";
import { buildEraFlags } from "@/lib/scoring/build-era";
import { Home, AlertTriangle, Info, ArrowRight } from "lucide-react";

interface Props {
  data: PropertyTabData;
  region?: string;
  floorSqm?: number | null;
  noPhotos?: boolean;
  buildYear?: number | null;
  persona?: Persona;
  itemValues?: Map<string, ItemValue>;
}

export function PropertyTab({ data, region, floorSqm, noPhotos, buildYear, persona = "buyer", itemValues }: Props) {
  const [openAll, setOpenAll] = useState(false);

  // Tally issues across all categories
  const allSubItems = data.categories.flatMap((c) => c.subItems);
  const critical  = allSubItems.filter((s) => s.score !== null && s.score <= 2).length;
  const urgent    = allSubItems.filter((s) => s.score !== null && s.score >= 3 && s.score <= 4).length;
  const monitor   = allSubItems.filter((s) => s.score !== null && s.score >= 5 && s.score <= 7).length;
  const good      = allSubItems.filter((s) => s.score !== null && s.score >= 8).length;
  const unscored  = allSubItems.filter((s) => s.score === null).length;
  const eraFlags  = buildEraFlags(buildYear);

  return (
    <div className="space-y-6">

      {/* Summary strip — or, with no photos, an honest "nothing assessed" notice */}
      {noPhotos ? (
        <>
          <div className="rounded-2xl p-5 text-center" style={{ background: "var(--surface)", border: "1px solid var(--brand)" }}>
            <div className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>📷 No photos uploaded</div>
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>0 items assessed — upload photos to run the full condition report.</p>
            <a href="/report/upload" className="btn-primary text-sm px-4 py-2 inline-flex">Upload photos <ArrowRight size={15} /></a>
          </div>

          {eraFlags.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.3)" }}>
              <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: "#fbbf24" }}>
                <AlertTriangle size={15} /> Build era risk flags
              </div>
              <div className="text-xs mt-0.5 mb-3" style={{ color: "var(--text-muted)" }}>
                Inferred from build year{buildYear ? ` (c.${buildYear})` : ""} — not visually confirmed.
              </div>
              <div className="space-y-2.5">
                {eraFlags.map((f, i) => (
                  <div key={i} className="text-sm">
                    <div className="font-medium" style={{ color: "var(--text-primary)" }}>• {f.title}</div>
                    <div className="text-xs mt-0.5 ml-3" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>{f.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div
          className="rounded-2xl p-5 grid sm:grid-cols-5 gap-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {[
            { label: "Critical",       count: critical,  color: "#ff5f5f",   bg: "rgba(255,95,95,0.1)"    },
            { label: "Urgent",         count: urgent,    color: "#fb923c",   bg: "rgba(251,146,60,0.1)"   },
            { label: "Monitor",        count: monitor,   color: "#fbbf24",   bg: "rgba(251,191,36,0.1)"   },
            { label: "Good",           count: good,      color: "#00e676",   bg: "rgba(0,230,118,0.1)"    },
            { label: "Not assessed",   count: unscored,  color: "var(--text-muted)", bg: "var(--surface-2)" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-3 text-center"
              style={{ background: s.bg, border: `1px solid ${s.color}22` }}
            >
              <div className="text-2xl font-bold mono" style={{ color: s.color }}>{s.count}</div>
              <div className="text-xs font-medium mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Key flags */}
      {(critical > 0 || urgent > 0) && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "rgba(255,95,95,0.06)",
            border: "1px solid rgba(255,95,95,0.2)",
          }}
        >
          <div className="flex items-center gap-2 font-semibold text-sm mb-3" style={{ color: "#ff5f5f" }}>
            <AlertTriangle size={15} />
            Priority items — act before making an offer
          </div>
          <div className="space-y-2">
            {allSubItems
              .filter((s) => s.score !== null && s.score <= 4)
              .map((s) => (
                <div key={s.id} className="flex items-start gap-2 text-sm">
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: s.score! <= 2 ? "#ff5f5f" : "#fb923c" }}
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {s.name}
                    </span>
                    <ConditionScore score={s.score} size="sm" />
                    {s.estimatedReplacementCost && (
                      <span className="text-xs mono" style={{ color: "var(--brand)" }}>
                        ${s.estimatedReplacementCost.low.toLocaleString()}–
                        ${s.estimatedReplacementCost.high.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
          {data.categories.length} categories · {allSubItems.length} sub-items assessed
        </h3>
        <button
          onClick={() => setOpenAll(!openAll)}
          className="btn-secondary text-xs py-1.5 px-3"
        >
          {openAll ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {/* Category accordions */}
      <div className="space-y-3">
        {data.categories.map((category, i) => {
          const worst = worstSubItemScore(category);
          const isUrgent = worst !== null && worst <= 4;
          return (
            <CategoryAccordion
              key={category.id}
              category={category}
              defaultOpen={openAll || isUrgent || i === 0}
              region={region}
              floorSqm={floorSqm}
              persona={persona}
              itemValues={itemValues}
            />
          );
        })}
      </div>

      {/* Extra dwellings */}
      {data.extraDwellings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Home size={16} style={{ color: "var(--brand)" }} />
            <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
              Extra Dwellings & Structures
            </h3>
            <div
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--brand-light)", color: "var(--brand)" }}
            >
              Adds value to score
            </div>
          </div>
          <div className="space-y-4">
            {data.extraDwellings.map((d) => (
              <ExtraDwellingCard key={d.id} dwelling={d} noPhotos={noPhotos} />
            ))}
          </div>
        </div>
      )}

      {/* Scoring methodology note */}
      <div
        className="rounded-xl p-4 flex items-start gap-3 text-xs"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
        <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--text-secondary)" }}>Scoring methodology:</strong>{" "}
          This is the <strong>Improvements</strong> inspection — one of four (Improvements, Location,
          Land, Legal) in RoiQ&apos;s 1,000-point model. Each sub-item is scored 1–10, then weighted by
          persona-specific points that differ for Home Buyers and Investors; toggle the mode in the
          header to re-weight the whole score. Extra dwellings add a bonus of up to 50 points.
          Tier 3 (unscored) items are excluded from the denominator and flagged for inspection.
        </p>
      </div>
    </div>
  );
}
