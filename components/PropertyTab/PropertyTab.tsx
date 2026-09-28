"use client";

import { useState } from "react";
import type { ItemValue, ShellWorkings, EstimatedItem } from "@/lib/scoring/improvement-values";
import { BaseRateCard } from "./BaseRateCard";
import type { AnyValuation } from "./valuation-types";
import type { PropertyTabData, RenoControls } from "@/lib/property-tab/types";
import type { DwellingValue } from "@/lib/scoring/extra-dwelling-value";
import type { Persona } from "@/lib/scoring/model";
import { CategoryAccordion } from "./CategoryAccordion";
import { ConditionScore } from "./ConditionScore";
import { ExtraDwellingCard } from "./ExtraDwellingCard";
import { buildEraFlags } from "@/lib/scoring/build-era";
import { Home, AlertTriangle, ArrowRight, ChevronRight } from "lucide-react";

interface Props {
  data: PropertyTabData;
  region?: string;
  floorSqm?: number | null;
  noPhotos?: boolean;
  buildYear?: number | null;
  persona?: Persona;
  renoControls?: RenoControls;
  onOpenRenovations?: () => void;
  dwellingValues?: DwellingValue[];
}

export function PropertyTab({ data, region, floorSqm, noPhotos, buildYear, persona = "buyer", renoControls, onOpenRenovations, dwellingValues, itemValues, itemValuations, estimates, shell }: Props & { itemValues?: Map<string, ItemValue>; itemValuations?: Map<string, AnyValuation>; estimates?: Map<string, EstimatedItem>; shell?: ShellWorkings }) {
  const [openAll, setOpenAll] = useState(false);

  // Tally issues across all categories
  const allSubItems = data.categories.flatMap((c) => c.subItems);
  const critical  = allSubItems.filter((s) => s.score !== null && s.score <= 2).length;
  const urgent    = allSubItems.filter((s) => s.score !== null && s.score >= 3 && s.score <= 4).length;
  const eraFlags  = buildEraFlags(buildYear);

  return (
    <div className="space-y-6">

      {/* The base rate of the house and its workings — or, with no photos, an
          honest "nothing assessed" notice. It replaced a Critical / Urgent /
          Monitor / Good tally: the report is in dollars now, and the shell was
          the one part of the building value no card explained. */}
      {noPhotos ? (
        <>
          <div className="rounded-2xl p-5 text-center" style={{ background: "var(--surface)", border: "1px solid var(--brand)" }}>
            <div className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>📷 No photos uploaded</div>
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>0 items assessed — upload photos to run the full condition report.</p>
            <a href="/report/upload" className="btn-primary text-sm px-4 py-2 inline-flex">Upload photos <ArrowRight size={15} /></a>
          </div>

          {eraFlags.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: "var(--warn-wash)", border: "1px solid var(--warn-wash)" }}>
              <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: "var(--warn)" }}>
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
        shell && <BaseRateCard shell={shell} />
      )}

      {/* Key flags */}
      {(critical > 0 || urgent > 0) && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "var(--bad-wash)",
            border: "1px solid var(--bad-wash)",
          }}
        >
          <div className="flex items-center gap-2 font-semibold text-sm mb-3" style={{ color: "var(--bad)" }}>
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
                    style={{ background: s.score! <= 2 ? "var(--bad)" : "var(--warn)" }}
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
        {data.categories.map((category) => {
          return (
            <CategoryAccordion
              key={`${category.id}:${openAll}`}
              itemValues={itemValues}
              itemValuations={itemValuations}
              estimates={estimates}
              category={category}
              // Folded by default, urgent or not — the category header already
              // shows its value and its issues, and eight open categories made
              // the tab a wall. "Expand all" opens the lot.
              defaultOpen={openAll}
              region={region}
              floorSqm={floorSqm}
              persona={persona}
              renoControls={renoControls}
              onOpenRenovations={onOpenRenovations}
            />
          );
        })}
      </div>

      {/* Extra dwellings — folded like a category, with what they add on the
          header, so the section reads the same as the eight above it. */}
      {data.extraDwellings.length > 0 && (
        <ExtraDwellingsAccordion
          key={String(openAll)}
          defaultOpen={openAll}
          dwellings={data.extraDwellings}
          dwellingValues={dwellingValues}
          noPhotos={noPhotos}
          renoControls={renoControls}
          onOpenRenovations={onOpenRenovations}
        />
      )}
    </div>
  );
}

function ExtraDwellingsAccordion({ dwellings, dwellingValues, noPhotos, defaultOpen, renoControls, onOpenRenovations }: {
  dwellings: PropertyTabData["extraDwellings"];
  dwellingValues?: DwellingValue[];
  noPhotos?: boolean;
  defaultOpen: boolean;
  renoControls?: RenoControls;
  onOpenRenovations?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // The same figures each card shows, summed — so the header adds up to them.
  const values = dwellings.map((d) => dwellingValues?.find((x) => x.id === d.id)).filter((v): v is DwellingValue => !!v);
  const added = values.reduce((s, v) => s + v.addedValue, 0);
  const replacement = values.reduce((s, v) => s + v.replacementNew, 0);
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <button
        className="w-full text-left p-5 cursor-pointer flex items-center gap-4"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ borderLeft: "4px solid var(--brand)" }}
      >
        <Home size={22} className="flex-shrink-0" style={{ color: "var(--brand)" }} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base mb-1" style={{ color: "var(--text-primary)" }}>
            Extra dwellings & structures
          </div>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {dwellings.length} {dwellings.length === 1 ? "structure" : "structures"}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {!noPhotos && values.length > 0 && (
            <span
              className="inline-flex flex-col items-end sm:flex-row sm:items-baseline sm:gap-1 rounded-lg font-bold tabular-nums"
              style={{
                background: "var(--brand-light)",
                border: "1px solid var(--brand)",
                color: "var(--brand)",
                fontFamily: "Fira Code, monospace",
                padding: "3px 10px",
                fontSize: 13,
              }}
              title={`What these structures add to the property, against about ${money(replacement)} to build them new.`}
            >
              <span>
                {money(added)}
                <span className="font-medium" style={{ fontSize: 10, opacity: 0.8 }}> adds</span>
              </span>
              <span className="font-medium" style={{ fontSize: 10, opacity: 0.8 }}>
                <span className="hidden sm:inline">· </span>{money(replacement)} new
              </span>
            </span>
          )}
          <ChevronRight
            size={18}
            style={{ color: "var(--text-muted)", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
          />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
          {dwellings.map((d) => (
            <ExtraDwellingCard key={d.id} dwelling={d} noPhotos={noPhotos} value={dwellingValues?.find((x) => x.id === d.id)} renoControls={renoControls} onOpenRenovations={onOpenRenovations} />
          ))}
        </div>
      )}
    </div>
  );
}
