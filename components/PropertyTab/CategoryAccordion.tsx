"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Category } from "@/lib/property-tab/types";
import { worstSubItemScore, urgencyColor } from "@/lib/property-tab/types";
import { SubItemCard } from "./SubItemCard";
import { UrgencyBadge } from "./UrgencyBadge";

const accentColors = {
  green: "#00e676",
  amber: "#fbbf24",
  red:   "#ff5f5f",
  muted: "#3d7872",
};

interface Props {
  category: Category;
  defaultOpen?: boolean;
  region?: string;
  floorSqm?: number | null;
}

export function CategoryAccordion({ category, defaultOpen = false, region, floorSqm }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const worst = worstSubItemScore(category);
  const colorKey = urgencyColor(worst);
  const accentColor = accentColors[colorKey];

  const scored = category.subItems.filter((s) => s.score !== null);
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((sum, s) => sum + (s.score as number), 0) / scored.length)
    : null;

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
              <span className="text-xs font-semibold" style={{ color: "#ff5f5f" }}>
                {issues} issue{issues > 1 ? "s" : ""}
              </span>
            )}
            {warnings > 0 && (
              <span className="text-xs font-semibold" style={{ color: "#fbbf24" }}>
                {warnings} to monitor
              </span>
            )}
          </div>
        </div>

        {/* Avg score pill + chevron */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {worst !== null && (
            <UrgencyBadge
              score={worst}
              label={worst <= 4 ? "Needs work" : worst <= 7 ? "Monitor" : "Good"}
              size="sm"
            />
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
            <SubItemCard key={item.id} item={item} region={region} floorSqm={floorSqm} />
          ))}
        </div>
      )}
    </div>
  );
}
