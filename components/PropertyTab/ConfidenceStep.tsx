"use client";

// ============================================================
// Step 2 of an item's drop-down: how sure we are, and beside it, whether any
// photo the reading came from looks digitally altered.
//
// Confidence used to be a chip beside the value on the card's face. It is in
// the drop-down now, straight after the photographs it is a statement about,
// and the edited-photo flag sits on the same line because it answers the same
// question: how far can this reading be trusted.
//
// The flag has three honest states and they must stay distinct. A report made
// before edited photos were checked has no list at all, so it shows NOTHING —
// "none flagged" there would claim a check nobody ran. A checked report with
// no hit says so. And a "possible" flag is drawn muted, because it changed no
// score (lib/ai/edited-photos.ts).
// ============================================================

import { createContext, useContext } from "react";
import { ImageOff } from "lucide-react";
import type { ConfidenceTier } from "@/lib/property-tab/types";
import { EDIT_KIND_LABEL, type EditedPhoto } from "@/lib/ai/edited-photos";
import { alpha } from "@/lib/ui/color";
import { confidenceMeta } from "./ConfidenceBar";

/** The report's flagged photos. Undefined = this report was never checked. */
const EditedPhotosContext = createContext<EditedPhoto[] | undefined>(undefined);
export const EditedPhotosProvider = EditedPhotosContext.Provider;

export function ConfidenceStep({ tier, photoRefs, fromBuyer }: {
  tier: ConfidenceTier;
  /** The listing photos this reading came from. */
  photoRefs: number[];
  /** Read from the buyer's own photograph, which nobody edited. */
  fromBuyer?: boolean;
}) {
  const edited = useContext(EditedPhotosContext);
  const cfg = confidenceMeta(tier);
  const [, why] = cfg.full.split(" — ");
  const hits = fromBuyer || !edited ? [] : edited.filter((e) => photoRefs.includes(e.photo));

  return (
    <div className="flex items-start justify-between gap-x-4 gap-y-1.5 flex-wrap">
      <div className="text-[13px]">
        <span className="font-semibold" style={{ color: cfg.color }}>{cfg.short}</span>
        {why && <span style={{ color: "var(--text-secondary)" }}> · {why}</span>}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {hits.map((e) => {
          const likely = e.confidence === "likely";
          const tone = likely ? "var(--warn)" : "var(--text-muted)";
          return (
            <span
              key={e.photo}
              title={e.evidence || undefined}
              className="inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-2 py-0.5 whitespace-nowrap"
              style={{ background: alpha(tone, 12), border: `1px solid ${alpha(tone, 35)}`, color: likely ? "var(--text-primary)" : "var(--text-secondary)" }}
            >
              <ImageOff size={11} style={{ color: tone }} />
              Photo {e.photo} · {likely ? "" : "possibly "}{likely ? EDIT_KIND_LABEL[e.kind] : EDIT_KIND_LABEL[e.kind].toLowerCase()}
            </span>
          );
        })}
        {edited && !fromBuyer && hits.length === 0 && photoRefs.length > 0 && (
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>No photo edits flagged</span>
        )}
      </div>
    </div>
  );
}
