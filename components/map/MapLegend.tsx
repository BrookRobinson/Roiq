"use client";

import type { MapMode } from "@/lib/map/types";

// One line, three items — no paragraph text (per spec).
const ITEMS: Record<MapMode, Array<[string, string, string]>> = {
  homebuyer: [
    ["#00e676", "+15%", "Underpriced"],
    ["#fbbf24", "±15%", "Fair price"],
    ["#ff5f5f", "−15%", "Overpriced"],
  ],
  investor: [
    ["#00e676", "+15%", "Strong return"],
    ["#fbbf24", "±15%", "Moderate"],
    ["#ff5f5f", "−15%", "Poor return"],
  ],
};

export function MapLegend({ mode, seeded }: { mode: MapMode; seeded?: boolean }) {
  return (
    <div
      className="flex items-center gap-5 px-4 py-2 border-b overflow-x-auto"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {ITEMS[mode].map(([c, pct, label]) => (
        <div key={label} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c, boxShadow: `0 0 8px ${c}88` }} />
          <span className="text-xs font-bold mono" style={{ color: c }}>{pct}</span>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
        </div>
      ))}

      {/* The map fills up from reports people run, so until one has been run these
          pins are a demo set. Say so — a sample property that reads as a real find
          is worse than an empty map. */}
      {seeded && (
        <span className="text-xs ml-auto whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
          Sample properties — run a report to add a real one
        </span>
      )}
    </div>
  );
}
