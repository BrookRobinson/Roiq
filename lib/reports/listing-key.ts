// ============================================================
// Deciding whether two people pasted the same house.
//
// Pure and dependency-free so it can be tested directly — the matching rules
// are the whole safety story behind reusing an analysis, and getting one wrong
// either wastes money (a miss) or shows someone the wrong property (a false
// match). The second is much worse, so every rule here errs toward missing.
// ============================================================

/**
 * The same listing arrives spelled many ways: with and without `www.`, http vs
 * https, a trailing slash, and a tail of `?utm_source=...` from wherever the
 * link was copied. Host + path, lowercased, is what actually identifies it.
 */
export function normaliseListingUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    if (!host.includes(".")) return null; // not a real hostname
    return `${host}${path}`;
  } catch {
    return null;
  }
}

/** Case, punctuation and doubled spaces shouldn't stop two addresses matching. */
export function normaliseAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Too short to identify a property on its own — matching on "12a" would join
  // unrelated houses together.
  return v.length >= 6 ? v : null;
}

/**
 * Has the asking price moved?
 *
 * A price drop is the exact moment an old verdict becomes wrong, so it forces a
 * fresh analysis. When either side has no number — auction, "by negotiation",
 * enquiries over — there is nothing to compare, and a listing with no price
 * can't have a price change, so the age rule stands alone.
 */
export function priceUnchanged(fresh: number | null | undefined, saved: number | null | undefined): boolean {
  const a = typeof fresh === "number" && fresh > 0 ? fresh : null;
  const b = typeof saved === "number" && saved > 0 ? Number(saved) : null;
  if (a === null || b === null) return true;
  return a === b;
}

/**
 * Photo URLs carry resize and cache-busting noise (`?width=800`, `&v=3`) that
 * changes without the photograph changing. The path is what identifies the
 * actual file on the CDN.
 */
export function normalisePhotoUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;
  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.toLowerCase()}`;
  } catch {
    return null;
  }
}

/** Only the first 30 are ever analysed (MAX_IMAGES in lib/ai/images.ts). */
const COMPARED_PHOTOS = 30;

/**
 * Are these the same photographs, in the same order?
 *
 * Order matters as much as content: the report says things like "Photo 3 shows
 * water staining", so a reshuffle points that sentence at a different room. Any
 * difference at all — an added photo, a replaced one, a reorder after restyling
 * — means the saved report's photo references no longer describe this listing,
 * and it has to be analysed again.
 *
 * A saved report that claims photos but has no list to compare can't be
 * verified, so it isn't reused. That fails toward spending money rather than
 * toward describing the wrong house.
 */
export function photosUnchanged(
  fresh: readonly (string | null | undefined)[] | null | undefined,
  saved: readonly (string | null | undefined)[] | null | undefined,
  savedPhotosAnalysed: number | null | undefined
): boolean {
  const clean = (list: readonly (string | null | undefined)[] | null | undefined) =>
    (list ?? [])
      .map(normalisePhotoUrl)
      .filter((u): u is string => !!u)
      .slice(0, COMPARED_PHOTOS);

  const a = clean(fresh);
  const b = clean(saved);

  // The old report was written about photos we can no longer see. Don't trust it.
  if (b.length === 0) return (savedPhotosAnalysed ?? 0) === 0 && a.length === 0;

  if (a.length !== b.length) return false;
  return a.every((url, i) => url === b[i]);
}
