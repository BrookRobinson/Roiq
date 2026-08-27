import { NextRequest, NextResponse } from "next/server";

import { type ScrapedListing } from "@/lib/scraper";
import { resolveListing, resolveListingByAddress, ListingNotFoundError } from "@/lib/listing-resolver";
import { assessDwelling } from "@/lib/property/dwelling";
import { assessFarm } from "@/lib/property/farm";
import { analyseProperty, analysePropertyFast } from "@/lib/ai/analyze";
import { findReusableReport, isOwnReport, REUSE_MAX_AGE_DAYS } from "@/lib/reports/reuse";
import { getQuota } from "@/lib/reports/quota";
import { effectivePlan, quotaExhaustedMessage } from "@/lib/billing/plans";
import { getUser } from "@/lib/supabase/auth";
import { readOwnerKey } from "@/lib/reports/owner";
import { fetchMarketData, type MarketResult } from "@/lib/ai/market";
import { fetchSuburbValue } from "@/lib/ai/comparables";
import { isAnalysisConfigured } from "@/lib/ai/client";
import { coverageFor, categoryLabel } from "@/lib/photo-categories";
import type { Inspection } from "@/lib/scoring/model";
import type { MarketRent, CapitalGrowth, SuburbValue } from "@/lib/scoring/investment";
import { PRODUCT_NAME } from "@/lib/brand";

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

  // Who's asking. Needed twice below — to tell their own saved report from
  // someone else's, and to size their allowance.
  const { authUser, profile } = await getUser().catch(() => ({ authUser: null, profile: null }));
  const plan = effectivePlan(profile?.plan, profile?.plan_expires_at);
  const ownerKey = readOwnerKey();

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

    // ── Is it a farm? ─────────────────────────────────────────────────────
    // Stop at the door. Tectara values a home and the ground it sits on; a farm
    // is worth what it produces, and none of that is in a listing photograph.
    // Refusing here costs nothing and spends nothing — the alternative is a
    // $3m dairy unit scored on the state of its kitchen.
    //
    // A lifestyle block is NOT a farm and is not refused: a house on a few
    // hectares is exactly what this app is for.
    const farm = assessFarm(listing);
    if (farm.isFarm) {
      return NextResponse.json(
        {
          error: "not_residential",
          message: `${listing.address ?? "This property"} is a farm — ${farm.reason}.`,
        },
        { status: 422 }
      );
    }

    // ── Is there a building to score? ──────────────────────────────────────
    // The 1,000-point model describes a DWELLING — roof, kitchen, bathroom,
    // joinery. Run it against a bare section and every item is scored from
    // photographs of an empty paddock, which is how a two-lot section came back
    // as "house · 195m² floor · 805/1000".
    //
    // So land gets a land report instead: the Land and Legal inspections only,
    // scored out of their own total, with the section valued on its own terms.
    // The improvements half is never asked for and never assembled — see
    // `landOnly` in lib/ai/analyze.ts.
    const landOnly = !assessDwelling(listing).hasDwelling;

    // Someone may already have paid to have this exact property read. If the
    // listing hasn't moved since, there is nothing to generate — hand back the
    // saved analysis and skip minutes of work and the whole Claude bill.
    //
    // Deliberately AFTER the scrape: the scrape is a couple of seconds and cents,
    // and it's the only way to know today's asking price OR whether the photos
    // have changed. Checking before it would mean serving a stale verdict
    // through a price drop, which is when the old numbers are most wrong.
    //
    // Uploads are excluded — those photos are the user's own and were never a
    // public listing, so there is nothing shared to reuse.
    const reused =
      photos.length === 0
        ? await findReusableReport({
            url: listing.url ?? body.url ?? null,
            address: listing.address ?? body.address ?? null,
            askingPrice: listing.askingPrice ?? null,
            photoUrls: listing.photoUrls ?? [],
            caller: { userId: authUser?.id ?? null, ownerKey },
          })
        : null;

    // Their OWN unchanged report. They already paid for this one — send them
    // back to it rather than charging a second time for the same thing and
    // leaving two identical rows on their dashboard. This is also why there's
    // no "re-analyse anyway" button: nothing has changed, so there'd be
    // nothing new to find.
    if (reused && isOwnReport(reused, authUser?.id ?? null, ownerKey)) {
      return NextResponse.json({
        ok: true,
        existingReportId: reused.id,
        analysedAt: reused.analysedAt,
        listing,
      });
    }

    // ── Allowance ────────────────────────────────────────────────────────────
    // Below the scrape so the caller's own report can be recognised first, and
    // above everything expensive. A cached report from SOMEONE ELSE still costs
    // the reader one of theirs — the saving from reuse is ours, not a way to
    // run more reports than the plan includes.
    const quota = await getQuota(
      authUser?.id ?? null,
      ownerKey,
      plan,
      new Date(),
      authUser?.email ?? profile?.email ?? null
    );
    if (quota.remaining <= 0) {
      // 402, matching the map's upsell: not malformed, not forbidden — it needs
      // paying for.
      return NextResponse.json(
        { error: "quota_exhausted", message: quotaExhaustedMessage(quota), quota },
        { status: 402 }
      );
    }

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
        quota: { ...quota, used: quota.used + 1, remaining: quota.remaining - 1 },
      });
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
        ? await analyseProperty(listing, { inspections, photoLabels, prefetched, landOnly })
        : await analysePropertyFast(listing);
    const photoCoverage = photos.length > 0 ? coverageFor(photos.map((p) => p.category)) : undefined;
    return NextResponse.json({
      ok: true,
      listing,
      ...result,
      // The report view needs this to lock the Improvements tab and show a land
      // score rather than a condition score out of 1,000.
      landOnly,
      photoCoverage,
      quota: { ...quota, used: quota.used + 1, remaining: quota.remaining - 1 },
    });
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
          ? `The ${PRODUCT_NAME} analysis service is temporarily overloaded (or rate-limited) — wait a few seconds and try again.`
          : message,
      },
      { status: overloaded ? 503 : 500 }
    );
  }
}
