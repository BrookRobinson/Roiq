import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/marketplace/session";
import { getJob, setJobStatus } from "@/lib/marketplace/store";

export const runtime = "nodejs";

// POST — homeowner marks their job complete (→ CLOSED), which unlocks reviewing.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = currentUser();
  const job = getJob(params.id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(me.role === "HOMEOWNER" && me.id === job.homeownerId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  setJobStatus(params.id, "CLOSED");
  return NextResponse.json({ ok: true });
}
