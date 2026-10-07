"use client";

// ============================================================
// "Some of these photos look digitally edited."
//
// Shown at the top of a report when the analysis flagged listing photos as
// virtually staged, rendered, retouched or with a sky or lawn dropped in. The
// rules for what a flag does to a score are in lib/ai/edited-photos.ts; this
// only tells the reader what was flagged, what it changed, and what to do.
//
// Two things the copy must keep saying. A "possible" flag changed NOTHING, so
// it is listed apart from the ones that did. And no flag is not an all-clear:
// a good edit is built to be invisible, and the notice says we can't catch
// every one rather than letting silence read as "these photos are genuine".
// ============================================================

import { useState } from "react";
import { ChevronDown, ChevronUp, ImageOff } from "lucide-react";
import { EDIT_KIND_LABEL, type EditedPhoto } from "@/lib/ai/edited-photos";
import type { SubItem } from "@/lib/property-tab/types";
import { ITEM_BY_ID } from "@/lib/scoring/catalog";
import { alpha } from "@/lib/ui/color";

export function EditedPhotosNotice({ edited, subItems }: { edited: EditedPhoto[]; subItems: SubItem[] }) {
  const [open, setOpen] = useState(false);
  if (edited.length === 0) return null;

  const likely = edited.filter((e) => e.confidence === "likely");
  const possible = edited.filter((e) => e.confidence === "possible");
  const likelySet = new Set(likely.map((e) => e.photo));

  // The items whose reading leans on a likely-edited photo, so the reader knows
  // which rooms to look at rather than only which photo numbers.
  const affected = subItems
    // The foundation is scored from type, era and symptoms, not from a picture,
    // so the rules never touch it and it isn't listed here.
    .filter((s) => ITEM_BY_ID[s.id]?.inspection === "improvements" && s.id !== "ext_foundation" && s.photoReferences?.some((n) => likelySet.has(n)))
    .map((s) => {
      const category = ITEM_BY_ID[s.id]?.category;
      return category ? `${category}: ${s.name}` : s.name;
    });

  const strong = likely.length > 0;
  const tone = strong ? "var(--warn)" : "var(--text-secondary)";
  const n = strong ? likely.length : possible.length;
  const headline = strong
    ? `${n} listing photo${n === 1 ? " looks" : "s look"} digitally edited`
    : `${n} listing photo${n === 1 ? "" : "s"} might be digitally edited`;

  return (
    <div
      className="rounded-xl overflow-hidden mb-4"
      style={{ border: `1px solid ${alpha(tone, 35)}`, background: alpha(tone, 8) }}
    >
      <button className="w-full flex items-center justify-between gap-3 px-4 py-3 cursor-pointer text-left" onClick={() => setOpen(!open)}>
        <span className="flex items-start gap-2.5">
          <ImageOff size={15} style={{ color: tone, flexShrink: 0, marginTop: 2 }} />
          <span>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{headline}</span>
            <span className="block text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {strong
                ? "We've treated them as weaker evidence. Check these rooms in person."
                : "We weren't sure enough to change anything. Worth a look at the viewing."}
            </span>
          </span>
        </span>
        {open ? <ChevronUp size={14} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
      </button>

      {open && (
        <div className="px-4 pb-4 text-xs" style={{ borderTop: `1px solid ${alpha(tone, 25)}`, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          {strong && (
            <>
              <ul className="pt-3 space-y-1.5">
                {likely.map((e) => <PhotoLine key={e.photo} e={e} />)}
              </ul>
              {affected.length > 0 && (
                <p className="mt-3">
                  <strong style={{ color: "var(--text-primary)" }}>Items read from these photos:</strong>{" "}
                  {affected.join(", ")}. An item that also appears in an untouched photo keeps its
                  score. One that appears only in an edited photo is marked probable and held below
                  top marks, and anything shown only in a render isn&apos;t scored.
                </p>
              )}
            </>
          )}
          {possible.length > 0 && (
            <>
              <p className="mt-3 font-semibold" style={{ color: "var(--text-primary)" }}>
                {strong ? "Might also be edited (nothing changed for these)" : "What we noticed"}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {possible.map((e) => <PhotoLine key={e.photo} e={e} />)}
              </ul>
            </>
          )}
          <p className="mt-3" style={{ color: "var(--text-muted)" }}>
            We can&apos;t catch every edit: a good one is made to be invisible. Photos you take at the
            viewing replace the listing&apos;s for any item you photograph.
          </p>
        </div>
      )}
    </div>
  );
}

function PhotoLine({ e }: { e: EditedPhoto }) {
  return (
    <li>
      <strong style={{ color: "var(--text-primary)" }}>Photo {e.photo}</strong>
      <span style={{ color: "var(--text-primary)" }}> · {EDIT_KIND_LABEL[e.kind]}</span>
      {e.evidence && <span>: {e.evidence}</span>}
    </li>
  );
}
