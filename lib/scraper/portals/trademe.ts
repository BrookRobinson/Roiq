import * as cheerio from "cheerio";
import {
  ScrapedListing,
  emptyListing,
  PriceMethod,
  PropertyType,
  TitleType,
} from "../types";
import {
  scrapeFetch,
  extractJsonLd,
  stripHtml,
  parsePrice,
  parseArea,
  parseYear,
} from "../fetch";

// Trade Me listing URL patterns:
// https://www.trademe.co.nz/a/property/residential/sale/listing/XXXXXXX
// https://www.trademe.co.nz/a/property/residential/sale/auckland/.../listing/XXXXXXX

export function isTradeMeUrl(url: string): boolean {
  return /trademe\.co\.nz/.test(url) && /property/.test(url);
}

export function extractTradeMeId(url: string): string | null {
  const match = url.match(/listing[/-](\d+)/i);
  return match ? match[1] : null;
}

export async function scrapeTrademe(url: string): Promise<ScrapedListing> {
  const listing = emptyListing(url, "trademe");
  listing.listingId = extractTradeMeId(url);

  let html: string;
  try {
    html = await scrapeFetch(url);
  } catch (err) {
    listing.errorMessage = `Fetch failed: ${(err as Error).message}`;
    return listing;
  }

  const $ = cheerio.load(html);
  const jsonLd = extractJsonLd(html);

  // ── JSON-LD structured data (most reliable) ──────────────────────────
  const singleFamily = jsonLd.find(
    (d) => d["@type"] === "SingleFamilyResidence" || d["@type"] === "Residence" || d["@type"] === "RealEstateListing"
  );
  const product = jsonLd.find((d) => d["@type"] === "Product");

  if (singleFamily) {
    const sf = singleFamily as Record<string, unknown>;
    listing.address = (sf.name as string) || (sf.address as Record<string,string>)?.streetAddress || null;

    const addr = sf.address as Record<string, string> | undefined;
    if (addr) {
      listing.suburb = addr.addressLocality || null;
      listing.city = addr.addressRegion || null;
      listing.region = addr.addressRegion || null;
    }

    if (sf.floorSize) {
      const fs = sf.floorSize as Record<string, unknown>;
      listing.floorAreaSqm = typeof fs.value === "number" ? fs.value : parseArea(String(fs.value ?? ""));
    }

    if (sf.numberOfRooms) listing.bedrooms = Number(sf.numberOfRooms) || null;
    if (sf.numberOfBathroomsTotal) listing.bathrooms = Number(sf.numberOfBathroomsTotal) || null;
    if (sf.yearBuilt) listing.buildYear = parseYear(String(sf.yearBuilt));

    const images = sf.image as string[] | string | undefined;
    if (Array.isArray(images)) listing.photoUrls = images.slice(0, 30);
    else if (typeof images === "string") listing.photoUrls = [images];

    listing.description = sf.description ? stripHtml(sf.description as string).slice(0, 4000) : null;
  }

  // ── Cheerio fallbacks ─────────────────────────────────────────────────

  // Address
  if (!listing.address) {
    listing.address =
      $('[data-testid="listing-address"]').text().trim() ||
      $("h1.tm-property-listing-body__title").text().trim() ||
      $(".listing-title").text().trim() ||
      $("h1").first().text().trim() ||
      null;
  }

  // Price
  const priceText =
    $('[data-testid="buy-now-price"]').text().trim() ||
    $(".tm-property-listing-body__price").text().trim() ||
    $('[class*="price"]').first().text().trim() ||
    "";

  listing.priceText = priceText || null;

  if (priceText) {
    const lower = priceText.toLowerCase();
    if (lower.includes("auction")) {
      listing.priceMethod = "auction";
    } else if (lower.includes("deadline")) {
      listing.priceMethod = "deadline";
    } else if (lower.includes("tender")) {
      listing.priceMethod = "tender";
    } else if (lower.includes("enquir") || lower.includes("oeo") || lower.includes("offers over")) {
      listing.priceMethod = "enquiries_over";
      listing.askingPrice = parsePrice(priceText);
    } else if (lower.includes("by negotiation") || lower.includes("pbn")) {
      listing.priceMethod = "price_by_negotiation";
    } else {
      listing.priceMethod = "fixed";
      listing.askingPrice = parsePrice(priceText);
    }
  }

  // Bedrooms / bathrooms from attribute chips
  $("[data-testid='property-attribute'], .tm-property-listing-attributes__icon-value, [class*='attribute']").each(
    (_, el) => {
      const text = $(el).text().trim().toLowerCase();
      const num = parseInt(text, 10);
      if (isNaN(num)) return;
      if (text.includes("bed") || $(el).prev("[class*='bed']").length) {
        listing.bedrooms = listing.bedrooms ?? num;
      } else if (text.includes("bath")) {
        listing.bathrooms = listing.bathrooms ?? num;
      } else if (text.includes("car") || text.includes("park") || text.includes("garage")) {
        listing.carParks = listing.carParks ?? num;
      }
    }
  );

  // Fallback bedroom/bath from page text
  if (!listing.bedrooms) {
    const bedMatch = html.match(/(\d+)\s*bedroom/i);
    if (bedMatch) listing.bedrooms = parseInt(bedMatch[1], 10);
  }
  if (!listing.bathrooms) {
    const bathMatch = html.match(/(\d+)\s*bathroom/i);
    if (bathMatch) listing.bathrooms = parseInt(bathMatch[1], 10);
  }

  // Floor/land area
  if (!listing.floorAreaSqm) {
    const floorMatch = html.match(/floor\s*(?:area)?:?\s*([0-9,]+)\s*m/i);
    if (floorMatch) listing.floorAreaSqm = parseArea(floorMatch[0]);
  }
  const landMatch = html.match(/land\s*(?:area)?:?\s*([0-9,]+)\s*m/i);
  if (landMatch) listing.landAreaSqm = parseArea(landMatch[0]);

  // Property type
  listing.propertyType = detectPropertyType(html, listing.address);

  // Title type
  listing.titleType = detectTitleType(html);

  // Build year
  if (!listing.buildYear) {
    const yrMatch = html.match(/(?:built|year built|decade)[^0-9]*([12][0-9]{3})/i);
    if (yrMatch) listing.buildYear = parseYear(yrMatch[1]);
  }

  // Features list
  listing.features = extractFeatures($);

  // Agent
  listing.agentName =
    $('[data-testid="agent-name"]').text().trim() ||
    $(".agent-name, .tm-agent-profile__name").text().trim() ||
    null;

  listing.agencyName =
    $('[data-testid="agency-name"]').text().trim() ||
    $(".agency-name, .tm-agent-profile__office").text().trim() ||
    null;

  // Photos — try multiple sources
  if (listing.photoUrls.length === 0) {
    $("img[src*='tmsandbox'], img[src*='trademe'], img[src*='cdn'], [class*='gallery'] img, [class*='photo'] img").each(
      (_, el) => {
        const src = $(el).attr("src") || $(el).attr("data-src") || "";
        if (src && src.startsWith("http") && !src.includes("logo") && !src.includes("icon")) {
          listing.photoUrls.push(src);
        }
      }
    );
    // Remove duplicates
    listing.photoUrls = [...new Set(listing.photoUrls)].slice(0, 30);
  }

  // Days on market
  const domMatch = html.match(/(?:listed|on market)[^0-9]*(\d+)\s*day/i);
  if (domMatch) listing.daysOnMarket = parseInt(domMatch[1], 10);

  // RV/CV
  const rvMatch = html.match(/(?:RV|CV|capital value)[^$]*\$([0-9,]+)/i);
  if (rvMatch) listing.rvCv = parsePrice(rvMatch[1]);

  // Description fallback
  if (!listing.description) {
    const desc =
      $('[data-testid="listing-description"]').text().trim() ||
      $(".tm-property-listing-body__description").text().trim() ||
      $('[class*="description"]').first().text().trim();
    listing.description = desc ? desc.slice(0, 4000) : null;
  }

  listing.scrapedOk = !!(listing.address || listing.askingPrice || listing.photoUrls.length > 0);
  return listing;
}

