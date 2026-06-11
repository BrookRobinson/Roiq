/**
 * Professionals (professionals.co.nz) — a HubSpot site with NO JSON-LD and a
 * "similar properties" carousel of OTHER listings that traps the generic scraper
 * (it grabbed a neighbouring card's "SOLD"/price). This reads the MAIN listing
 * only: address from og:title, the authoritative status from the .property-content
 * data-status attr, the price from the main .price span (NOT the carousel
 * .property-price cards), beds/baths/land/floor from .property-features, and only
 * the main listing's own photo gallery (matched by its listing id).
 */

import * as cheerio from "cheerio";
import { ScrapedListing, emptyListing } from "../types";
import { scrapeFetch, parsePrice, parseArea } from "../fetch";
import { detectPropertyType, detectTitleType } from "./shared";

export function isProfessionalsUrl(url: string): boolean {
  return /professionals\.co\.nz\/property-listing\//i.test(url);
}

export async function scrapeProfessionals(url: string): Promise<ScrapedListing> {
  const listing = emptyListing(url, "professionals");

  let html: string;
  try {
    html = await scrapeFetch(url);
  } catch (err) {
    listing.errorMessage = (err as Error).message;
    return listing;
  }

  const $ = cheerio.load(html);
  const og = (p: string) => $(`meta[property="${p}"]`).attr("content")?.trim() || null;

  // Address — og:title is the clean "Street, Suburb, City, Region".
  listing.address = og("og:title");
  if (listing.address) {
    const parts = listing.address.split(",").map((s) => s.trim()).filter(Boolean);
    listing.suburb = parts[1] ?? null;
    listing.city = parts[2] ?? parts[1] ?? null;
    listing.region = parts[3] ?? parts[2] ?? null;
  }

  // Description — og:description / meta description, else the on-page block.
  listing.description =
    (og("og:description") || $('meta[name="description"]').attr("content")?.trim() || $(".featureDescription .desc").text().trim() || "")
      .slice(0, 4000) || null;

  // Main listing container carries the authoritative status (sold / for sale).
  const main = $(".property-content").first();
  const status = (main.attr("data-status") || "").toLowerCase();

  // Price / status — the MAIN .price span, NOT the carousel cards' .property-price.
  const priceText = (main.find(".price").first().text() || $(".price").first().text()).replace(/\s+/g, " ").trim();
  const isSold = status.includes("sold") || /\b(sold|under offer)\b/i.test(priceText);
  if (priceText && !isSold) {
    listing.priceText = priceText;
    const lower = priceText.toLowerCase();
    listing.priceMethod = lower.includes("auction")
      ? "auction"
      : lower.includes("deadline")
        ? "deadline"
        : lower.includes("tender")
          ? "tender"
          : lower.includes("enquir") || lower.includes("offers over") || lower.includes("oeo")
            ? "enquiries_over"
            : lower.includes("negotiation")
              ? "price_by_negotiation"
              : "fixed";
    listing.askingPrice = parsePrice(priceText);
  } else if (isSold) {
    // Sold / under offer → record the status but NO asking price (it isn't for sale).
    listing.priceText = priceText || "Sold";
  }

  // Features — .property-features .singleFeature.{bedroom|bathroom|garage|car|land|floor} .number
  $(".property-features .singleFeature").each((_, el) => {
    const cls = ($(el).attr("class") || "").toLowerCase();
    const numText = $(el).find(".number").first().text().replace(/\s+/g, " ").trim();
    const n = parseInt(numText.replace(/,/g, ""), 10);
    if (cls.includes("bedroom")) {
      if (Number.isFinite(n)) listing.bedrooms = n;
    } else if (cls.includes("bathroom")) {
      if (Number.isFinite(n)) listing.bathrooms = n;
    } else if (cls.includes("garage") || cls.includes("car")) {
      if (Number.isFinite(n)) listing.carParks = n;
    } else if (cls.includes("land")) {
      listing.landAreaSqm = parseArea(numText) ?? listing.landAreaSqm;
    } else if (cls.includes("floor")) {
      listing.floorAreaSqm = parseArea(numText) ?? listing.floorAreaSqm;
    }
  });

  // Photos — only the MAIN listing's gallery (matched by its listing id), full-res
  // (drop the HubSpot /hs-fs resizer prefix + any ?width query). Carousel cards use
  // OTHER listing ids and are excluded.
  const ogImg = og("og:image") || "";
  const listingId = ogImg.match(/property_images\/([^/?]+)/i)?.[1] || url.match(/-([a-z]{2,6}\d{3,})\/?(?:[?#]|$)/i)?.[1] || null;
  listing.listingId = listingId;

  const photos = new Set<string>();
  $("img").each((_, el) => {
    const raw = ($(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src") || "").trim();
    if (!/\/hubfs\/property_images\//i.test(raw)) return;
    if (listingId && !raw.toLowerCase().includes(`property_images/${listingId.toLowerCase()}/`)) return;
    try {
      const u = new URL(raw, url);
      const clean = u.origin + u.pathname.replace(/^\/hs-fs/, "");
      if (/\.(jpe?g|png|webp)$/i.test(clean) && !/loading|logo|icon|sprite|placeholder/i.test(clean)) photos.add(clean);
    } catch {
      /* skip unparseable src */
    }
  });
  listing.photoUrls = [...photos].slice(0, 30);

  listing.propertyType = detectPropertyType(html, listing.address);
  listing.titleType = detectTitleType(html);

  listing.scrapedOk = !!(listing.address || listing.askingPrice || listing.bedrooms || listing.photoUrls.length > 0);
  return listing;
}
