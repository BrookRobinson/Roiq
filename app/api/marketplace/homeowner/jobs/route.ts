import { NextResponse } from "next/server";
import { currentUser } from "@/lib/marketplace/session";
import { homeownerJobs, quotesForJob } from "@/lib/marketplace/store";

export const runtime = "nodejs";

// GET — the homeowner's own jobs (with quote counts).
export async function GET() {
  const me = currentUser();
  if (me.role !== "HOMEOWNER") return NextResponse.json({ error: "homeowner_only" }, { status: 403 });
  const jobs = homeownerJobs(me.id).map((j) => ({ ...j, quoteCount: quotesForJob(j.id).length }));
  return NextResponse.json({ jobs });
}
