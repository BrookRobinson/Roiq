"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Category } from "@/lib/property-tab/types";
import { worstSubItemScore } from "@/lib/property-tab/types";
import { SubItemCard, pointsColor } from "./SubItemCard";
import { ConditionScore, conditionScoreColor } from "./ConditionScore";
import { improvementItemPoints } from "@/lib/scoring/engine";
import type { Persona } from "@/lib/scoring/model";
import type { RenoControls } from "@/lib/property-tab/types";

interface Props {
  category: Category;
  defaultOpen?: boolean;
  region?: string;
  floorSqm?: number | null;
  persona?: Persona;
  renoControls?: RenoControls;
  onOpenRenovations?: () => void;
}

export function CategoryAccordion({ category, defaultOpen = false, region, floorSqm, persona = "buyer", renoControls, onOpenRenovations }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const worst = worstSubItemScore(category);
  const accentColor = conditionScoreColor(worst);

  // Category points roll-up — sum the assessed sub-items' earned/max points (v5).
  // Matches the per-item "X/max" badges so the numbers add up on screen; the max
  // is the category's total weight for the active persona (e.g. Kitchen 70 buyer).
  const catPts = category.subItems.reduce(
    (acc, s) => {
      const p = improvementItemPoints(s.id, s.specTier, s.score, persona);
      if (p) { acc.earned += p.earned; acc.max += p.max; acc.any = true; }
      return acc;
    },
    { earned: 0, max: 0, any: false }
  );
  const catColor = catPts.any ? pointsColor(catPts.earned / catPts.max) : accentColor;

  const issues = category.subItems.filter((s) => s.score !== null && s.score <= 4).length;
  const warnings = category.subItems.filter((s) => s.score !== null && s.score >= 5 && s.score <= 7).length;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${open ? accentColor + "40" : "var(--border)"}`,
        background: "var(--surface)",
        transition: "border-color 0.2s",
      }}
    >
      {/* Category header */}
      <button
        className="w-full text-left p-5 cursor-pointer flex items-center gap-4"
        onClick={() => setOpen(!open)}
        style={{ borderLeft: `4px solid ${accentColor}` }}
      >
        {/* Icon */}
        <span className="text-2xl flex-shrink-0">{category.icon}</span>

        {/* Name + summary */}
        <div className="flex-1 min-w-0">
          <div
            className="font-bold text-base mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            {category.name}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {category.subItems.length} items
            </span>
            {issues > 0 && (
              <span className="text-xs font-semibold" style={{ color: "var(--bad)" }}>
                {issues} issue{issues > 1 ? "s" : ""}
              </span>
            )}
            {warnings > 0 && (
              <span className="text-xs font-semibold" style={{ color: "var(--warn)" }}>
                {warnings} to monitor
              </span>
            )}
          </div>
        </div>

        {/* Category points roll-up pill + chevron */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {catPts.any ? (
            <span
              className="inline-flex items-baseline gap-1 rounded-lg font-bold tabular-nums"
              style={{
                background: `${catColor}1f`,
                border: `1px solid ${catColor}55`,
                color: catColor,
                fontFamily: "Fira Code, monospace",
                padding: "3px 10px",
                fontSize: 13,
              }}
              title="Category points — the sub-items' earned points added up, out of this category's total for your selected mode."
            >
              {catPts.earned}/{catPts.max}
              <span className="font-medium" style={{ fontSize: 10, opacity: 0.8 }}>pts</span>
            </span>
          ) : (
            worst !== null && <ConditionScore score={worst} size="sm" />
          )}
          <ChevronRight
            size={18}
            style={{
              color: "var(--text-muted)",
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
        </div>
      </button>

      {/* Sub-items */}
      {open && (
        <div
          className="px-5 pb-5 space-y-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="pt-4" />
          {category.subItems.map((item) => (
            <SubItemCard key={item.id} item={item} region={region} floorSqm={floorSqm} persona={persona} renoControls={renoControls} onOpenRenovations={onOpenRenovations} />
          ))}
        </div>
      )}
    </div>
  );
}
