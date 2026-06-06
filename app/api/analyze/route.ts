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

    // Default to the robust single call (no Files API, one request — best on a
    // Tier-1 key). The parallel fan-out only helps on Tier 2+ where concurrency
    // isn't rate-limited; enable it with ANALYZE_FANOUT=true.
    const useFanout = process.env.ANALYZE_FANOUT === "true";
    const result =
      categoryIds || !useFanout
        ? await analyseProperty(listing, { categoryIds })
        : await analysePropertyFast(listing);
    return NextResponse.json({ ok: true, listing, ...result });
  } catch (err) {
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
