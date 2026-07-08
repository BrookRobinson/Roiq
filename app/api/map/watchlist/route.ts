import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** GET — saved property ids for the signed-in user. Auth is bypassed today, so the
 *  client keeps the watchlist in localStorage and this returns an empty server list. */
export async function GET() {
  try {
    const { authUser } = await getUser();
    if (authUser) {
      const supabase = createClient();
      const { data } = await supabase
        .from("watchlist")
        .select("map_listing_id, added_at")
        .eq("user_id", authUser.id);
      return NextResponse.json({
        ok: true,
        items: (data ?? []).map((r) => (r as { map_listing_id: string }).map_listing_id),
      });
    }
  } catch {
    /* not signed in */
  }
  return NextResponse.json({ ok: true, items: [], local: true });
}

/** POST { mapListingId } — save a property to the watchlist. */
export async function POST(req: NextRequest) {
  let body: { mapListingId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json", message: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.mapListingId) {
    return NextResponse.json({ error: "missing_id", message: "mapListingId is required." }, { status: 400 });
  }
  try {
    const { authUser } = await getUser();
    if (authUser) {
      const supabase = createClient();
      await supabase.from("watchlist").insert({
        user_id: authUser.id,
        map_listing_id: body.mapListingId,
        added_at: new Date().toISOString(),
      } as never);
      return NextResponse.json({ ok: true });
    }
  } catch {
    /* not signed in / RLS */
  }
  return NextResponse.json({ ok: true, local: true });
}
