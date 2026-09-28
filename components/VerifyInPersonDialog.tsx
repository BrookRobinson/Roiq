"use client";

// ============================================================
// "Get this report verified in person" — a DEMO.
//
// Shows what the service will be: a partner building inspector checks the
// property with the report in hand. Nothing is sent or saved, and no one's
// details are asked for — a form that collected them and went nowhere would be
// promising a callback that never comes.
// ============================================================

import { X, HardHat, Check } from "lucide-react";
import type { StoredReport } from "@/lib/report-store";

const STEPS = [
  "We pass this report to a qualified building inspector who covers the area.",
  "They check the things photos can't: under the floor, in the roof space, moisture readings.",
  "You get their findings beside this report, before you commit to a price.",
];

export function VerifyInPersonDialog({ report, onClose }: { report: StoredReport; onClose: () => void }) {
  const address = report.listing.address ?? "this property";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Get this report verified in person"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <HardHat size={16} style={{ color: "var(--brand)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Get this report verified in person</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:opacity-70" style={{ color: "var(--text-muted)" }} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <span
            className="inline-block text-[11px] font-semibold uppercase tracking-wide rounded-full px-2.5 py-1 mb-3"
            style={{ background: "var(--surface-2)", color: "var(--brand)", border: "1px solid var(--border)" }}
          >
            Coming soon
          </span>

          <p className="text-xs mb-4" style={{ color: "var(--text-muted)", lineHeight: 1.55 }}>
            A qualified building inspector checks <span style={{ color: "var(--text-secondary)" }}>{address}</span> in
            person, with this report in hand.
          </p>

          <ul className="mb-4 space-y-2">
            {STEPS.map((s) => (
              <li key={s} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                <Check size={14} className="mt-0.5 shrink-0" style={{ color: "var(--brand)" }} />
                <span>{s}</span>
              </li>
            ))}
          </ul>

          <p className="text-[11px] mb-4 rounded-lg px-3 py-2" style={{ background: "var(--surface-2)", color: "var(--text-muted)", lineHeight: 1.5 }}>
            We're lining up inspectors around the country. Nothing has been sent, and you haven't been charged.
          </p>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
            style={{ background: "var(--brand)", color: "var(--on-accent)" }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
