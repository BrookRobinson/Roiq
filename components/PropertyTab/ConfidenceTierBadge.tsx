"use client";

import type { ConfidenceTier } from "@/lib/property-tab/types";

const tierConfig: Record<
  ConfidenceTier,
  { label: string; dotColor: string; textColor: string; bg: string; border: string }
> = {
  1: {
    label: "Confirmed from photo",
    dotColor: "var(--good)",
    textColor: "var(--good)",
    bg: "var(--good-wash)",
    border: "var(--good-wash)",
  },
  2: {
    label: "Probable — verify at inspection",
    dotColor: "var(--warn)",
    textColor: "var(--warn)",
    bg: "var(--warn-wash)",
    border: "var(--warn-wash)",
  },
  3: {
    label: "Not visible — inferred",
    dotColor: "var(--text-muted)",
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
