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
