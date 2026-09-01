"use client";

import type { ConfidenceTier } from "@/lib/property-tab/types";

// ============================================================
// How much we actually know about this item, under the score it produced.
//
// The tier was a text badge further down the card — "T2 — Probable, verify at
// inspection" — sitting well away from the number it qualifies. A reader takes
// the number first and the caveat second, if at all, and a 7/10 read off a
// build era looked exactly as solid as a 7/10 read off a photograph.
//
// So it goes directly under the score, as a strength meter. THREE SEGMENTS,
// FILLING UPWARD: more filled means more confident, which needs no legend. The
// colour reinforces the same thing rather than carrying it alone — a bar that
// only used colour would say nothing to a red-green colourblind reader, and
// about 1 in 12 men are.
//
// ── This is confidence, NOT condition ───────────────────────────────────────
//
// The score badge beside it is already coloured by how the item RATES, so two
// colour systems sit next to each other and they must not be confusable. A red
// bar does not mean a bad roof; it means we could not see the roof. That is why
// the meter is a distinct shape, why it carries a title, and why the tier text
// stays on the card underneath it.
// ============================================================

const TIERS: Record<ConfidenceTier, { filled: number; color: string; label: string }> = {
  1: { filled: 3, color: "var(--good)", label: "High confidence — established from a photo or the public record" },
  2: { filled: 2, color: "var(--warn)", label: "Medium confidence — probable, worth verifying at the inspection" },
  3: { filled: 1, color: "var(--bad)", label: "Low confidence — not visible, inferred rather than seen" },
};

export function ConfidenceBar({ tier, className }: { tier: ConfidenceTier; className?: string }) {
  const cfg = TIERS[tier];
  return (
    <div
      className={`flex items-center gap-[2px] ${className ?? ""}`}
      title={cfg.label}
      role="img"
      aria-label={cfg.label}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 3,
            borderRadius: 1,
            display: "inline-block",
            // The unfilled segments stay visible so the meter reads as "one of
            // three" rather than as a single stub of colour.
            background: i < cfg.filled ? cfg.color : "var(--border)",
          }}
        />
      ))}
    </div>
  );
}
