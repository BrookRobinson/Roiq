import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/marketplace/session";
import { addQuote } from "@/lib/marketplace/store";

export const runtime = "nodejs";

// POST — submit a quote (verified, qualified tradesman). On success the tradesman's
// contact details are returned (now shared with the homeowner).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = currentUser();
  if (me.role !== "TRADESMAN") return NextResponse.json({ error: "tradesman_only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amountNZD);
  const message = (body.message ?? "").trim();
  if (!amount || amount <= 0 || !message) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const res = addQuote(params.id, me.id, amount, message);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ quote: res, contactShared: { email: me.email, phone: me.phone } });
}
