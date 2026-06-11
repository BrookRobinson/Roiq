import { ScrapedListing, SupportedPortal } from "./types";
import { isTradeMeUrl, scrapeTrademe } from "./portals/trademe";
import { isRealestateUrl, scrapeRealestate } from "./portals/realestate";
import { isRayWhiteUrl, scrapeRayWhite } from "./portals/raywhite";
import { isProfessionalsUrl, scrapeProfessionals } from "./portals/professionals";
import { detectPortal, scrapeGeneric } from "./portals/generic";

export { type ScrapedListing } from "./types";

/**
 * Detects the portal from a URL and routes to the correct scraper.
 * Falls back to the generic scraper for unknown portals.
 */
export async function scrapeListingUrl(url: string): Promise<ScrapedListing> {
  const portal = detectPortalFromUrl(url);

  switch (portal) {
    case "trademe":
      return scrapeTrademe(url);
    case "realestate":
      return scrapeRealestate(url);
    case "raywhite":
      return scrapeRayWhite(url);
    case "professionals":
      return scrapeProfessionals(url);
    default:
      return scrapeGeneric(url, portal);
  }
}

export function detectPortalFromUrl(url: string): SupportedPortal {
  if (isTradeMeUrl(url))    return "trademe";
  if (isRealestateUrl(url)) return "realestate";
  if (isRayWhiteUrl(url))   return "raywhite";
  if (isProfessionalsUrl(url)) return "professionals";
  return detectPortal(url);
}

/**
 * Returns true if the URL looks like a supported NZ listing portal.
 */
export function isSupportedUrl(url: string): boolean {
  return detectPortalFromUrl(url) !== "unknown";
}

export const SUPPORTED_PORTALS = [
  { id: "trademe",        label: "Trade Me Property",  pattern: "trademe.co.nz/property" },
  { id: "realestate",     label: "realestate.co.nz",   pattern: "realestate.co.nz" },
  { id: "raywhite",       label: "Ray White",           pattern: "rwmetro.co.nz / rw*.co.nz" },
  { id: "harcourts",      label: "Harcourts",           pattern: "harcourts.net/nz" },
  { id: "bayleys",        label: "Bayleys",             pattern: "bayleys.co.nz" },
  { id: "barfoot",        label: "Barfoot & Thompson",  pattern: "barfoot.co.nz" },
  { id: "propertybrokers",label: "Property Brokers",    pattern: "propertybrokers.co.nz" },
  { id: "oneroof",        label: "OneRoof",             pattern: "oneroof.co.nz" },
  { id: "professionals",  label: "Professionals",       pattern: "professionals.co.nz/property-listing" },
] as const;
