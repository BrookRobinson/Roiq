// ============================================================
// Digitally edited listing photos — the rules, in one place.
//
// A listing photo is the vendor's evidence, and agents edit it: furniture that
// was never in the room, a stain painted out, a lawn or a sky dropped in, a
// kitchen that is only a render. The analysis used to believe every pixel, so
// an edited photo raised the valuation — the one direction a buyer's report
// must never be wrong in.
//
// Detection is NOT reliable and nothing here pretends otherwise: a good edit is
// built to be invisible. So the model reports what LOOKS edited (or what the
// listing itself admits to), and these rules make that photo weaker evidence
// rather than deciding what the room really looks like:
//
//   • an item shown ONLY in photos of something that may not exist (a render, a
//     "virtual renovation") is treated as not seen at all — no score;
//   • an item shown ONLY in otherwise-edited photos keeps its score but loses
//     its certainty and its top marks;
//   • an item that also appears in an untouched photo is left alone, and says so.
//
// Only a "likely" flag moves a score. A "possible" one is reported to the buyer
// and changes nothing: a wrong guess about editing must not cost a real house
// its marks.
//
// Pure, with no imports that need a bundler — scripts/verify-edited-photos.mjs
// loads this file directly.
// ============================================================

export type EditKind =
  | "virtual_staging"     // furniture / décor added to a real room
  | "virtual_renovation"  // surfaces, fittings or rooms shown as they COULD be
  | "render"              // artist's impression / CGI, not a photograph
  | "replaced_exterior"   // sky, lawn, planting or view swapped in
  | "retouched";          // marks, damage or clutter removed; heavy enhancement

export type EditConfidence = "likely" | "possible";

export interface EditedPhoto {
  /** 1-based, the number the report quotes everywhere else. */
  photo: number;
  kind: EditKind;
  confidence: EditConfidence;
  /** What gave it away, in the model's words — shown to the buyer. */
  evidence: string;
}

/** As the model returns it. Everything is optional because it is model output. */
export interface RawEditedPhoto {
  photo?: number;
  kind?: string;
  confidence?: string;
  evidence?: string;
}

const KINDS: EditKind[] = ["virtual_staging", "virtual_renovation", "render", "replaced_exterior", "retouched"];

/** The thing in the picture may not exist, so nothing in it counts as seen. */
const FABRICATING = new Set<EditKind>(["virtual_renovation", "render"]);

export const EDIT_KIND_LABEL: Record<EditKind, string> = {
  virtual_staging: "Virtually staged",
  virtual_renovation: "Virtual renovation",
  render: "Render, not a photo",
  replaced_exterior: "Sky, lawn or view replaced",
  retouched: "Retouched",
};

/** Clean the model's list: real photo numbers only, one entry per photo, worst kind wins. */
export function normEditedPhotos(raw: RawEditedPhoto[] | undefined, photoCount: number): EditedPhoto[] {
  if (!Array.isArray(raw)) return [];
  const byPhoto = new Map<number, EditedPhoto>();
  for (const r of raw) {
    const photo = r?.photo;
    if (typeof photo !== "number" || !Number.isInteger(photo) || photo < 1 || photo > photoCount) continue;
    const kind = KINDS.find((k) => k === r.kind);
    if (!kind) continue;
    const next: EditedPhoto = {
      photo,
      kind,
      confidence: r.confidence === "likely" ? "likely" : "possible",
      evidence: r.evidence?.trim() || "",
    };
    const prev = byPhoto.get(photo);
    if (!prev || rank(next) > rank(prev)) byPhoto.set(photo, next);
  }
  return [...byPhoto.values()].sort((a, b) => a.photo - b.photo);
}

const rank = (e: EditedPhoto): number =>
  (e.confidence === "likely" ? 2 : 0) + (FABRICATING.has(e.kind) ? 1 : 0);

/** The slice of a sub-item these rules read and write. */
export interface EditableItem {
  id: string;
  score: number | null;
  confidenceTier: 1 | 2 | 3;
  specTier?: string;
  aiSummary: string;
  evidenceSource: string;
  photoReferences?: number[];
}

/** Highest score an item may keep when every photo of it has been edited. */
export const EDITED_SCORE_CAP = 8;

export type EditEffect = "unseen" | "weakened" | "noted";

const list = (ns: number[]): string =>
  ns.length === 1
    ? `Photo ${ns[0]}`
    : `Photos ${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}`;

/**
 * Apply the rules to one item. Returns the item to use and what happened to it,
 * or null when no likely-edited photo touches it.
 *
 * Only call this for items assessed FROM listing photos — a land or title item
 * is measured or read from the register, and no edit to a photo changes it.
 */
export function applyEditedPhotos<T extends EditableItem>(
  item: T,
  edited: EditedPhoto[]
): { item: T; effect: EditEffect } | null {
  const refs = item.photoReferences ?? [];
  if (refs.length === 0 || item.score === null) return null;

  const likely = new Map(edited.filter((e) => e.confidence === "likely").map((e) => [e.photo, e]));
  const hit = refs.filter((n) => likely.has(n));
  if (hit.length === 0) return null;

  const allEdited = hit.length === refs.length;
  const allFabricated = allEdited && hit.every((n) => FABRICATING.has(likely.get(n)!.kind));
  const are = hit.length === 1 ? "looks" : "look";

  if (allFabricated) {
    return {
      effect: "unseen",
      item: {
        ...item,
        score: null,
        confidenceTier: 3,
        evidenceSource: "Shown only in digitally created images",
        aiSummary:
          `${list(hit)} ${are} like a render or virtual renovation, not a photograph of the house as it is, ` +
          `so this item is not assessed. Check it in person. ` +
          item.aiSummary,
      },
    };
  }

  if (allEdited) {
    return {
      effect: "weakened",
      item: {
        ...item,
        score: Math.min(item.score, EDITED_SCORE_CAP),
        confidenceTier: item.confidenceTier === 1 ? 2 : item.confidenceTier,
        specTier: item.specTier === "luxury" ? "modern" : item.specTier,
        aiSummary:
          `${list(hit)} ${are} digitally edited and no untouched photo shows this item, ` +
          `so it is marked probable and held below top marks. Check it in person. ` +
          item.aiSummary,
      },
    };
  }

  return {
    effect: "noted",
    item: {
      ...item,
      aiSummary:
        `${list(hit)} ${are} digitally edited; this reading leans on the other photos. ` + item.aiSummary,
    },
  };
}

/** One room's own read of an item (each bathroom, each bedroom). */
export interface EditableRoom {
  score: number | null;
  specTier?: string;
  photoReferences: number[];
}

/**
 * The same rules for a single room's read, which is valued on its own score.
 * A room shown only in a render becomes a room nobody saw (score null), which
 * the valuation then estimates from the rest of the house like any unseen room.
 */
export function applyEditedPhotosToRoom<R extends EditableRoom>(room: R, edited: EditedPhoto[]): R {
  const refs = room.photoReferences ?? [];
  if (refs.length === 0 || room.score === null) return room;
  const likely = new Map(edited.filter((e) => e.confidence === "likely").map((e) => [e.photo, e]));
  if (!refs.every((n) => likely.has(n))) return room;
  if (refs.every((n) => FABRICATING.has(likely.get(n)!.kind))) return { ...room, score: null };
  return {
    ...room,
    score: Math.min(room.score, EDITED_SCORE_CAP),
    specTier: room.specTier === "luxury" ? "modern" : room.specTier,
  };
}
