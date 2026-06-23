import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/marketplace/session";
import { getVerification, submitVerification } from "@/lib/marketplace/store";

export const runtime = "nodejs";

// GET — current tradesman's verification status.
export async function GET() {
  const me = currentUser();
  return NextResponse.json({
    role: me.role,
    tdVerified: !!me.tdVerified,
    verification: getVerification(me.id) ?? null,
  });
}

// POST — submit a verification application (→ PENDING / "under review").
export async function POST(req: NextRequest) {
  const me = currentUser();
  const body = await req.json().catch(() => ({}));
  if (!body.businessRegUrl || !body.qualificationUrl) {
    return NextResponse.json({ error: "missing_documents" }, { status: 400 });
  }
  const verification = submitVerification(me.id, {
    businessName: body.businessName,
    nzbn: body.nzbn,
    categories: body.categories,
    region: body.region,
    businessRegUrl: body.businessRegUrl,
    qualificationUrl: body.qualificationUrl,
    tradeBodies: Array.isArray(body.tradeBodies) ? body.tradeBodies : [],
  });
  return NextResponse.json({ verification });
}
