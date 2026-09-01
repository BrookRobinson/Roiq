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
    // Red, matching the confidence meter under the score. It was grey, which
    // read as "minor" next to an amber T2 — but "we could not see this at all"
    // is the LEAST reliable thing on the card, not the most forgettable.
    //
    // Red here means low CONFIDENCE, never bad condition. The score badge beside
    // it already carries condition in its own colour, which is exactly why the
    // meter is a distinct shape and both carry a title.
    label: "Not visible — inferred",
    dotColor: "var(--bad)",
    textColor: "var(--bad)",
    bg: "var(--bad-wash)",
    border: "var(--bad-wash)",
  },
};

/**
 * Tier 1 means "established", and HOW it was established depends on the item.
 * A roof is confirmed from a photograph; a title, a zone or a rating valuation
 * is confirmed from a public record, and labelling that "Confirmed from photo"
 * is a small confident lie about where the fact came from — the title item was
 * printing it beside a LINZ record of title.
 */
const RECORD_SOURCED = /record of title|linz|council|district plan|rating|register|gns|moe|zone/i;

export function ConfidenceTierBadge({ tier, source }: { tier: ConfidenceTier; source?: string }) {
  const cfg = tierConfig[tier];
  const label =
    tier === 1 && source && RECORD_SOURCED.test(source) ? "Confirmed from the public record" : cfg.label;
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
      <span style={{ color: cfg.textColor }}>T{tier} — {label}</span>
    </div>
  );
}
