/**
 * Generic scraper — handles Harcourts, Bayleys, Barfoot, Property Brokers, OneRoof.
 * Uses JSON-LD first, then common CSS patterns and regex fallbacks.
 * Good enough to extract the key data from most NZ real estate portals.
 */

import * as cheerio from "cheerio";
import { ScrapedListing, emptyListing, SupportedPortal } from "../types";
import { scrapeFetch, extractJsonLd, stripHtml, parsePrice, parseArea, parseQuantitativeArea, extractAreaFromJson, parseYear } from "../fetch";
import { detectPropertyType, detectTitleType, extractFeatures } from "./shared";

export function detectPortal(url: string): SupportedPortal {
  if (/harcourts\.net|harcourts\.co\.nz/.test(url))      return "harcourts";
  if (/bayleys\.co\.nz/.test(url))                        return "bayleys";
  if (/barfoot\.co\.nz/.test(url))                        return "barfoot";
  if (/propertybrokers\.co\.nz/.test(url))                return "propertybrokers";
  if (/oneroof\.co\.nz/.test(url))                        return "oneroof";
  return "unknown";
}

export async function scrapeGeneric(url: string, portal: SupportedPortal): Promise<ScrapedListing> {
  const listing = emptyListing(url, portal);

  let html: string;
  try { html = await scrapeFetch(url); }
  catch (err) { listing.errorMessage = (err as Error).message; return listing; }

  const $ = cheerio.load(html);
  const jsonLd = extractJsonLd(html);

  // ── JSON-LD (works on ~80% of portals) ────────────────────────────────
  const schema = jsonLd.find((d) =>
    ["SingleFamilyResidence", "Residence", "Apartment", "RealEstateListing", "Product", "Place"].includes(
      d["@type"] as string
    )
  ) as Record<string, unknown> | undefined;

  if (schema) {
    const addr = schema.address as Record<string, string> | undefined;
    // Prefer the real street address. Agency sites put a MARKETING TITLE in schema.name
    // ("Central Fox Glacier Living") — never use that as the address (it breaks the
    // address-specific location scoring). schema.name is only a last resort below.
    listing.address     = addr?.streetAddress || null;
    listing.suburb      = addr?.addressLocality || null;
    listing.city        = addr?.addressRegion || null;
    listing.region      = addr?.addressRegion || null;
    listing.description = schema.description ? stripHtml(schema.description as string).slice(0, 4000) : null;
    if (schema.yearBuilt) listing.buildYear = parseYear(String(schema.yearBuilt));

    // Property type from the schema @type — authoritative, and avoids matching a
    // stray "apartment" in nav/footer text (which turned a villa into an apartment).
    const stype = String(schema["@type"] ?? "");
    if (/Apartment/i.test(stype)) listing.propertyType = "apartment";
    else if (/SingleFamilyResidence|House|Residence/i.test(stype)) listing.propertyType = "house";

    const imgs = schema.image as string[] | string | undefined;
    if (Array.isArray(imgs)) listing.photoUrls = imgs.slice(0, 30);
    else if (typeof imgs === "string") listing.photoUrls = [imgs];

    // Schema.org numberOfRooms / bathroomsTotal
    if (schema.numberOfRooms)         listing.bedrooms  = Number(schema.numberOfRooms) || null;
    if (schema.numberOfBathroomsTotal) listing.bathrooms = Number(schema.numberOfBathroomsTotal) || null;

    // floorSize.value is often a bare numeric STRING ("330", unitCode "MTK") — the
    // suffix-requiring parseArea drops those, so use the quantitative-aware parser.
    const fs = schema.floorSize as Record<string, unknown> | undefined;
    if (fs) listing.floorAreaSqm = parseQuantitativeArea(fs.value, fs.unitCode as string | undefined);

    // Land/lot size, when the schema carries it (key varies by portal).
    const ls = (schema.lotSize ?? schema.landSize) as Record<string, unknown> | string | number | undefined;
    if (ls != null) {
      listing.landAreaSqm = typeof ls === "object"
        ? parseQuantitativeArea((ls as Record<string, unknown>).value, (ls as Record<string, unknown>).unitCode as string | undefined)
        : parseQuantitativeArea(ls);
    }
  }

  // ── Headline selectors (common patterns across NZ portals) ─────────────
  if (!listing.address) {
    const addrEl = $("h1.property-address, h1.listing-address, h1[class*='address'], [class*='property-title'] h1").text().trim();
    // Only accept an h1 that LOOKS like a street address; a marketing headline
    // ("Central Fox Glacier Living") is not an address — pull one from the page text.
    listing.address = addrEl || streetAddressFrom($("h1").first().text()) || streetAddressFrom(stripHtml(html)) || null;
  }

  // Price — try many class patterns used across portals
  const priceSelectors = [
    "[class*='price--main']", "[class*='price-display']", "[class*='listing-price']",
    "[data-testid*='price']", "[class*='asking-price']", ".price", ".listing__price",
  ];
  // Prefer a keyword-anchored asking price ("Enquiries Over $395,000") over a stray
  // price element or the first $ figure — agency sites often show an unrelated number
  // (a CV, a finance widget) that the loose scans would grab first (seen: $495k vs $395k).
  let priceText = askingPriceText(html);
  if (!priceText) {
    for (const sel of priceSelectors) {
      const t = $(sel).first().text().trim();
      if (t) { priceText = t; break; }
    }
  }
  if (!priceText) priceText = extractPriceFromText(html);

  if (priceText) {
    listing.priceText = priceText;
    const lower = priceText.toLowerCase();
    listing.priceMethod = lower.includes("auction")   ? "auction"
      : lower.includes("deadline")                    ? "deadline"
      : lower.includes("tender")                      ? "tender"
      : lower.includes("enquir") || lower.includes("oeo") || lower.includes("offers over") ? "enquiries_over"
      : lower.includes("by negotiation")              ? "price_by_negotiation"
      : "fixed";
    listing.askingPrice = parsePrice(priceText);
  }

  // Beds / baths from text
  if (!listing.bedrooms) {
    const m = html.match(/(\d)\s*(?:bedroom|bed(?!\w))/i);
    if (m) listing.bedrooms = parseInt(m[1], 10);
  }
  if (!listing.bathrooms) {
    const m = html.match(/(\d)\s*(?:bathroom|bath(?!\w))/i);
    if (m) listing.bathrooms = parseInt(m[1], 10);
  }
  if (!listing.carParks) {
    const m = html.match(/(\d)\s*(?:car\s*park|garage)/i);
    if (m) listing.carParks = parseInt(m[1], 10);
  }

  // Areas. Prefer the explicit JSON fields portals embed (floorAreaString":"97m²",
  // landAreaString":"1,012m²") — the loose text scan below can otherwise grab an
  // unrelated number near the first "floor"/"land" word in the page.
  if (!listing.floorAreaSqm) {
    listing.floorAreaSqm = extractAreaFromJson(html, [
      "floorArea", "floorAreaString", "floorAreaSqm", "floor_area_sqm", "floor_area", "floorSize", "buildingArea", "internalArea",
    ]);
  }
  if (!listing.landAreaSqm) {
    listing.landAreaSqm = extractAreaFromJson(html, [
      "landArea", "landAreaString", "landAreaSqm", "land_area_sqm", "land_area", "lotSize", "siteArea", "sectionSize",
    ]);
  }
  if (!listing.floorAreaSqm) {
    const m = html.match(/floor\s*(?:area|size)[^0-9]{0,12}([0-9][0-9,]*)\s*m/i);
    if (m) { const n = parseFloat(m[1].replace(/,/g, "")); if (n > 0) listing.floorAreaSqm = n; }
  }
  if (!listing.floorAreaSqm) {
    const m = html.match(/(?:floor|internal|house)\s*(?:area)?[^0-9]*([0-9,]+)\s*m/i);
    if (m) listing.floorAreaSqm = parseArea(m[0]);
  }
  if (!listing.landAreaSqm) {
    const m = html.match(/(?:land|section)\s*(?:area|size)[^0-9]{0,12}([0-9][0-9,]*)\s*m/i);
    if (m) { const n = parseFloat(m[1].replace(/,/g, "")); if (n > 0) listing.landAreaSqm = n; }
  }
  if (!listing.landAreaSqm) {
    const m = html.match(/(?:land|section|site)\s*(?:area)?[^0-9]*([0-9,]+)\s*m/i);
    if (m) listing.landAreaSqm = parseArea(m[0]);
  }

  // Build year
  if (!listing.buildYear) {
    const m = html.match(/(?:built|year\s*built|circa|c\.?)\s*([12][0-9]{3})/i);
    if (m) listing.buildYear = parseYear(m[1]);
  }

  // Photos — start with JSON-LD images, then expand the gallery by matching the
  // hero image's directory. This captures relative / lazy-loaded gallery srcs
  // that portals like Property Brokers keep out of JSON-LD, without pulling in
  // logos, agent headshots, or related-listing thumbnails.
  const photoByPath = new Map<string, string>();
  const keyOf = (abs: string): string => {
    try { const u = new URL(abs); return u.origin + u.pathname; } catch { return abs; }
  };
  const add = (abs: string) => {
    const k = keyOf(abs);
    // Store the clean path (no ?width/quality token) — portals like Property
    // Brokers serve a heavily-compressed gallery variant but the bare path
    // returns the full-resolution original, which matters for condition analysis.
    if (!photoByPath.has(k)) photoByPath.set(k, k);
  };
  const resolve = (raw: string | undefined): string | null => {
    const t = (raw || "").trim();
    if (!t || t.startsWith("data:")) return null;
    if (/logo|icon|avatar|sprite|placeholder|loading/i.test(t)) return null;
    try { const abs = new URL(t, url).href; return /^https?:/i.test(abs) ? abs : null; } catch { return null; }
  };

  // Seed with JSON-LD images (resolved + deduped)
  for (const p of listing.photoUrls) { const a = resolve(p); if (a) add(a); }

  // Directory of the hero image — used to keep the gallery sweep on-subject
  const hero = listing.photoUrls[0] ? resolve(listing.photoUrls[0]) : null;
  const heroDir = hero ? hero.slice(0, hero.lastIndexOf("/") + 1) : null;

  $("img").each((_, el) => {
    const w = parseInt($(el).attr("width") ?? "999", 10);
    if (!(w > 200 || isNaN(w))) return; // skip thumbnails / tracking pixels
    const abs = resolve(
      $(el).attr("src") ||
        $(el).attr("data-src") ||
        $(el).attr("data-lazy-src") ||
        $(el).attr("data-cascade-src") ||
        ""
    );
    if (!abs) return;
    // With a hero image, only collect gallery images that live in the same
    // directory; otherwise fall back to the broad sweep (legacy behaviour).
    if (heroDir) { if (abs.startsWith(heroDir)) add(abs); } else { add(abs); }
  });

  listing.photoUrls = [...photoByPath.values()].slice(0, 30);

  // Agent
  listing.agentName  = $("[class*='agent-name'], [class*='consultant-name'], .agent__name").first().text().trim() || null;
  listing.agencyName = $("[class*='agency'], [class*='office-name'], [class*='brand-name']").first().text().trim() || null;

  // Description
  if (!listing.description) {
    const desc = $("[class*='description'], [class*='listing-text'], .property-description").text().trim();
    listing.description = desc.slice(0, 4000) || null;
  }

  // RV/CV
  const rvMatch = html.match(/(?:RV|CV|capital value)[^$\d]*\$?([0-9,]+)/i);
  if (rvMatch) { const rv = parsePrice(rvMatch[1]); if (rv && rv >= 10000) listing.rvCv = rv; } // ignore junk like "CV...100"

  // Days on market
  const domMatch = html.match(/(\d+)\s*day[s]?\s*(?:on market|listed)/i);
  if (domMatch) listing.daysOnMarket = parseInt(domMatch[1], 10);

  if (listing.propertyType === "unknown") listing.propertyType = detectPropertyType(html, listing.address);
  listing.titleType    = detectTitleType(html);
  listing.features     = extractFeatures($);

  listing.scrapedOk = !!(listing.address || listing.askingPrice || listing.photoUrls.length > 0);
  return listing;
}

