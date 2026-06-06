"use client";

import type { UrgencyScore } from "@/lib/property-tab/types";
import { urgencyColor } from "@/lib/property-tab/types";

interface Props {
  score: UrgencyScore | null;
  label: string;
  size?: "sm" | "md";
}

const colorStyles = {
  green: {
    bg: "rgba(0,230,118,0.1)",
    border: "rgba(0,230,118,0.25)",
    text: "#00e676",
  },
  amber: {
    bg: "rgba(251,191,36,0.1)",
    border: "rgba(251,191,36,0.25)",
    text: "#fbbf24",
  },
  red: {
    bg: "rgba(255,95,95,0.1)",
    border: "rgba(255,95,95,0.25)",
    text: "#ff5f5f",
  },
  muted: {
    bg: "var(--surface-2)",
    border: "var(--border)",
    text: "var(--text-muted)",
  },
};

export function UrgencyBadge({ score, label, size = "md" }: Props) {
  const colorKey = urgencyColor(score);
  const styles = colorStyles[colorKey];
  const isSmall = size === "sm";

  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg font-medium"
      style={{
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        padding: isSmall ? "3px 8px" : "5px 12px",
        fontSize: isSmall ? 11 : 12,
      }}
    >
      {score !== null && (
        <span
          className="font-bold tabular-nums"
          style={{
            color: styles.text,
            fontFamily: "Fira Code, monospace",
            fontSize: isSmall ? 12 : 14,
          }}
        >
          {score}/10
        </span>
      )}
      <span style={{ color: styles.text }}>{label}</span>
    </div>
  );
}
