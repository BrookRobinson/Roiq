// ============================================================
// Reading every matching row, not just the first page — SERVER ONLY.
//
// PostgREST caps a response at its own max-rows setting — 1,000 by default —
// and does it SILENTLY: `.limit(2000)` returns 1,000 rows and no error, so a
// full page is indistinguishable from the end of the table. With a few hundred
// listings nobody noticed. With the national index it meant the map showed the
// first 1,000 of 1,906, and the discovery job deduplicated new listings against
// the first 1,000 rows of 41,103 — so a property somebody had already analysed
// could quietly gain a second, scoreless pin beside it.
//
// Any read that isn't deliberately a single page belongs here.
// ============================================================

const PAGE = 1000;
const MAX_ROWS = 50_000; // a backstop, not a limit anyone should reach

/**
 * Page through a query until it stops returning full pages.
 *
 * Takes a BUILDER rather than a query, because a PostgREST query object can
 * only be awaited once — the second `.range()` on the same builder throws.
 */
export async function readAllPages<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> }
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}