function extractPriceFromText(html: string): string {
  const m = html.match(/\$\s?[0-9,]{4,}/);
  return m ? m[0] : "";
}

// A NZ street address ("13 Main Road", "23a Oxford Street, Taylorville") — used so a
// marketing headline is never mistaken for the property address.
const STREET_RE = /\b\d+[a-zA-Z]?\s+(?:[A-Z][a-zA-Z'-]+\s+){1,3}(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Lane|Ln|Place|Pl|Terrace|Tce|Way|Crescent|Cres|Close|Court|Ct|Highway|Hwy|Grove|Parade|Quay|Esplanade|Track|Rise|Heights|Bay)\b(?:,\s*[A-Z][a-zA-Z'-]+(?:\s[A-Z][a-zA-Z'-]+)?)?/;
function streetAddressFrom(text: string): string | null {
  const m = (text || "").replace(/\s+/g, " ").match(STREET_RE);
  return m ? m[0].trim().replace(/[,\s]+$/, "") : null;
}

// The CURRENT asking price, anchored to a price-method keyword ("Enquiries Over
// $395,000", "Offers Over $X", "Asking $X", "By Negotiation $X"). Returning the whole
// phrase lets the caller detect the price method AND parse the figure — and it avoids
// grabbing an unrelated $ number (a CV, rates, a finance widget) elsewhere on the page.
function askingPriceText(html: string): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  const m = text.match(
    /(?:enquiries?\s*over|offers?\s*over|oeo|beo|buyer\s*enquiry|asking(?:\s*price)?|deadline\s*sale|price\s*by\s*negotiation|by\s*negotiation|tender|auction)[^$\d]{0,18}\$?\s*[0-9][0-9,]{3,}/i
  );
  return m ? m[0].replace(/\s+/g, " ").trim() : "";
}
