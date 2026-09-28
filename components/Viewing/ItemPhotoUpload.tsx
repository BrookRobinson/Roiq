"use client";

// ============================================================
// "Photograph it and we'll assess it properly."
//
// The report couldn't score this item because the listing never showed it. The
// checklist's other two answers — found it, couldn't reach it — are the buyer's
// own judgement, which the report has to attribute to them. A photograph is
// different: it goes back through the same vision analysis the rest of the
// report came from, and the item stops being a gap and becomes a scored finding
// with evidence behind it.
//
// The refusal path matters as much as the success path. If the photos don't
// show the item, the model says so, nothing is scored, and the buyer is asked
// for another shot — rather than a confident number being read off whatever was
// in the frame.
// ============================================================

import { useRef, useState } from "react";
import { Camera, Check, Loader2, RefreshCw, X } from "lucide-react";

import { resizePhoto } from "@/lib/ui/photo-resize";
import type { ItemPhotoAnalysis } from "@/lib/viewing/photo-types";

const MAX_PHOTOS = 6;

/**
 * The catalog's labels carry parentheticals written for the scoring model —
 * "Waterproofing (inferred)", "Insulation (visible / inferred)". Asking someone
 * to photograph an inference is nonsense; they photograph the thing.
 */
const plainLabel = (label: string) => label.replace(/\s*\([^)]*\)\s*$/, "").trim();

export interface PhotoContext {
  buildYear?: number | null;
  floorAreaSqm?: number | null;
  propertyType?: string | null;
}

export function ItemPhotoUpload({
  itemId,
  label,
  priorSummary,
  context,
  analysis,
  onAnalysed,
  onCleared,
  rooms,
}: {
  /** Rooms this item is read in. When set, the buyer says which one the photo is of. */
  rooms?: string[];
  itemId: string;
  label: string;
  priorSummary?: string;
  context: PhotoContext;
  /** A previous successful assessment for this item, if there is one. */
  analysis?: ItemPhotoAnalysis;
  onAnalysed: (analysis: ItemPhotoAnalysis) => void;
  onCleared: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A run that came back "these don't show it" — shown, never stored. */
  const [notShown, setNotShown] = useState<string | null>(null);
  // An item read room by room is valued room by room, so a photo of it must
  // say which room — otherwise it would re-score every bathroom at once.
  const [room, setRoom] = useState<string>("");
  const needsRoom = (rooms?.length ?? 0) > 0;

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    setNotShown(null);
    try {
      const chosen = Array.from(files).slice(0, MAX_PHOTOS);
      const photos = await Promise.all(chosen.map(resizePhoto));

      const res = await fetch("/api/item-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          photos: photos.map((p) => ({ base64: p.base64, mediaType: p.mediaType })),
          buildYear: context.buildYear ?? null,
          floorAreaSqm: context.floorAreaSqm ?? null,
          propertyType: context.propertyType ?? null,
          priorSummary: priorSummary ?? null,
        }),
      });
      const j = await res.json().catch(() => null);

      if (!res.ok || !j?.ok) {
        setError(j?.message ?? "Couldn't analyse those photos. Try again.");
        return;
      }

      const result = j.analysis as ItemPhotoAnalysis;
      if (!result.showsItem) {
        // Deliberately not stored. A gap is a better outcome than a score read
        // off the wrong thing, and the buyer is standing there — they can retake it.
        setNotShown(result.summary || `Those photos don't clearly show the ${plainLabel(label).toLowerCase()}.`);
        return;
      }
      onAnalysed(needsRoom ? { ...result, room } : result);
    } catch {
      setError("Couldn't read those photos on this device.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  if (analysis) {
    return (
      <div
        className="mt-3 rounded-xl p-3 no-print"
        style={{ border: "1px solid var(--good)", background: "var(--surface-2)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Check size={14} style={{ color: "var(--good)", flexShrink: 0, marginTop: 2 }} />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                Assessed from your {analysis.photoCount === 1 ? "photo" : `${analysis.photoCount} photos`}{analysis.room ? ` of the ${analysis.room.toLowerCase()}` : ""}
                {analysis.score != null ? ` — ${analysis.score}/10` : ""}
              </div>
              <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>
                {analysis.summary}
              </p>
              {analysis.observedDefect && (
                <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-primary)", lineHeight: 1.55 }}>
                  {analysis.observedDefect}
                </p>
              )}
              {/* Shown verbatim, and shown at all, because it is the one part of
                  this the reader can check for themselves: they are holding the
                  photograph of the plate. An age is a conclusion; "Rheem 135L,
                  ser. 0923" is evidence. */}
              {analysis.dataPlate && (
                <p
                  className="mono mt-1.5 rounded px-2 py-1 text-[12px]"
                  style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                >
                  Read off the plate: {analysis.dataPlate}
                </p>
              )}
              {analysis.estimatedAge && analysis.estimatedAge !== "—" && (
                <p className="mt-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Age: {analysis.estimatedAge}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onCleared}
            className="flex items-center gap-1 whitespace-nowrap text-[12px]"
            style={{ color: "var(--text-muted)" }}
            title="Remove this assessment and go back to the checklist question"
          >
            <X size={11} /> Remove
          </button>
        </div>
        <button
          onClick={() => input.current?.click()}
          className="mt-2 flex items-center gap-1.5 text-[12px] font-medium"
          style={{ color: "var(--brand)" }}
        >
          <RefreshCw size={11} /> Replace with better photos
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>
    );
  }

  return (
    <div className="mt-3 no-print">
      {needsRoom && (
        <label className="mb-2 flex items-center gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Which room is it in?
          <select value={room} onChange={(e) => setRoom(e.target.value)} className="input py-1 text-[13px]" style={{ maxWidth: 200 }}>
            <option value="">Choose…</option>
            {rooms!.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
      )}
      <button
        onClick={() => input.current?.click()}
        disabled={busy || (needsRoom && !room)}
        className="btn-secondary gap-2 px-3.5 py-2 text-[13px]"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
        {busy ? "Reading your photos…" : `Take a photo of the ${plainLabel(label).toLowerCase()}`}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />

      <p className="mt-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
        Up to {MAX_PHOTOS} photos. They go through the same analysis as the rest of the report, so this
        item gets a real score instead of staying a gap — and the report can then say it was seen.
      </p>

      {notShown && (
        <p className="mt-2 text-[13px]" style={{ color: "var(--warn)" }}>
          {notShown} Nothing has been scored — take another and we&rsquo;ll look again.
        </p>
      )}
      {error && (
        <p className="mt-2 text-[13px]" style={{ color: "var(--bad)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
