// ============================================================
// Rooms the listing never photographed — found, and filled in by the buyer.
//
// A house with three bedrooms reads each one on its own (SubItem.byRoom). A
// bedroom no listing photo shows comes back with null reads, and the
// valuation ESTIMATES it from the rest of the house. That estimate is honest,
// but it is the one gap a buyer standing in the room can close in a minute —
// so the viewing checklist asks for it, one line per room, and one set of
// photographs scores every item in that room at once.
//
// The buyer's reads are stored as ordinary item-photo assessments tagged with
// the room (`ItemPhotoAnalysis.room`), under `roomPhotoKey(item, room)`. They
// are applied here, onto the room's read in `byRoom` — never onto the item as
// a whole, which would value every bedroom at the one the buyer stood in.
//
// Dependency-free (types only) so verify:viewing can load it with plain node.
// ============================================================

import type { SubItem, RoomRead, UrgencyScore } from "../property-tab/types";
import type { ItemPhotoAnalysis } from "./photo-types";

export type RoomKind = "bathroom" | "bedroom";

/** The items read room by room, by kind. Mirrors ROOM_ITEM_IDS in improvement-values. */
export const ROOM_ITEMS: Record<RoomKind, string[]> = {
  bathroom: ["bath_shower", "bath_vanity", "bath_toilet", "bath_ventilation", "bath_flooring"],
  bedroom: ["bed_heating", "bed_storage", "bed_flooring", "bed_ceiling"],
};

export const kindOfItem = (id: string): RoomKind | null =>
  ROOM_ITEMS.bathroom.includes(id) ? "bathroom" : ROOM_ITEMS.bedroom.includes(id) ? "bedroom" : null;

/** Where a buyer's read of one item in one room is filed. */
export const roomPhotoKey = (itemId: string, room: string) => `${itemId}@${room}`;

/** The checklist line for a whole room. */
export const roomLineKey = (kind: RoomKind, room: string) => `room:${kind}:${room}`;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export interface UnseenRoom {
  kind: RoomKind;
  room: string;
  /** The items in it that no listing photo shows. */
  itemIds: string[];
}

/**
 * Every room of a kind that the listing photos don't show.
 *
 * Named rooms come from the analysis's own per-room reads (a null score is a
 * room it couldn't see). Where the listing counts more rooms than the analysis
 * named, the rest are "Bedroom 3" and so on — the same names the valuation
 * uses for them — and every item of that kind is unseen in them.
 */
export function unseenRooms(subItems: SubItem[], counts: { bathrooms?: number | null; bedrooms?: number | null }): UnseenRoom[] {
  const out: UnseenRoom[] = [];
  for (const kind of ["bathroom", "bedroom"] as RoomKind[]) {
    const items = subItems.filter((s) => ROOM_ITEMS[kind].includes(s.id) && s.byRoom?.length);
    if (items.length === 0) continue;
    const byName = new Map<string, Set<string>>();
    const named: string[] = [];
    for (const s of items) {
      for (const r of s.byRoom ?? []) {
        if (!named.some((n) => same(n, r.room))) named.push(r.room);
        if (r.score == null) {
          const key = named.find((n) => same(n, r.room)) as string;
          byName.set(key, (byName.get(key) ?? new Set()).add(s.id));
        }
      }
    }
    for (const room of named) {
      const ids = byName.get(room);
      if (ids?.size) out.push({ kind, room, itemIds: ROOM_ITEMS[kind].filter((id) => ids.has(id)) });
    }
    const listed = Math.round((kind === "bathroom" ? counts.bathrooms : counts.bedrooms) ?? 0);
    const noun = kind === "bathroom" ? "Bathroom" : "Bedroom";
    for (let n = named.length; n < listed; n++) {
      out.push({ kind, room: `${noun} ${n + 1}`, itemIds: items.map((s) => s.id) });
    }
  }
  return out;
}

/** The buyer's reads for one room, by item. */
export function photosForRoom(photos: Record<string, ItemPhotoAnalysis> | undefined, room: string): ItemPhotoAnalysis[] {
  return Object.values(photos ?? {}).filter((p) => p.room != null && same(p.room, room));
}

/**
 * Put the buyer's room reads onto an item's per-room reads.
 *
 * A read the photographs actually showed replaces that room's read (or adds
 * the room, when it was one the analysis never named). The item's own score is
 * then the worst room seen again — the rule it always follows. An item with no
 * per-room reads is left alone: there is nothing to say which room is which.
 */
export function applyRoomPhotos(s: SubItem, photos: Record<string, ItemPhotoAnalysis> | undefined): SubItem {
  if (!s.byRoom?.length) return s;
  const mine = Object.values(photos ?? {}).filter((p) => p.itemId === s.id && p.room && p.showsItem && p.score != null);
  if (mine.length === 0) return s;

  const reads: RoomRead[] = s.byRoom.map((r) => ({ ...r }));
  for (const p of mine) {
    const read: RoomRead = {
      room: p.room as string,
      score: p.score as UrgencyScore,
      specTier: p.specTier,
      material: p.material,
      observedDefect: p.observedDefect,
      photoReferences: [],
      fromBuyer: true,
      ...(p.showerType ? { showerType: p.showerType } : {}),
      ...(p.floorType ? { floorType: p.floorType } : {}),
    };
    const i = reads.findIndex((r) => same(r.room, read.room));
    if (i >= 0) reads[i] = { ...reads[i], ...read };
    else reads.push(read);
  }
  const seen = reads.filter((r) => r.score != null).map((r) => r.score as number);
  // An item the listing showed in no room at all had no read of its own; its
  // confidence is now the buyer's photograph's.
  const fromNothing = s.score == null;
  return {
    ...s,
    byRoom: reads,
    score: seen.length ? (Math.min(...seen) as UrgencyScore) : s.score,
    ...(fromNothing ? { confidenceTier: Math.min(...mine.map((p) => p.confidenceTier)) as SubItem["confidenceTier"], evidenceSource: "Your own photos, taken at the property" } : {}),
  };
}
