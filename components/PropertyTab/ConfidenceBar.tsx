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
// So it sits under the score, inside the same badge: ONE bar, rising from the
// bottom of the box, with the level NAMED underneath it. A taller bar means
// more confidence — the reading a column chart gets for free — and the words
// carry it for anyone the colour doesn't reach. Roughly one man in twelve is
// red-green colourblind, so the height and the label both work on their own.
//
// ── This is confidence, NOT condition ───────────────────────────────────────
//
// The score directly above is already coloured by how the item RATES, so two
// colour systems sit in the same badge and they must not be confusable. A red
// bar does not mean a bad roof; it means we could not see the roof. That is why
// the level is spelled out in words rather than left to the colour, and why the
// tier text stays on the card as well.
// ============================================================

const TIERS: Record<ConfidenceTier, { pct: number; color: string; short: string; full: string }> = {
  1: {
    pct: 100,
    color: "var(--good)",
    short: "High confidence",
    full: "High confidence — established from a photograph or the public record",
  },
  2: {
    pct: 62,
    color: "var(--warn)",
    short: "Medium confidence",
    full: "Medium confidence — probable, worth verifying at the inspection",
  },
  3: {
    // Deliberately not zero. The item was still reasoned about — from a build
    // era, a material, a type — and an empty track would read as "no answer"
    // rather than "an answer we can't stand behind".
    pct: 32,
    color: "var(--bad)",
    short: "Low confidence",
    full: "Low confidence — not visible in the photographs, inferred rather than seen",
  },
};

export function confidenceMeta(tier: ConfidenceTier) {
  return TIERS[tier];
}

/** The bar itself. Sits INSIDE the score badge, rising from just above its floor. */
export function ConfidenceBar({ tier, height = 24 }: { tier: ConfidenceTier; height?: number }) {
  const cfg = TIERS[tier];
  return (
    // ONE bar, and no track behind it. A track would draw a second bar of its
    // own, and the comparison that matters is between cards — a column chart
    // reads that way without a scale drawn behind every column. The wrapper
    // still reserves the full height so the badge doesn't change size between
    // tiers and the bars all rise from the same line.
    <div
      title={cfg.full}
      role="img"
      aria-label={cfg.full}
      style={{ width: 5, height, display: "flex", alignItems: "flex-end" }}
    >
      <div
        style={{
          width: "100%",
          height: `${cfg.pct}%`,
          background: cfg.color,
          borderRadius: "2px 2px 1px 1px",
        }}
      />
    </div>
  );
}

/** The words under the bar. Outside the badge, directly beneath it. */
export function ConfidenceLabel({ tier }: { tier: ConfidenceTier }) {
  const cfg = TIERS[tier];
  return (
    <span
      title={cfg.full}
      className="text-center leading-tight"
      style={{ fontSize: 8.5, marginTop: 3, color: cfg.color, fontWeight: 600, maxWidth: 54 }}
    >
      {cfg.short}
    </span>
  );
}
