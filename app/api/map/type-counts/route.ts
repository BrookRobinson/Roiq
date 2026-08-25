import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { MAP_PROPERTY_TYPES } from "@/lib/map/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/map/type-counts — how many listings of each type exist, and how many
 * of those can actually be drawn.
 *
 * The two numbers are different, and the gap is the whole point. A discovered
 * listing carries an address and gets its coordinates on a later pass, so
 * "2,659 rural listings, 15 of them located" is a real state the map can be in.
 * Without saying so, ticking Rural land shows an empty map that looks broken
 * rather than one honestly behind on its geocoding — which is exactly how this
 * came to be noticed.
 */
export async function GET() {
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, counts: {} });

  const counts: Record<string, { total: number; mapped: number }> = {};

  await Promise.all(
    MAP_PROPERTY_TYPES.map(async (type) => {
      const base = () => {
        const q = supabase
          .from("map_listings")
          .select("*", { count: "exact", head: true })
          .eq("listing_status", "active");
        return type === "unknown" ? q.is("property_type", null) : q.eq("property_type", type);
      };
      const [{ count: total }, { count: mapped }] = await Promise.all([
        base(),
        base().not("lat", "is", null).not("lng", "is", null),
      ]);
      counts[type] = { total: total ?? 0, mapped: mapped ?? 0 };
    })
  );

  return NextResponse.json({ ok: true, counts });
}