// ── Helpers ────────────────────────────────────────────────────────────

function detectPropertyType(html: string, address: string | null): PropertyType {
  const text = (html + " " + (address ?? "")).toLowerCase();
  if (text.includes("townhouse") || text.includes("town house")) return "townhouse";
  if (text.includes("apartment") || text.includes("unit ") || text.includes("/")) return "apartment";
  if (text.includes("lifestyle") || text.includes("rural")) return "lifestyle";
  if (text.includes("section") || text.includes("vacant land")) return "section";
  if (text.includes("house") || text.includes("home")) return "house";
  return "unknown";
}

function detectTitleType(html: string): TitleType {
  const lower = html.toLowerCase();
  if (lower.includes("cross lease") || lower.includes("cross-lease")) return "cross_lease";
  if (lower.includes("unit title")) return "unit_title";
  if (lower.includes("leasehold")) return "leasehold";
  if (lower.includes("licence to occupy") || lower.includes("license to occupy")) return "licence_to_occupy";
  if (lower.includes("freehold")) return "freehold";
  return "unknown";
}

function extractFeatures($: cheerio.CheerioAPI): string[] {
  const features: string[] = [];
  const keywords = [
    "heat pump", "air conditioning", "double glazing", "double glazed", "dgunit",
    "insulation", "solar", "pool", "spa", "garage", "carport", "deck",
    "dishwasher", "alarm", "broadband", "fibre", "hob", "oven",
    "heat transfer", "wood fire", "log fire", "underfloor heating",
  ];

  const text = $("body").text().toLowerCase();
  keywords.forEach((kw) => {
    if (text.includes(kw)) features.push(kw);
  });

  return [...new Set(features)];
}
