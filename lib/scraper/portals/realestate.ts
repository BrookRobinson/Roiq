import * as cheerio from "cheerio";
import { ScrapedListing, emptyListing } from "../types";
import {
  scrapeFetch,
  extractJsonLd,
  stripHtml,
  parsePrice,
  parseArea,
  parseYear,
} from "../fetch";
import { detectPropertyType, detectTitleType, extractFeatures } from "./shared";

// realestate.co.nz URL pattern:
// https://www.realestate.co.nz/residential/sale/auckland/suburb/ADDRESS-XXXXXXX

export function isRealestateUrl(url: string): boolean {
  return /realestate\.co\.nz/.test(url);
}

export async function scrapeRealestate(url: string): Promise<ScrapedListing> {
  const listing = emptyListing(url, "realestate");

  // Extract listing ID from URL
  const idMatch = url.match(/-(\d{6,})(?:\?|$|\/)/);
  listing.listingId = idMatch ? idMatch[1] : null;

  let html: string;
  try {
    html = await scrapeFetch(url);
  } catch (err) {
    listing.errorMessage = `Fetch failed: ${(err as Error).message}`;
    return listing;
  }

  const $ = cheerio.load(html);
  const jsonLd = extractJsonLd(html);

  // ── JSON-LD ────────────────────────────────────────────────────────────
  const residence = jsonLd.find(
    (d) => ["SingleFamilyResidence", "Residence", "Apartment", "RealEstateListing"].includes(d["@type"] as string)
  );

  if (residence) {
    const r = residence as Record<string, unknown>;
    const addr = r.address as Record<string, string> | undefined;
    if (addr) {
      listing.address   = addr.streetAddress || null;
      listing.suburb    = addr.addressLocality || null;
      listing.city      = addr.addressRegion || null;
      listing.region    = addr.addressRegion || null;
    }
    listing.description = r.description ? stripHtml(r.description as string).slice(0, 4000) : null;
    if (r.yearBuilt) listing.buildYear = parseYear(String(r.yearBuilt));

    const images = r.image as string[] | string | undefined;
    if (Array.isArray(images)) listing.photoUrls = images.slice(0, 30);
    else if (typeof images === "string") listing.photoUrls = [images];
  }

  // ── Cheerio fallbacks ──────────────────────────────────────────────────

  if (!listing.address) {
    listing.address =
      $("h1.property-address, h1[class*='address'], [data-test='address']").text().trim() ||
      $("h1").first().text().trim() ||
      null;
  }

  // Price
  const priceEl =
    $("[data-test='price'], [class*='price--display'], .price-display").first().text().trim() ||
    $("[class*='price']").first().text().trim();

  if (priceEl) {
    listing.priceText = priceEl;
    const lower = priceEl.toLowerCase();
    if (lower.includes("auction"))        listing.priceMethod = "auction";
    else if (lower.includes("deadline"))  listing.priceMethod = "deadline";
    else if (lower.includes("tender"))    listing.priceMethod = "tender";
    else if (lower.includes("enquir") || lower.includes("by negotiation")) {
      listing.priceMethod = "enquiries_over";
      listing.askingPrice = parsePrice(priceEl);
    } else {
      listing.priceMethod = "fixed";
      listing.askingPrice = parsePrice(priceEl);
    }
  }

  // Beds / baths / cars — read the digit ADJACENT to each keyword, not parseInt of
  // the whole element (a "feature" container can read "481 m² · 2 bed · 1 bath",
  // where parseInt(text) = 481 and would land in bedrooms).
  $("[class*='feature'], [class*='stat'], [data-test*='bedroom'], [data-test*='bathroom'], [data-test*='bed'], [data-test*='bath'], [data-test*='car']").each(
    (_, el) => {
      const text = $(el).text().trim().toLowerCase();
      const bed  = text.match(/(\d+)\s*(?:bed)/);
      const bath = text.match(/(\d+)\s*(?:bath)/);
      const car  = text.match(/(\d+)\s*(?:car|garage|park)/);
      if (bed)  listing.bedrooms  = listing.bedrooms  ?? parseInt(bed[1], 10);
      if (bath) listing.bathrooms = listing.bathrooms ?? parseInt(bath[1], 10);
      if (car)  listing.carParks  = listing.carParks  ?? parseInt(car[1], 10);
    }
  );

  // Fallback from raw text
  if (!listing.bedrooms) {
    const m = html.match(/(\d+)\s*bed/i);
    if (m) listing.bedrooms = parseInt(m[1], 10);
  }
  if (!listing.bathrooms) {
    const m = html.match(/(\d+)\s*bath/i);
    if (m) listing.bathrooms = parseInt(m[1], 10);
  }

  // Areas
  if (!listing.floorAreaSqm) {
    const m = html.match(/floor[^0-9]*([0-9,]+)\s*m/i);
    if (m) listing.floorAreaSqm = parseArea(m[0]);
  }
  const lm = html.match(/land[^0-9]*([0-9,]+)\s*m/i);
  if (lm) listing.landAreaSqm = parseArea(lm[0]);

  // Photos
  if (listing.photoUrls.length === 0) {
    $("img[src*='realestate'], img[src*='cloudfront'], img[src*='cdn'], [class*='gallery'] img").each(
      (_, el) => {
        const src = $(el).attr("src") || $(el).attr("data-src") || "";
        if (src && src.startsWith("http") && !src.includes("logo")) {
          listing.photoUrls.push(src);
        }
      }
    );
    listing.photoUrls = [...new Set(listing.photoUrls)].slice(0, 30);
  }

  // Agent
  listing.agentName  = $("[class*='agent-name'], [data-test='agent-name']").first().text().trim() || null;
  listing.agencyName = $("[class*='agency-name'], [class*='office-name']").first().text().trim() || null;

  listing.propertyType = detectPropertyType(html, listing.address);
  listing.titleType    = detectTitleType(html);
  listing.features     = extractFeatures($);

  const rvMatch = html.match(/(?:RV|CV|capital value)[^$]*\$([0-9,]+)/i);
  if (rvMatch) listing.rvCv = parsePrice(rvMatch[1]);

  if (!listing.description) {
    listing.description = $("[class*='description'], [data-test='description']").text().trim().slice(0, 4000) || null;
  }

  listing.scrapedOk = !!(listing.address || listing.askingPrice || listing.photoUrls.length > 0);
  return listing;
}
