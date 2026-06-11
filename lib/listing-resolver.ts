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
    daysOnMarket: f.daysOnMarket ?? base.daysOnMarket,
  };
}

// "retrieved June 2026" — so a cited source always carries when it was pulled.
function retrievedStamp(): string {
  return new Date().toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
}

export async function resolveListing(url: string): Promise<ScrapedListing> {
  const portal = detectPortalFromUrl(url);
  let listing: ScrapedListing | null = null;

  // TradeMe actively blocks bots → skip straight to web-search. EVERYTHING else —
  // known portals AND unknown URLs — gets a direct scrape attempt first: the generic
  // scraper (JSON-LD + CSS/regex) handles most server-rendered NZ agency sites
  // (e.g. professionals.co.nz), and we fall back to web-search below if it yields
  // nothing real. Scraping the URL the user actually gave beats a flaky search.
  if (portal !== "trademe") {
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

  // Nothing usable anywhere. A scrape that pulled PHOTOS is still usable — the vision
  // analysis runs on them even when price/beds didn't parse (e.g. a HubSpot agency
  // site), so don't discard a photo-rich result just because fields are thin.
  if (!listing || (!hasRealData(listing) && !listing.address && listing.photoUrls.length === 0)) {
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
  const p = parseAddress(address);
  const f = found.fields;

  // Currently for sale → use the live listing.
  if (found.found) {
    const merged = merge(base, f);
    merged.address = merged.address ?? address;
    merged.scrapedOk = true;
    merged.dataSource = `Listing data sourced from ${found.source} — retrieved ${retrievedStamp()}.`;
    if (f.photoUrls && f.photoUrls.length > 0) merged.photoUrls = f.photoUrls;
    return merged;
  }

  // Not currently for sale, but the search surfaced property facts (a past sale or a
  // property-data record) → analyse on those + public data. NEVER carry a past sale
  // price through as a current asking price.
  const hasFacts = f.bedrooms != null || f.bathrooms != null || f.floorAreaSqm != null || f.landAreaSqm != null || f.buildYear != null || !!f.description;
  const publicDataNote = "Analysis uses public property data — council records / CV, homes.co.nz and comparable sales where available.";
  if (hasFacts) {
    const merged = merge(base, f);
    merged.address = merged.address ?? address;
    merged.suburb = merged.suburb ?? p.suburb;
    merged.city = merged.city ?? p.city;
    merged.region = merged.region ?? p.region;
    merged.askingPrice = null; // a past sale price is not a current asking price
    merged.priceText = null;
    merged.scrapedOk = true;
    const src = found.source ? ` Property details from ${found.source} (public / past-sale record).` : "";
    merged.dataSource = `No active listing found for this address.${src} ${publicDataNote}`;
    if (f.photoUrls && f.photoUrls.length > 0) merged.photoUrls = f.photoUrls;
    return merged;
  }

  // Nothing at all → analyse on the bare address + public data.
  return {
    ...base,
    address: p.address,
    suburb: p.suburb,
    city: p.city,
    region: p.region,
    scrapedOk: true,
    dataSource: `No active listing found for this address. ${publicDataNote}`,
  };
}
