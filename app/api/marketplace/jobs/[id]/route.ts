import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/marketplace/session";
import {
  getJob, getUser, hasQuoted, quotesForJob, quotesWithTradesman,
  homeownerPublic, setJobStatus,
} from "@/lib/marketplace/store";
import { categoryById, isQualified } from "@/lib/marketplace/constants";

export const runtime = "nodejs";

// GET — job detail. Role-aware: the owning homeowner sees quotes (with tradesman
// contact); a tradesman sees the homeowner's contact MASKED until they've quoted.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = currentUser();
  const job = getJob(params.id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const category = categoryById(job.category) ?? null;
  const home = getUser(job.homeownerId);

  if (me.role === "HOMEOWNER" && me.id === job.homeownerId) {
    return NextResponse.json({ role: "owner", job, category, quotes: quotesWithTradesman(job.id) });
  }

  // Tradesman view
  const quoted = hasQuoted(job.id, me.id);
  return NextResponse.json({
    role: "tradesman",
    job,
    category,
    requiredBodies: category?.requiredBodies ?? [],
    qualified: isQualified(job.category, me.tradeBodies),
    alreadyQuoted: quoted,
    myQuote: quoted ? quotesForJob(job.id).find((q) => q.tradesmanId === me.id) ?? null : null,
    homeowner: home ? homeownerPublic(home, quoted) : null,
    quoteCount: quotesForJob(job.id).length,
    myContact: { email: me.email, phone: me.phone },
  });
}

// PATCH — update status (homeowner owner only).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = currentUser();
  const job = getJob(params.id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(me.role === "HOMEOWNER" && me.id === job.homeownerId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { status } = await req.json().catch(() => ({}));
  if (!["DRAFT", "LIVE", "CLOSED"].includes(status)) return NextResponse.json({ error: "bad_status" }, { status: 400 });
  setJobStatus(params.id, status);
  return NextResponse.json({ ok: true });
}
