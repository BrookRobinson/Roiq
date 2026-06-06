import { NextRequest, NextResponse } from "next/server";

import { scrapeListingUrl, isSupportedUrl, type ScrapedListing } from "@/lib/scraper";
import { analyseProperty, analysePropertyFast } from "@/lib/ai/analyze";
import { isAnalysisConfigured } from "@/lib/ai/client";

export const runtime = "nodejs";
export const maxDuration = 120; // photo analysis can take ~30-60s

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

  let body: { url?: string; listing?: ScrapedListing; only?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const categoryIds = Array.isArray(body.only) && body.only.length > 0 ? body.only : undefined;

  try {
    let listing: ScrapedListing;

    if (body.listing) {
      listing = body.listing;
    } else if (body.url) {
      if (!isSupportedUrl(body.url)) {
        return NextResponse.json(
          { error: "unsupported_url", message: "That listing portal is not supported yet." },
          { status: 422 }
        );
      }
      listing = await scrapeListingUrl(body.url);
    } else {
      return NextResponse.json(
        { error: "missing_input", message: "Provide either a `url` or a `listing`." },
        { status: 400 }
      );
    }

    // Scoped runs (a few categories) use the single call; full reports use the
    // parallel fan-out path for speed.
    const result = categoryIds
      ? await analyseProperty(listing, { categoryIds })
      : await analysePropertyFast(listing);
    return NextResponse.json({ ok: true, listing, ...result });
  } catch (err) {
    console.error("[analyze]", err);
    const message = err instanceof Error ? err.message : "Analysis failed.";
    return NextResponse.json({ error: "analysis_failed", message }, { status: 500 });
  }
}
