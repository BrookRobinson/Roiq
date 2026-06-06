"use client";

import type { ConfidenceTier } from "@/lib/property-tab/types";

const tierConfig: Record<
  ConfidenceTier,
  { label: string; dotColor: string; textColor: string; bg: string; border: string }
> = {
  1: {
    label: "Confirmed from photo",
    dotColor: "#00e676",
    textColor: "#00e676",
    bg: "rgba(0,230,118,0.08)",
    border: "rgba(0,230,118,0.2)",
  },
  2: {
    label: "Probable — verify at inspection",
    dotColor: "#fbbf24",
    textColor: "#fbbf24",
    bg: "rgba(251,191,36,0.08)",
    border: "rgba(251,191,36,0.2)",
  },
  3: {
    label: "Not visible — inferred",
    dotColor: "#3d7872",
    textColor: "var(--text-muted)",
    bg: "var(--surface-2)",
    border: "var(--border)",
  },
};

export function ConfidenceTierBadge({ tier }: { tier: ConfidenceTier }) {
  const cfg = tierConfig[tier];
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-md"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        padding: "3px 8px",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: cfg.dotColor }}
      />
      <span style={{ color: cfg.textColor }}>T{tier} — {cfg.label}</span>
    </div>
  );
}
