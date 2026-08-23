import { NextRequest, NextResponse } from "next/server";

import { readOwnerKey } from "@/lib/reports/owner";
import { MIN_QUERY_LENGTH, searchAnalysedAddresses } from "@/lib/reports/search";
import { getUser } from "@/lib/supabase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reports/search?q=14+ferndale — addresses that have already been analysed.
 *
 * Runs as the caller types, so it stays cheap and says nothing that costs money:
 * address, suburb, when it was done, and whether it's theirs. Never the report.
 *
 * `readOwnerKey` rather than `ensureOwnerKey` on purpose — a search is not a
 * save, and typing in a box shouldn't mint a tracking cookie for someone who
 * never runs a report.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ ok: true, query: q, matches: [] });
  }

  const { authUser } = await getUser().catch(() => ({ authUser: null }));
  const matches = await searchAnalysedAddresses(q, {
    userId: authUser?.id ?? null,
    ownerKey: readOwnerKey(),
  });

  return NextResponse.json({ ok: true, query: q, matches });
}
