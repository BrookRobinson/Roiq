"use client";

import type { UrgencyScore } from "@/lib/property-tab/types";
import { alpha } from "@/lib/ui/color";

// Condition score badge for the Improvements tab — JUST the number + colour, no
// words (no "Fair / Average / Good", no "plan replacement within X years").
// Bands per spec: 1–3 red, 4–6 orange, 7–10 green. The score still drives reno
// urgency, the value verdict and the hidden quality score internally; this is
// purely a clean read on current condition.

const RED = "var(--bad)";
const ORANGE = "var(--warn)";
const GREEN = "var(--good)";

/** Hex accent for a condition score (used for the badge and the card's left border). */
export function conditionScoreColor(score: UrgencyScore | null): string {
  if (score === null) return "var(--text-muted)"; // muted teal — not assessed
  if (score >= 7) return GREEN;
  if (score >= 4) return ORANGE;
  return RED;
}

export function ConditionScore({ score, size = "md" }: { score: UrgencyScore | null; size?: "sm" | "md" }) {
  const isSmall = size === "sm";
  const pad = isSmall ? "3px 10px" : "5px 14px";

  if (score === null) {
    return (
      <span
        className="inline-flex items-center rounded-lg font-medium"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)", padding: pad, fontSize: isSmall ? 11 : 12 }}
      >
        Not assessed
      </span>
    );
  }

  const c = conditionScoreColor(score);
  return (
    <span
      className="inline-flex items-center rounded-lg font-bold tabular-nums"
      style={{
        background: `${alpha(c, 12)}`,
        border: `1px solid ${alpha(c, 33)}`,
        color: c,
        fontFamily: "Fira Code, monospace",
        padding: pad,
        fontSize: isSmall ? 13 : 15,
      }}
      aria-label={`Condition score ${score} out of 10`}
    >
      {score}/10
    </span>
  );
}
