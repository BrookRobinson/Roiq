"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Category } from "@/lib/property-tab/types";
import { worstSubItemScore } from "@/lib/property-tab/types";
import { SubItemCard, pointsColor } from "./SubItemCard";
import { ConditionScore, conditionScoreColor } from "./ConditionScore";
import type { ItemValue, EstimatedItem } from "@/lib/scoring/improvement-values";
import { isRefused, type AnyValuation } from "./valuation-types";
import type { Persona } from "@/lib/scoring/model";
import type { RenoControls } from "@/lib/property-tab/types";
import { alpha } from "@/lib/ui/color";

interface Props {
  category: Category;
  defaultOpen?: boolean;
  region?: string;
  floorSqm?: number | null;
  persona?: Persona;
  renoControls?: RenoControls;
  onOpenRenovations?: () => void;
}

export function CategoryAccordion({ category, defaultOpen = false, region, floorSqm, persona = "buyer", renoControls, onOpenRenovations, itemValues, itemValuations, estimates }: Props & { itemValues?: Map<string, ItemValue>; itemValuations?: Map<string, AnyValuation>; estimates?: Map<string, EstimatedItem> }) {
  // Only the two rooms that are genuinely gutted as a unit. A "whole Exterior"
  // or "whole Bedrooms" is not a job anybody quotes.
  const roomKey =
    category.name === "Kitchen" ? "room_kitchen" : category.name === "Bathroom" ? "room_bathroom" : null;
  const [open, setOpen] = useState(defaultOpen);
  const worst = worstSubItemScore(category);
  const accentColor = conditionScoreColor(worst);

  // Category roll-up, in dollars. Sums what the items in it are worth against
  // what they would cost to replace — the same two numbers on every card, so
  // the totals on screen add up to the category header above them.
  const catPts = category.subItems.reduce(
    (acc, s) => {
      // Exactly the pair the card shows: its seven-step valuation when it has
      // one, the itemised value otherwise. Summing a different pair here is how
      // the header came to read "$27,409 of $25,200" above cards that didn't.
      const d = itemValuations?.get(s.id);
      const v = itemValues?.get(s.id);
      if (d && !isRefused(d)) { acc.earned += d.valueNZD; acc.max += d.cost.totalNZD; acc.any = true; }
      else if (v) { acc.earned += v.valueNow; acc.max += v.replacementTotal; acc.any = true; }
      // What no photo showed, estimated from the house — in the building value,
      // so in the total here too, and said separately so it isn't mistaken for
      // something we saw. Either the whole item, or its unphotographed rooms.
      for (const e of [estimates?.get(s.id), estimates?.get(`${s.id}:unseen`)]) {
        if (!e) continue;
        acc.earned += e.valueNow;
        acc.max += e.replacementTotal;
        acc.est += e.valueNow;
        acc.any = true;
      }
      return acc;
    },
    { earned: 0, max: 0, est: 0, any: false }
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
            <span className="flex flex-col items-end gap-0.5">
            <span
              // Stacks on a phone: side by side it squeezed the category name
              // into a one-word column.
              className="inline-flex flex-col items-end sm:flex-row sm:items-baseline sm:gap-1 rounded-lg font-bold tabular-nums"
              style={{
                background: `${alpha(catColor, 12)}`,
                border: `1px solid ${alpha(catColor, 33)}`,
                color: catColor,
                fontFamily: "Fira Code, monospace",
                padding: "3px 10px",
                fontSize: 13,
              }}
              title={`What this category is worth today, against about $${Math.round(catPts.max).toLocaleString("en-NZ")} to replace it new.`}
            >
              <span>
                ${Math.round(catPts.earned).toLocaleString("en-NZ")}
                <span className="font-medium" style={{ fontSize: 10, opacity: 0.8 }}> now</span>
              </span>
              <span className="font-medium" style={{ fontSize: 10, opacity: 0.8 }}>
                <span className="hidden sm:inline">· </span>${Math.round(catPts.max).toLocaleString("en-NZ")} new
              </span>
            </span>
            {catPts.est > 0 && (
              <span className="mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                incl. ${Math.round(catPts.est).toLocaleString("en-NZ")} estimated
              </span>
            )}
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

          {/* THE WHOLE ROOM, as one job.
              Every line below prices one component — cabinetry, or the shower,
              or the benchtop. Nobody renovating a 1975 bathroom replaces the
              vanity and leaves the waterproofing, and adding the individual
              lines up is not the number a builder quotes: a full refit strips
              back to the framing, reworks the plumbing and re-waterproofs, and
              shares one lot of labour and one lot of making good.
              Offered, never pre-ticked — gutting a room is the reader's call. */}
          {roomKey && renoControls?.has(roomKey) && (
            <label
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer"
              style={{
                background: renoControls.included(roomKey) ? "var(--accent-wash)" : "var(--surface-2)",
                border: `1px solid ${renoControls.included(roomKey) ? "var(--brand)" : "var(--border)"}`,
              }}
            >
              <input
                type="checkbox"
                checked={renoControls.included(roomKey)}
                onChange={(e) => renoControls.toggle(roomKey, e.target.checked)}
                className="cursor-pointer"
              />
              <span className="text-sm min-w-0" style={{ color: "var(--text-primary)" }}>
                <strong>Replace the whole {category.name.toLowerCase()}</strong>
                <span className="block text-xs" style={{ color: "var(--text-secondary)" }}>
                  A full strip-out and rebuild instead of the individual items below — tick this OR the separate lines,
                  not both.
                </span>
              </span>
            </label>
          )}

          {category.subItems.map((item) => (
            <SubItemCard key={item.id} item={item} region={region} floorSqm={floorSqm} persona={persona} renoControls={renoControls} onOpenRenovations={onOpenRenovations} value={itemValues?.get(item.id) ?? null} valuation={itemValuations?.get(item.id) ?? null} estimate={estimates?.get(item.id) ?? null} unseenEstimate={estimates?.get(`${item.id}:unseen`) ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}
