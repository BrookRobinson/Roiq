"use client";

// ============================================================
// What a free report doesn't show.
//
// The free report runs the full analysis — every photo read, every defect
// found — because seeing the vision analysis land on your own listing is the
// thing that sells the product. What it withholds is the conclusion: the score
// out of 1,000 and anything that values the property.
//
// Blurred rather than absent, deliberately. An empty space says the feature
// doesn't exist; a blurred number says it's been worked out and is waiting.
// The map pins do the same thing for the same reason.
// ============================================================

import { Lock } from "lucide-react";
import Link from "next/link";

/**
 * A real value, rendered unreadable.
 *
 * The genuine content stays in the DOM under a blur — it has to, or the layout
 * collapses and the page reflows when someone upgrades. That means it is NOT a
 * security boundary: anything truly confidential must never reach the client.
 * These are the reader's OWN report's numbers, computed in their own browser
 * from data they were given, so there is nothing here to protect from them —
 * only a purchase to prompt.
 */
export function BlurredValue({
  children,
  amount = 8,
  label = "Upgrade to see",
}: {
  children: React.ReactNode;
  amount?: number;
  label?: string;
}) {
  return (
    <span className="relative inline-flex items-center" title={label}>
      <span
        aria-hidden="true"
        style={{ filter: `blur(${amount}px)`, opacity: 0.55, userSelect: "none", pointerEvents: "none" }}
      >
        {children}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * The prompt that sits beside a blurred figure.
 *
 * Says what is behind it and what it costs, in that order. "Upgrade" on its own
 * asks someone to pay for a surprise.
 */
export function UpgradeNote({
  what,
  compact = false,
}: {
  /** What's hidden, in the reader's words — "your score", "the valuation". */
  what: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl ${compact ? "px-3 py-2" : "px-4 py-3"}`}
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      <Lock size={compact ? 13 : 15} style={{ color: "var(--brand)", flexShrink: 0 }} />
      <span className={compact ? "text-xs" : "text-sm"} style={{ color: "var(--text-secondary)" }}>
        {what} needs a paid plan.{" "}
        <Link href="/pricing?plan=starter" className="font-semibold hover:underline" style={{ color: "var(--brand)" }}>
          See plans
        </Link>
      </span>
    </div>
  );
}

/**
 * A whole tab a free report can't open.
 *
 * Lists what's inside rather than just refusing — someone deciding whether to
 * pay needs to know what they'd be paying for.
 */
export function LockedTab({
  title,
  blurb,
  includes,
}: {
  title: string;
  blurb: string;
  includes: string[];
}) {
  return (
    <div className="max-w-lg mx-auto text-center py-14 px-6">
      <div
        className="w-12 h-12 rounded-2xl mx-auto mb-5 flex items-center justify-center"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <Lock size={20} style={{ color: "var(--brand)" }} />
      </div>

      <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>{title}</h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>{blurb}</p>

      <ul className="text-left inline-block space-y-2 mb-7">
        {includes.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--brand)", lineHeight: 1.5 }}>—</span>
            {item}
          </li>
        ))}
      </ul>

      <div>
        <Link href="/pricing?plan=starter" className="btn-primary px-6 py-3 text-[15px] inline-flex">
          See plans
        </Link>
      </div>
      <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
        Your analysis is already done and saved — upgrading opens it, nothing is re-run.
      </p>
    </div>
  );
}
