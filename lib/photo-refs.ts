// Photo numbers, as the analysis cites them in its own prose.

/**
 * Photo numbers the item's own text cites — "Photo 5", "Photos 6 and 11",
 * "Photos 3, 7, 8". The model fills photo_references and writes its prose
 * separately, and the two drift: the demo's ventilation card said "assessed
 * from photos 6, 11" above a finding that cited Photo 5. A photo the finding
 * leans on belongs in the list, so the list takes both.
 */
export function citedPhotos(...texts: (string | undefined)[]): number[] {
  const out: number[] = [];
  for (const t of texts) {
    for (const m of (t ?? "").matchAll(/\bphotos?\s+((?:\d+\s*(?:,|and|&)?\s*)+)/gi)) {
      for (const n of m[1].match(/\d+/g) ?? []) {
        const v = Number(n);
        // A year or a measurement isn't a photo number.
        if (v > 0 && v <= 100) out.push(v);
      }
    }
  }
  return out;
}

/** One sorted list, no repeats. */
export const mergePhotoRefs = (refs: number[], cited: number[]): number[] =>
  [...new Set([...refs, ...cited])].sort((a, b) => a - b);
