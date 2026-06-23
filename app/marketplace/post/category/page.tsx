"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TRADE_CATEGORIES } from "@/lib/marketplace/constants";
import { loadDraft, saveDraft } from "@/lib/marketplace/draft";
import { useRequireAccount } from "@/lib/account/useRequireAccount";

export default function CategoryPage() {
  const router = useRouter();
  const acctReady = useRequireAccount("/marketplace/post/category");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => { setSelected(loadDraft().category ?? null); }, []);

  function cont() {
    if (!selected) return;
    saveDraft({ category: selected });
    router.push("/marketplace/post/details");
  }

  if (!acctReady) return <div className="mp-container" />;

  return (
    <div className="mp-container">
      <Link href="/dashboard" className="mp-back">← Cancel</Link>
      <h1 className="mp-h1">What do you need done?</h1>
      <p className="mp-muted" style={{ marginTop: 6, marginBottom: 20 }}>
        Pick a trade. Verified, qualified tradesmen will see your job and come back with their own quotes.
      </p>

      <div className="mp-grid-2">
        {TRADE_CATEGORIES.map((c) => {
          const on = selected === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setSelected(on ? null : c.id)}
              className="mp-card mp-card-pad mp-card-hover"
              style={{ textAlign: "left", cursor: "pointer", borderColor: on ? "var(--mp-orange)" : "var(--mp-border)", boxShadow: on ? "0 0 0 2px var(--mp-orange-soft)" : "none" }}
            >
              <div style={{ fontSize: 28 }}>{c.emoji}</div>
              <div style={{ fontWeight: 700, marginTop: 6, color: "var(--mp-ink)" }}>{c.name}</div>
              <div className="mp-muted" style={{ fontSize: 13, marginTop: 2 }}>{c.blurb}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {c.requiredBodies.length > 0 && <span className="mp-badge mp-badge-grey">✓ Qualified only</span>}
                {c.hasVisualiser && <span className="mp-badge mp-badge-soft">🤖 AI preview</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
        <button className="mp-btn" disabled={!selected} onClick={cont}>Continue →</button>
      </div>
    </div>
  );
}
