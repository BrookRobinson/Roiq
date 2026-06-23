import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/marketplace/session";
import { jobsForTradesman, createJob } from "@/lib/marketplace/store";

export const runtime = "nodejs";

// GET — tradesman listings: LIVE jobs in their CHOSEN REGION (?region= override,
// default their own) and only in THEIR TRADES. Returns the viewer's region +
// categories so the UI can build the region switcher + trade chips.
export async function GET(req: NextRequest) {
  const me = currentUser();
  if (me.role !== "TRADESMAN") return NextResponse.json({ error: "tradesman_only" }, { status: 403 });
  if (!me.tdVerified) return NextResponse.json({ error: "not_verified" }, { status: 403 });
  const category = req.nextUrl.searchParams.get("category") ?? undefined;
  const region = req.nextUrl.searchParams.get("region") ?? undefined;
  return NextResponse.json({
    jobs: jobsForTradesman(me, { category, region }),
    viewer: { region: region || me.region || "", categories: me.categories ?? [] },
  });
}

// POST — create a job (homeowner). Used by the post flow ("Post" or "Save as draft").
export async function POST(req: NextRequest) {
  const me = currentUser();
  if (me.role !== "HOMEOWNER") return NextResponse.json({ error: "homeowner_only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!body.category || !body.description?.trim()) {
    return NextResponse.json({ error: "missing_fields", message: "Category and description are required." }, { status: 400 });
  }
  const job = createJob(me.id, body);
  return NextResponse.json({ job });
}
