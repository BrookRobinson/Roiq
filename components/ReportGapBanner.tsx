"use client";

import { useState } from "react";
import type { ReportGap } from "@/lib/property-tab/gaps";
import { ClipboardList, ChevronDown, ChevronUp, Upload, FileText } from "lucide-react";

export function ReportGapBanner({ gaps }: { gaps: ReportGap[] }) {
  const [expanded, setExpanded] = useState(false);
  const open = gaps.filter((g) => !g.resolved);
  if (open.length === 0) return null;

  return (
    <div
      className="rounded-xl overflow-hidden mb-4"
      style={{
        border: "1px solid rgba(0,212,200,0.2)",
        background: "rgba(0,212,200,0.04)",
      }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <ClipboardList size={15} style={{ color: "var(--brand)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--brand)" }}>
            This report has {open.length} information gap{open.length > 1 ? "s" : ""}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--brand-light)", color: "var(--brand)" }}>
            Request missing info →
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={14} style={{ color: "var(--brand)" }} />
        ) : (
          <ChevronDown size={14} style={{ color: "var(--brand)" }} />
        )}
      </button>

      {/* Expanded gap list */}
      {expanded && (
        <div
          className="px-4 pb-4 space-y-2"
          style={{ borderTop: "1px solid rgba(0,212,200,0.15)" }}
        >
          <div className="pt-3 space-y-1.5">
            {open.map((gap) => (
              <div key={gap.id} className="flex items-start gap-2.5 text-sm">
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: "var(--brand)" }}
                />
                <div>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                    {gap.label}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}> — {gap.description}</span>
                  {gap.inAgentLetter && (
                    <span className="ml-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      (agent letter)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              className="btn-primary text-xs py-1.5 px-3 gap-1.5"
              onClick={() => window.print()}
            >
              <FileText size={12} />
              Generate agent letter PDF
            </button>
            <button
              className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
            >
              <Upload size={12} />
              Upload missing photos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
