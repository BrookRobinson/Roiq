// ============================================================
// "Has this house already been done?" — SERVER ONLY.
//
// The reuse machinery can already hand back a saved analysis, but only once
// someone has pasted a link. This lets them ask by address first, which is how
// people actually think about a property.
//
// What this returns is deliberately thin: an address, roughly where it is, and
// when it was analysed. Never a score, a valuation, an asking price or a line
// of the report — those sit behind the allowance, and this runs before anyone
// has spent one. Knowing that 14 Ferndale Rd has been analysed is already
// public: it is a pin on the map, and pasting the link would reveal it anyway.
// Knowing what the report SAYS is not, and doesn't leak from here.
//
// Only reports still inside REUSE_MAX_AGE_DAYS are offered, because those are
// the only ones the analyse flow will actually reuse. Suggesting a two-month-old
// report would promise a saving that turns into a full-price re-analysis.
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseAddress } from "@/lib/reports/listing-key";
import { REUSE_MAX_AGE_DAYS } from "@/lib/reports/reuse";
import {
  MAX_MATCHES,
  MIN_QUERY_LENGTH,
  type AnalysedMatch,
} from "@/lib/reports/search-shared";

export {
  MIN_QUERY_LENGTH,
  MAX_MATCHES,
  type AnalysedMatch,
} from "@/lib/reports/search-shared";

/**
 * Strip the query back to what can safely go into a LIKE pattern.
 *
 * Addresses legitimately contain digits, slashes (`2/14`), apostrophes
 * (`O'Rorke`), hyphens and the odd `&`. Everything else — including `%` and `_`,
 * which are LIKE wildcards, and `,` which PostgREST reads as a filter separator
 * — is dropped rather than escaped. A dropped character costs a slightly wider
 * match; a passed-through one changes what the query means.
 */
function sanitise(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9 /'&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Saved analyses whose address matches what's being typed.
 *
 * Matching is token-based rather than a straight substring: someone typing
 * "ferndale 14" means the same house as "14 Ferndale". Every token has to
 * appear, so it stays tight — a miss just means they paste the link instead,
 * but a false match would offer them the wrong house.
 */
export async function searchAnalysedAddresses(
  rawQuery: string,
  caller: { userId: string | null; ownerKey: string | null },
  limit: number = MAX_MATCHES
): Promise<AnalysedMatch[]> {
  const clean = sanitise(rawQuery ?? "");
  if (clean.length < MIN_QUERY_LENGTH) return [];

  const supabase = createAdminClient();
  if (!supabase) return [];

  const tokens = clean.split(" ").filter(Boolean);
  // Narrow in the database on the most selective token — the longest one, which
  // is nearly always the street name rather than the number. The full all-token
  // test then runs in code, where the same normalisation as the reuse check is
  // available.
  const anchor = tokens.reduce((a, b) => (b.length > a.length ? b : a), "");
  const cutoff = new Date(Date.now() - REUSE_MAX_AGE_DAYS * 86_400_000).toISOString();

  try {
    const { data, error } = await supabase
      .from("reports")
      .select("id, address, suburb, region, listing_url, created_at, user_id, owner_key")
      .eq("report_status", "complete")
      .gte("created_at", cutoff)
      .not("address", "is", null)
      .ilike("address", `%${anchor}%`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data?.length) return [];

    const { userId, ownerKey } = caller;
    const isMine = (row: { user_id: string | null; owner_key: string | null }) =>
      (!!userId && row.user_id === userId) || (!!ownerKey && row.owner_key === ownerKey);

    const hits = data.filter((row) => {
      const haystack = normaliseAddress(row.address) ?? "";
      return haystack.length > 0 && tokens.every((t) => haystack.includes(t));
    });

    // One row per property. The query is already newest-first, so a stable pass
    // keeps the newest of each — except that the caller's own always wins, the
    // same precedence the reuse lookup uses and for the same reason: sending
    // someone to a stranger's copy of a report they already own would charge
    // them twice for it.
    const byProperty = new Map<string, AnalysedMatch>();
    for (const pass of [true, false]) {
      for (const row of hits) {
        if (isMine(row) !== pass) continue;
        const key = normaliseAddress(row.address) ?? row.address!.toLowerCase();
        if (byProperty.has(key)) continue;
        byProperty.set(key, {
          address: row.address!,
          suburb: row.suburb,
          region: row.region,
          listingUrl: row.listing_url,
          analysedAt: row.created_at,
          mine: pass,
          id: pass ? row.id : null,
        });
      }
    }

    return Array.from(byProperty.values()).slice(0, limit);
  } catch {
    // Search is a convenience on top of a box that already works. If the lookup
    // falls over, the user pastes a URL — they must never be blocked by it.
    return [];
  }
}
