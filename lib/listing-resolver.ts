// Listing acquisition with a fallback chain: try the direct portal scrape, and
// when it's blocked / empty / unsupported (or it's TradeMe, which blocks bots),
// recover the SAME property from another source via web search. The result
// carries a `dataSource` note when a fallback was used.

import { scrapeListingUrl, detectPortalFromUrl, type ScrapedListing } from "@/lib/scraper";
import { emptyListing } from "@/lib/scraper/types";
import { searchListing } from "@/lib/ai/listing-search";

export class ListingNotFoundError extends Error {
  constructor() {
    super("LISTING_NOT_FOUND");
    this.name = "ListingNotFoundError";
  }
}

const PORTAL_LABEL: Record<string, string> = {
  trademe: "Trade Me", realestate: "realestate.co.nz", raywhite: "Ray White", harcourts: "Harcourts",
  bayleys: "Bayleys", barfoot: "Barfoot & Thompson", propertybrokers: "Property Brokers", oneroof: "OneRoof", unknown: "original",
};

const hasRealData = (l: ScrapedListing): boolean => l.askingPrice != null || l.bedrooms != null || l.floorAreaSqm != null;

// Fill gaps in `base` from recovered `fields` (recovered data wins on nulls/unknowns).
function merge(base: ScrapedListing, f: Partial<ScrapedListing>): ScrapedListing {
  return {
    ...base,
    address: f.address ?? base.address,
    suburb: f.suburb ?? base.suburb,
    city: f.city ?? base.city,
    region: f.region ?? base.region,
    askingPrice: f.askingPrice ?? base.askingPrice,
    priceText: f.priceText ?? base.priceText,
    bedrooms: f.bedrooms ?? base.bedrooms,
    bathrooms: f.bathrooms ?? base.bathrooms,
    carParks: f.carParks ?? base.carParks,
    floorAreaSqm: f.floorAreaSqm ?? base.floorAreaSqm,
    landAreaSqm: f.landAreaSqm ?? base.landAreaSqm,
    buildYear: f.buildYear ?? base.buildYear,
    propertyType: f.propertyType && f.propertyType !== "unknown" ? f.propertyType : base.propertyType,
    description: f.description ?? base.description,
    agencyName: f.agencyName ?? base.agencyName,
    agentName: f.agentName ?? base.agentName,
  };
}

export async function resolveListing(url: string): Promise<ScrapedListing> {
  const portal = detectPortalFromUrl(url);
  let listing: ScrapedListing | null = null;

  // TradeMe blocks scraping → skip straight to web-search. Other known portals: try direct first.
  if (portal !== "trademe" && portal !== "unknown") {
    try {
      listing = await scrapeListingUrl(url);
    } catch {
      listing = null;
    }
  }

  // Blocked / empty / unsupported / TradeMe → recover the property from another source.
  if (!listing || !hasRealData(listing)) {
    const found = await searchListing({ url, address: listing?.address ?? null });
    if (found.found) {
      const merged = merge(listing ?? emptyListing(url, portal), found.fields);
      merged.scrapedOk = true;
      merged.dataSource = `Data sourced from ${found.source}${portal !== "unknown" ? ` — the original ${PORTAL_LABEL[portal] ?? portal} listing was unavailable` : ""}.`;
      if (found.fields.photoUrls && found.fields.photoUrls.length > 0) merged.photoUrls = found.fields.photoUrls;
      listing = merged;
    }
  }

  // Nothing usable anywhere.
  if (!listing || (!hasRealData(listing) && !listing.address)) {
    throw new ListingNotFoundError();
  }
  return listing;
}

// ── Manual address fallback ──────────────────────────────────────────────────
function parseAddress(raw: string): { address: string | null; suburb: string | null; city: string | null; region: string | null } {
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return {
    address: parts[0] ?? raw.trim() ?? null,
    suburb: parts[1] ?? null,
    city: parts[2] ?? parts[1] ?? null,
    region: parts[3] ?? null,
  };
}

/**
 * Recover a listing from a user-typed address — used when a URL can't be scraped
 * AND no address could be auto-detected. Searches OneRoof / realestate / homes /
 * the agency; if the property isn't for sale anywhere, it still proceeds on
 * public property data (never throws).
 */
export async function resolveListingByAddress(address: string): Promise<ScrapedListing> {
  const found = await searchListing({ address });
  const base = emptyListing(address, "unknown");

  if (found.found) {
    const merged = merge(base, found.fields);
    merged.address = merged.address ?? address;
    merged.scrapedOk = true;
    merged.dataSource = `Listing data found on ${found.source}.`;
    if (found.fields.photoUrls && found.fields.photoUrls.length > 0) merged.photoUrls = found.fields.photoUrls;
    return merged;
  }

  // Nothing for sale → analyse on public property data using just the address.
  const p = parseAddress(address);
  return {
    ...base,
    address: p.address,
    suburb: p.suburb,
    city: p.city,
    region: p.region,
    scrapedOk: true,
    dataSource: "No active listing found for this address — analysis based on public property data.",
  };
}
