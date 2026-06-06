import { NextRequest, NextResponse } from "next/server";
import { scrapeListingUrl, detectPortalFromUrl, isSupportedUrl } from "@/lib/scraper";

export const maxDuration = 30; // Vercel Pro allows 60s — 30s is safe for free tier

export async function POST(request: NextRequest) {
  let body: { url?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = body.url?.trim();

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!isSupportedUrl(url)) {
    return NextResponse.json(
      {
        error: "Unsupported portal",
        message:
          "We couldn't recognise this listing URL. Supported portals: Trade Me, realestate.co.nz, Ray White, Harcourts, Bayleys, Barfoot, Property Brokers, OneRoof.",
        portal: "unknown",
      },
      { status: 422 }
    );
  }

  const portal = detectPortalFromUrl(url);

  try {
    const listing = await scrapeListingUrl(url);

    if (!listing.scrapedOk) {
      return NextResponse.json(
        {
          error: "Scrape incomplete",
          message:
            listing.errorMessage ??
            "We couldn't extract listing data. The portal may have blocked the request. Try uploading photos manually.",
          portal,
          partial: listing,
        },
        { status: 206 }
      );
    }

    return NextResponse.json({ ok: true, portal, listing }, { status: 200 });
  } catch (err) {
    console.error("[scrape]", err);
    return NextResponse.json(
      {
        error: "Scrape failed",
        message: (err as Error).message,
        portal,
      },
      { status: 500 }
    );
  }
}
