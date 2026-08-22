import { NextRequest, NextResponse } from "next/server";

import { type ScrapedListing } from "@/lib/scraper";
import { resolveListing, resolveListingByAddress, ListingNotFoundError } from "@/lib/listing-resolver";
import { analyseProperty, analysePropertyFast } from "@/lib/ai/analyze";
import { findReusableReport, REUSE_MAX_AGE_DAYS } from "@/lib/reports/reuse";
import { fetchMarketData, type MarketResult } from "@/lib/ai/market";
import { fetchSuburbValue } from "@/lib/ai/comparables";
import { isAnalysisConfigured } from "@/lib/ai/client";
import { coverageFor, categoryLabel } from "@/lib/photo-categories";
import type { Inspection } from "@/lib/scoring/model";
import type { MarketRent, CapitalGrowth, SuburbValue } from "@/lib/scoring/investment";

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

  let body: {
    url?: string;
    listing?: ScrapedListing;
    address?: string;
    only?: Inspection[];
    photos?: { category: string; dataUrl: string }[];
    askingPrice?: number;
    prefetch?: boolean;
    prefetched?: { listing?: ScrapedListing; marketRent?: MarketRent; capitalGrowth?: CapitalGrowth; suburbValue?: SuburbValue } | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  // `only` scopes a run to a subset of inspections (improvements|location|land|legal).
  const inspections = Array.isArray(body.only) && body.only.length > 0 ? body.only : undefined;

  // Background prefetch (manual-upload flow): resolve the address + suburb $/m² +
  // market data while the user is still picking photos, so it's ready at Analyse.
  if (body.prefetch) {
    if (!body.address) {
      return NextResponse.json({ error: "missing_input", message: "Address required." }, { status: 400 });
    }
    try {
      const listing = await resolveListingByAddress(body.address);
      const [market, suburbValue] = await Promise.all([
        fetchMarketData(listing).catch(() => ({}) as MarketResult),
        fetchSuburbValue(listing).catch(() => undefined),
      ]);
      return NextResponse.json({ ok: true, listing, marketRent: market.marketRent, capitalGrowth: market.capitalGrowth, suburbValue });
    } catch {
      return NextResponse.json({ ok: false }, { status: 200 }); // best-effort; analyse will retry
    }
  }

  try {
    const photos = Array.isArray(body.photos)
      ? body.photos.filter((p) => p && typeof p.dataUrl === "string" && typeof p.category === "string")
      : [];

    let listing: ScrapedListing;
    let photoLabels: string[] | undefined;

    if (photos.length > 0) {
      // Manual photo upload — the address is MANDATORY (powers council/suburb/comparables).
      if (!body.address) {
        return NextResponse.json({ error: "address_required", message: "Property address is required." }, { status: 400 });
      }
      const base = body.prefetched?.listing ?? (await resolveListingByAddress(body.address));
      listing = { ...base, photoUrls: photos.map((p) => p.dataUrl), scrapedOk: true };
      // The user's entered asking price is authoritative (overrides any scraped figure)
      // → feeds the Financial tab + Value Verdict.
      if (typeof body.askingPrice === "number" && body.askingPrice > 0) {
        listing.askingPrice = body.askingPrice;
        listing.priceText = `$${body.askingPrice.toLocaleString("en-NZ")}`;
        listing.priceMethod = "fixed";
      }
      // Label every photo with its room; when a slot has several, number them
      // ("Backyard — Photo 2 of 3") so the model analyses them all together.
      const catTotals = photos.reduce<Record<string, number>>((m, p) => { m[p.category] = (m[p.category] ?? 0) + 1; return m; }, {});
      const catSeen: Record<string, number> = {};
      photoLabels = photos.map((p) => {
        const label = categoryLabel(p.category);
        const total = catTotals[p.category];
        catSeen[p.category] = (catSeen[p.category] ?? 0) + 1;
        return total > 1 ? `${label} — Photo ${catSeen[p.category]} of ${total}` : label;
      });
    } else if (body.listing) {
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
        { error: "missing_input", message: "Provide a `url`, `address`, `listing`, or `photos`." },
        { status: 400 }
      );
    }

    // Someone may already have paid to have this exact property read. If the
    // listing hasn't moved since, there is nothing to generate — hand back the
    // saved analysis and skip minutes of work and the whole Claude bill.
    //
    // Deliberately AFTER the scrape: the scrape is a couple of seconds and cents,
    // and it's the only way to know today's asking price. Checking before it
    // would mean serving a stale verdict through a price drop, which is exactly
    // when the old numbers are most wrong.
    //
    // Uploads are excluded — those photos are the user's own and were never a
    // public listing, so there is nothing shared to reuse.
    if (photos.length === 0) {
      const reused = await findReusableReport({
        url: listing.url ?? body.url ?? null,
        address: listing.address ?? body.address ?? null,
        askingPrice: listing.askingPrice ?? null,
        photoUrls: listing.photoUrls ?? [],
      });

      if (reused) {
        const { id: _priorId, createdAt: _priorCreatedAt, listing: _priorListing, ...analysis } = reused.report;
        // The caller saves this under a fresh id in their own name, so it lands on
        // their dashboard and counts against their quota like any other report.
        // `listing` is the one we just scraped, so today's price and photos win.
        return NextResponse.json({
          ok: true,
          listing,
          ...analysis,
          reused: true,
          analysedAt: reused.analysedAt,
          reuseMaxAgeDays: REUSE_MAX_AGE_DAYS,
        });
      }
    }

    const prefetched = body.prefetched
      ? { marketRent: body.prefetched.marketRent, capitalGrowth: body.prefetched.capitalGrowth, suburbValue: body.prefetched.suburbValue }
      : undefined;

    // Default to the robust single call (no Files API, one request — best on a
    // Tier-1 key). The parallel fan-out only helps on Tier 2+; the upload path
    // always uses the single call so it carries the per-photo area labels.
    const useFanout = process.env.ANALYZE_FANOUT === "true";
    const result =
      photos.length > 0 || inspections || !useFanout
        ? await analyseProperty(listing, { inspections, photoLabels, prefetched })
        : await analysePropertyFast(listing);
    const photoCoverage = photos.length > 0 ? coverageFor(photos.map((p) => p.category)) : undefined;
    return NextResponse.json({ ok: true, listing, ...result, photoCoverage });
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
