import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/marketplace/session";
import { addReview } from "@/lib/marketplace/store";

export const runtime = "nodejs";

// POST — submit a review for a completed quote (one per quote).
export async function POST(req: NextRequest) {
  const me = currentUser();
  const body = await req.json().catch(() => ({}));
  const { quoteId, rating, comment } = body;
  if (!quoteId || !rating) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  const res = addReview(quoteId, me.id, Number(rating), (comment ?? "").trim());
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ review: res });
}
