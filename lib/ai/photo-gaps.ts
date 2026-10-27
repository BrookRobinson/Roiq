// ============================================================
// What the listing photos avoid.
//
// Agents rarely fake a house; mostly they leave things out. The rear of the
// house, the second bathroom, the ceiling above the shower, the roof, a side of
// the house with tired cladding — none of it photographed, and a report that
// reads only what IS shown inherits the agent's choices.
//
// So the analysis lists those gaps, and two things follow:
//   • the reader is told, and each gap becomes a line on the viewing checklist;
//   • an item the gap is about cannot stay at full confidence. A Tier 1 read
//     becomes Tier 2 ("probable"), its score is NOT changed. A gap is a reason
//     to doubt the read, not evidence the thing is bad.
//
// Pure, no imports — scripts/verify-photo-evidence.mjs loads it directly.
// ============================================================

export interface PhotoGap {
  /** Where, in a buyer's words: "Rear of the house", "Second bathroom". */
  area: string;
  /** What a buyer would expect to see and can't. */
  missing: string;
  /** The checklist items this gap is about. Unknown ids are dropped. */
  itemIds: string[];
}

export interface RawPhotoGap {
  area?: string;
  missing?: string;
  item_ids?: string[];
}

/** More than this is noise, and the model starts listing the insulation. */
export const MAX_GAPS = 8;

export function normPhotoGaps(raw: RawPhotoGap[] | undefined, validIds: Set<string>): PhotoGap[] {
  if (!Array.isArray(raw)) return [];
  const out: PhotoGap[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const area = r?.area?.trim();
    const missing = r?.missing?.trim();
    if (!area || !missing) continue;
    const key = area.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const itemIds = Array.isArray(r.item_ids) ? [...new Set(r.item_ids.filter((id) => typeof id === "string" && validIds.has(id)))] : [];
    out.push({ area, missing, itemIds });
    if (out.length >= MAX_GAPS) break;
  }
  return out;
}

export interface GapItem {
  id: string;
  score: number | null;
  confidenceTier: 1 | 2 | 3;
  aiSummary: string;
}

/**
 * One item against the gaps. A scored Tier 1 item that a gap is about drops to
 * Tier 2 and says why; anything else is returned unchanged. Returns null when
 * no gap touches it.
 */
export function applyPhotoGaps<T extends GapItem>(item: T, gaps: PhotoGap[]): T | null {
  const hits = gaps.filter((g) => g.itemIds.includes(item.id));
  if (hits.length === 0) return null;
  if (item.score === null || item.confidenceTier !== 1) return null;
  const what = hits.map((g) => g.area.toLowerCase()).join(" or ");
  return {
    ...item,
    confidenceTier: 2,
    aiSummary: `The listing photos don't show the ${what}, so this is marked probable rather than confirmed. ` + item.aiSummary,
  };
}
