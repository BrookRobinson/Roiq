"use client";

// ============================================================
// "The listing photos don't show…", and the aerial view read beside them.
//
// The listing's photos are the agent's choice. This panel shows the reader the
// two checks on that choice: what the photos avoid (lib/ai/photo-gaps.ts) and
// the LINZ aerial view of the section, the one picture nobody staged
// (lib/imagery/aerial-plan.ts). The aerial carries its CC BY credit wherever it
// is shown, because LINZ's licence asks for it.
// ============================================================

import { useState } from "react";
import { ChevronDown, ChevronUp, EyeOff } from "lucide-react";
import type { PhotoGap } from "@/lib/ai/photo-gaps";
import type { AerialPhoto } from "@/lib/imagery/aerial-plan";
import { IMAGERY_CREDIT } from "@/lib/imagery/source";

export function PhotoEvidenceNotice({ gaps, aerial }: { gaps: PhotoGap[]; aerial?: AerialPhoto }) {
  const [open, setOpen] = useState(false);
  if (gaps.length === 0 && !aerial) return null;

  const n = gaps.length;
  const headline = n > 0
    ? `The listing photos don't show ${n} thing${n === 1 ? "" : "s"} you'd expect to see`
    : "We also read an aerial view of the section";
  const sub = n > 0
    ? "Items they affect are marked probable, not confirmed. Check them at the viewing."
    : "The roof and everything on the section, from directly above.";

  return (
    <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}>
      <button className="w-full flex items-center justify-between gap-3 px-4 py-3 cursor-pointer text-left" onClick={() => setOpen(!open)}>
        <span className="flex items-start gap-2.5">
          <EyeOff size={15} style={{ color: "var(--text-secondary)", flexShrink: 0, marginTop: 2 }} />
          <span>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{headline}</span>
            <span className="block text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{sub}</span>
          </span>
        </span>
        {open ? <ChevronUp size={14} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
      </button>

      {open && (
        <div className="px-4 pb-4 text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--text-secondary)", lineHeight: 1.55 }}>
          {n > 0 && (
            <ul className="pt-3 space-y-1.5">
              {gaps.map((g) => (
                <li key={g.area}>
                  <strong style={{ color: "var(--text-primary)" }}>{g.area}</strong>: {g.missing}
                </li>
              ))}
            </ul>
          )}
          {aerial && (
            <div className="mt-3 flex gap-3 items-start flex-wrap">
              <a href={aerial.dataUrl} target="_blank" rel="noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={aerial.dataUrl}
                  alt="Aerial view of the section from directly above, with the surveyed boundary marked"
                  className="rounded-lg"
                  style={{ width: 168, height: 168, objectFit: "cover", border: "1px solid var(--border)" }}
                />
              </a>
              <div className="flex-1 min-w-[200px]">
                <p>
                  <strong style={{ color: "var(--text-primary)" }}>Aerial view (photo {aerial.number} in this report).</strong>{" "}
                  Read beside the listing photos: the roof and everything on the section, seen from directly above, which
                  a listing can't stage. The dashed yellow line is the surveyed boundary.
                </p>
                <p className="mt-1.5">
                  It may be a few years older than the listing, so where a recent listing photo shows newer work, the
                  listing photo wins.
                </p>
                <p className="mt-1.5" style={{ color: "var(--text-muted)" }}>{IMAGERY_CREDIT.linz}</p>
              </div>
            </div>
          )}
          {n > 0 && (
            <p className="mt-3" style={{ color: "var(--text-muted)" }}>
              Each of these is on your viewing checklist. A photo you take there replaces the guess.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
