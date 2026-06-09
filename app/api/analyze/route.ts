import { NextRequest, NextResponse } from "next/server";

import { type ScrapedListing } from "@/lib/scraper";
import { resolveListing, resolveListingByAddress, ListingNotFoundError } from "@/lib/listing-resolver";
import { analyseProperty, analysePropertyFast } from "@/lib/ai/analyze";
import { isAnalysisConfigured } from "@/lib/ai/client";
import type { Inspection } from "@/lib/scoring/model";

export const runtime = "nodejs";
// A full 84-item report on a Tier-1 key can take a few minutes; don't let the
// platform cut it off (local `next dev` ignores this, but a deploy honours it).
export const maxDuration = 300;

/**
 * POST /api/analyze
 * Body: { url } to scrape-then-analyse, or { listing } to analyse a listing directly.
 * Returns the scored PropertyTabData, gaps, and run metadata.
 *
 * Note: this does not yet persist to the reports table — that wiring lands with
 * the data-foundation step. For now it returns the result for the caller to use.
 */
export async function POST(req: NextRequest) {
  if (!isAnalysisConfigured()) {
    return NextResponse.json(
      { error: "analysis_unavailable", message: "ANTHROPIC_API_KEY is not configured." },
      { status: 503 }
    );
  }

  let body: { url?: string; listing?: ScrapedListing; address?: string; only?: Inspection[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  // `only` scopes a run to a subset of inspections (improvements|location|land|legal).
  const inspections = Array.isArray(body.only) && body.only.length > 0 ? body.only : undefined;

  try {
    let listing: ScrapedListing;

    if (body.listing) {
      listing = body.listing;
    } else if (body.address) {
      // Manual address fallback — find by address, else analyse on public data. Never dead-ends.
      listing = await resolveListingByAddress(body.address);
    } else if (body.url) {
      // Direct scrape → web-search fallback (OneRoof / realestate / homes / agency).
      // Throws ListingNotFoundError if the property can't be recovered anywhere.
      listing = await resolveListing(body.url);
    } else {
      return NextResponse.json(
        { error: "missing_input", message: "Provide either a `url` or a `listing`." },
        { status: 400 }
      );
    }

    // Default to the robust single call (no Files API, one request — best on a
    // Tier-1 key). The parallel fan-out only helps on Tier 2+ where concurrency
    // isn't rate-limited; enable it with ANALYZE_FANOUT=true.
    const useFanout = process.env.ANALYZE_FANOUT === "true";
    const result =
      inspections || !useFanout
        ? await analyseProperty(listing, { inspections })
        : await analysePropertyFast(listing);
    return NextResponse.json({ ok: true, listing, ...result });
  } catch (err) {
    if (err instanceof ListingNotFoundError) {
      return NextResponse.json(
        { error: "listing_not_found", message: "We found limited data for that link. Paste a link from oneroof.co.nz or realestate.co.nz for better results." },
        { status: 422 }
      );
    }
    console.error("[analyze]", err);
    const message = err instanceof Error ? err.message : "Analysis failed.";
    const overloaded = /overloaded|temporarily unavailable|rate.?limit|\b429\b|\b503\b|\b529\b/i.test(message);
    return NextResponse.json(
      {
        error: overloaded ? "overloaded" : "analysis_failed",
        message: overloaded
          ? "Claude is temporarily overloaded (or rate-limited) — wait a few seconds and try again."
          : message,
      },
      { status: overloaded ? 503 : 500 }
    );
  }
}
