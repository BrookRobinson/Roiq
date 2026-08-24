import { NextRequest, NextResponse } from "next/server";

import { readOwnerKey } from "@/lib/reports/owner";
import { loadViewing, saveViewing } from "@/lib/reports/store";
import { getUser } from "@/lib/supabase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The viewing checklist for one report — the answers, the date the buyer went,
 * and any photo assessments they uploaded at the property.
 *
 * Owner-scoped both ways. A report id is not a password (map pins publish
 * them), and a Pro subscriber reading somebody else's report off the map must
 * not be able to read or overwrite what the person who actually went recorded.
 *
 * The browser keeps its own copy in localStorage and treats this as a sync, not
 * a source of truth — the list gets filled in at a property, on a phone, and it
 * has to work with no signal. So every failure here is quiet: the answer is
 * already saved on the device.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { authUser } = await getUser().catch(() => ({ authUser: null }));
  const viewing = await loadViewing(params.id, readOwnerKey(), authUser?.id ?? null);
  return NextResponse.json({ ok: true, viewing: viewing ?? null });
}

/** Roughly 200 answers with notes, or 30 photo assessments — far past any real report. */
const MAX_BYTES = 400_000;

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  let body: { viewing?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const viewing = body.viewing;
  if (!viewing || typeof viewing !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_viewing" }, { status: 400 });
  }
  if (JSON.stringify(viewing).length > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });
  }

  const { authUser } = await getUser().catch(() => ({ authUser: null }));
  const saved = await saveViewing(params.id, readOwnerKey(), authUser?.id ?? null, viewing);

  // Not the caller's report, or there's no database configured. Neither is an
  // error the buyer can do anything about, and their copy is already safe on the
  // device — so this reports the outcome rather than failing the request.
  return NextResponse.json({ ok: true, synced: saved });
}
