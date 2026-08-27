import { NextRequest, NextResponse } from "next/server";

import { buildMapListing } from "@/lib/map/from-analysis";
import { isPublicListing, type ReportContribution } from "@/lib/map/contribution";
import { whyIncomplete, INCOMPLETE_REASON } from "@/lib/map/report-completeness";
import { addUserListing } from "@/lib/map/user-listings";
import { persistMapListing } from "@/lib/map/persist";

export const runtime = "nodejs";
export const maxDuration = 60; // rent lookup + geocode only — the analysis is already done

/**
 * POST /api/map/from-report — put a report a user just ran onto the map.
 *
 * This is how the map fills up. There is no NZ listings feed to crawl, so every
 * pin is a property someone actually paid attention to, already scored by the
 * real pipeline. Cheap by design: the analysis arrives with the request, so this
 * only costs a bond-data lookup and a geocode.
 *
 * Called fire-and-forget from the report flow, so it answers 200 with a reason
 * whenever it declines. A property missing from the map is not worth surfacing
 * an error to someone who just wanted their report.
 */
export async function POST(req: NextRequest) {
  let c: ReportContribution;
  try {
    c = (await req.json()) as ReportContribution;
  } catch {
    return NextResponse.json({ error: "bad_json", message: "Invalid JSON body." }, { status: 400 });
  }

  if (!c?.listing || !Number.isFinite(c.score)) {
    return NextResponse.json({ error: "missing_input", message: "Need a listing and a score." }, { status: 400 });
  }

  // Re-check server-side. The client already gates on this, but "is this property
  // public?" decides whether someone's home ends up on a shared map, so it is not
  // a decision to leave to a caller we don't control.
  if (!isPublicListing(c.listing)) {
    return NextResponse.json({ ok: false, added: false, reason: "not_a_public_listing" });
  }

  // A grey pin says one honest thing — this property is for sale and nobody has
  // analysed it. Replacing it with a half-finished analysis trades that for a
  // score and a price that nothing stands behind. Leaving it grey costs nothing:
  // it was already true, and the user still has their report either way.
  const incomplete = c.completeness ? whyIncomplete(c.completeness) : "no-score";
  if (incomplete) {
    console.warn(`[map/from-report] not added — ${INCOMPLETE_REASON[incomplete]}`);
    return NextResponse.json({
      ok: false,
      added: false,
      reason: "incomplete_analysis",
      detail: INCOMPLETE_REASON[incomplete],
    });
  }

  try {
    // Keyed by report id so re-running the same property replaces its pin.
    const id = c.reportId ? `report-${c.reportId}` : `report-${Date.now()}`;
    const built = await buildMapListing(c, id);

    const local = await addUserListing(built.listing);
    if (!local.stored) {
      // Almost always a geocode miss — better no pin than a pin in the wrong place.
      return NextResponse.json({ ok: false, added: false, reason: local.reason ?? "not_stored" });
    }

    // Supabase is the real home for these; the local copy carries them until it's back.
    // The real listing URL, not a report reference: it's how the nightly
    // discovery job recognises that this property is already on the map and
    // doesn't add a bare second pin beside it. `full_report_ref` already
    // carries the report id, so nothing is lost.
    const db = await persistMapListing(built.listing, c.listing?.url ?? "");

    return NextResponse.json({
      ok: true,
      added: true,
      id,
      persisted: db.persisted,
      persistReason: db.reason ?? null,
      geocoded: built.geocoded,
      sources: built.sources,
    });
  } catch (err) {
    console.error("[map/from-report]", err);
    return NextResponse.json({ ok: false, added: false, reason: "build_failed" });
  }
}
