"use client";

import type { MapMode } from "@/lib/map/types";
import { alpha } from "@/lib/ui/color";

// One line — the three deal colours, plus grey for listings the nightly crawl
// found but nobody has analysed. Grey carries no percentage because there is no
// verdict behind it; the legend has to say so or a grey dot reads as a bad one.
const ITEMS: Record<MapMode, Array<[string, string, string]>> = {
  homebuyer: [
    ["#00e676", "+15%", "Underpriced"],
    ["#fbbf24", "±15%", "Fair price"],
    ["#ff5f5f", "−15%", "Overpriced"],
    // Grey covers both no-verdict states in this mode: nobody has analysed the
    // property, or we analysed it and had no suburb sales / no floor area to
    // value it from. The sheet says which. One swatch, because the reader's
    // question is the same either way — why has this pin got no number?
    ["#8b93a1", "", "No verdict yet"],
  ],
  investor: [
    ["#00e676", "+15%", "Strong return"],
    ["#fbbf24", "±15%", "Moderate"],
    ["#ff5f5f", "−15%", "Poor return"],
    ["#8b93a1", "", "Not analysed"],
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
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c, boxShadow: `0 0 8px ${alpha(c, 53)}` }} />
          {pct && <span className="text-xs font-bold mono" style={{ color: c }}>{pct}</span>}
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
        </div>
      ))}

      {/* The map fills up from reports people run, so until one has been run these
          pins are a demo set. Say so — a sample property that reads as a real find
          is worse than an empty map. */}
      {seeded && (
        <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
          Sample properties — run a report to add a real one
        </span>
      )}

      {/* LINZ's address data is free and openly licensed; attribution is the
          condition attached to it, so it isn't optional. Mapbox carries its own
          credit on the canvas. Pushed right, and dropped on narrow screens
          where the legend itself needs the room. */}
      <span
        className="text-[10px] ml-auto pl-4 whitespace-nowrap hidden sm:inline"
        style={{ color: "var(--text-muted)" }}
      >
        Addresses{" "}
        <a
          href="https://data.linz.govt.nz/layer/123113-nz-addresses/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          © LINZ
        </a>{" "}
        CC BY 4.0
      </span>
    </div>
  );
}
