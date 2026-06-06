"use client";

import { Search, Upload } from "lucide-react";
import type { ReportGap } from "@/lib/property-tab/gaps";

export function GapCard({ gap }: { gap: ReportGap }) {
  return (
    <div
      className="rounded-xl p-4 flex items-start gap-3"
      style={{
        border: "1px dashed var(--border)",
        background: "var(--surface-2)",
      }}
    >
      <Search size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
      <div className="flex-1">
        <div className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-secondary)" }}>
          {gap.label} — not visible in photos
        </div>
        <div className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          {gap.description}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--brand-light)", color: "var(--brand)" }}
          >
            Included in agent information request
          </span>
          <button
            className="flex items-center gap-1 text-xs cursor-pointer"
            style={{ color: "var(--brand)" }}
          >
            <Upload size={10} />
            Upload photo
          </button>
        </div>
      </div>
    </div>
  );
}

export function GapSummary({ gaps }: { gaps: ReportGap[] }) {
  const open = gaps.filter((g) => !g.resolved);
  if (open.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-5"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <h3 className="font-semibold mb-3 text-sm" style={{ color: "var(--text-primary)" }}>
        Information gaps ({open.length})
      </h3>
      <div
        className="h-px mb-4"
        style={{ background: "var(--border)" }}
      />
      <div className="space-y-2 mb-4">
        {open.map((g) => (
          <div key={g.id} className="flex items-start gap-2 text-xs">
            <div
              className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
              style={{ background: "var(--text-muted)" }}
            />
            <div style={{ color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--text-primary)" }}>{g.label}</strong> — {g.description}{" "}
              {g.inAgentLetter && (
                <span style={{ color: "var(--text-muted)" }}>
                  Included in agent request.
                </span>
              )}
              {g.inLimLetter && (
                <span style={{ color: "var(--text-muted)" }}>
                  {" "}Included in LIM request.
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary text-xs py-1.5 px-3">
          Generate agent letter PDF
        </button>
        <button className="btn-secondary text-xs py-1.5 px-3">
          Generate LIM request PDF
        </button>
      </div>
    </div>
  );
}
