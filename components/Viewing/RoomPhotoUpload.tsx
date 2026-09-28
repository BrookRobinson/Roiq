"use client";

// ============================================================
// "Photograph the room and we'll read everything in it."
//
// The room-level twin of ItemPhotoUpload. A bedroom the listing never showed
// is four items at once; one set of photographs is read for all of them, and
// each item is scored only if the photographs actually show it. What they
// don't show is named, so the buyer knows what to go back and shoot.
// ============================================================

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

import { resizePhoto } from "@/lib/ui/photo-resize";
import type { ItemPhotoAnalysis } from "@/lib/viewing/photo-types";
import type { UnseenRoom } from "@/lib/viewing/rooms";
import { ITEM_BY_ID } from "@/lib/scoring/catalog";
import type { PhotoContext } from "./ItemPhotoUpload";

const MAX_PHOTOS = 8;
const plain = (id: string) => (ITEM_BY_ID[id]?.label ?? id).replace(/\s*\([^)]*\)\s*$/, "").toLowerCase();

export function RoomPhotoUpload({
  room,
  context,
  onAnalysed,
}: {
  room: UnseenRoom;
  context: PhotoContext;
  /** Only the items the photographs showed; the line then leaves the list. */
  onAnalysed: (analyses: ItemPhotoAnalysis[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missed, setMissed] = useState<string[] | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    setMissed(null);
    try {
      const photos = await Promise.all(Array.from(files).slice(0, MAX_PHOTOS).map(resizePhoto));
      const res = await fetch("/api/room-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: room.kind,
          room: room.room,
          itemIds: room.itemIds,
          photos: photos.map((p) => ({ base64: p.base64, mediaType: p.mediaType })),
          buildYear: context.buildYear ?? null,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setError(j?.message ?? "Couldn't analyse those photos. Try again.");
        return;
      }
      const analyses = (j.analyses as ItemPhotoAnalysis[]) ?? [];
      const shown = analyses.filter((a) => a.showsItem);
      const notShown = analyses.filter((a) => !a.showsItem).map((a) => plain(a.itemId));
      if (shown.length === 0) {
        // Nothing stored: a gap beats a score read off the wrong room.
        setMissed(notShown);
        return;
      }
      if (notShown.length) setMissed(notShown);
      onAnalysed(shown);
    } catch {
      setError("Couldn't read those photos on this device.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="mt-3 no-print">
      <button onClick={() => input.current?.click()} disabled={busy} className="btn-secondary gap-2 px-3.5 py-2 text-[13px]">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
        {busy ? "Reading your photos…" : `Take photos of the ${room.room.toLowerCase()}`}
      </button>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <p className="mt-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
        Up to {MAX_PHOTOS} photos. Each item is scored for this room from what your photos show, replacing its estimate
        in the valuation.
      </p>
      {missed && missed.length > 0 && (
        <p className="mt-2 text-[13px]" style={{ color: "var(--warn)" }}>
          Your photos didn&rsquo;t clearly show the {missed.join(", ")}. {missed.length === 1 ? "It stays" : "They stay"} estimated —
          take another photo of {missed.length === 1 ? "it" : "them"} if you can.
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
