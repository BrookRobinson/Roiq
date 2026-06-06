import * as cheerio from "cheerio";
import { ScrapedListing, emptyListing } from "../types";
import { scrapeFetch, extractJsonLd, stripHtml, parsePrice, parseArea, parseYear } from "../fetch";
import { detectPropertyType, detectTitleType, extractFeatures } from "./shared";

// Matches rwmetro.co.nz, rwhoikitika.co.nz, raywhite.co.nz etc.
export function isRayWhiteUrl(url: string): boolean {
  return /(?:rw[a-z]+\.co\.nz|raywhite\.co\.nz)/.test(url);
}

export async function scrapeRayWhite(url: string): Promise<ScrapedListing> {
  const listing = emptyListing(url, "raywhite");

  let html: string;
  try { html = await scrapeFetch(url); }
  catch (err) { listing.errorMessage = (err as Error).message; return listing; }

  const $ = cheerio.load(html);
  const jsonLd = extractJsonLd(html);

  // Ray White uses schema.org RealEstateListing or Product JSON-LD
  const schema = jsonLd.find((d) =>
    ["SingleFamilyResidence", "Residence", "RealEstateListing", "Product"].includes(d["@type"] as string)
  ) as Record<string, unknown> | undefined;

  if (schema) {
    const addr = schema.address as Record<string, string> | undefined;
    listing.address  = (schema.name as string) || addr?.streetAddress || null;
    listing.suburb   = addr?.addressLocality || null;
    listing.region   = addr?.addressRegion || null;
    listing.description = schema.description ? stripHtml(schema.description as string).slice(0, 4000) : null;
    const imgs = schema.image as string[] | string | undefined;
    if (Array.isArray(imgs)) listing.photoUrls = imgs.slice(0, 30);
    else if (typeof imgs === "string") listing.photoUrls = [imgs];
  }

  // Fallback
  if (!listing.address) {
    listing.address = $("h1.listing-details__title, h1[class*='address'], .property-title").text().trim() || $("h1").first().text().trim() || null;
  }

  const priceText = $("[class*='price']").first().text().trim();
  if (priceText) {
    listing.priceText = priceText;
    const lower = priceText.toLowerCase();
    listing.priceMethod = lower.includes("auction") ? "auction"
      : lower.includes("deadline") ? "deadline"
      : lower.includes("tender")   ? "tender"
      : lower.includes("enquir")   ? "enquiries_over"
      : "fixed";
    listing.askingPrice = parsePrice(priceText);
  }

  const bedMatch = html.match(/(\d+)\s*bed/i);
  if (bedMatch) listing.bedrooms = parseInt(bedMatch[1], 10);
  const bathMatch = html.match(/(\d+)\s*bath/i);
  if (bathMatch) listing.bathrooms = parseInt(bathMatch[1], 10);

  const floorMatch = html.match(/floor[^0-9]*([0-9,]+)\s*m/i);
  if (floorMatch) listing.floorAreaSqm = parseArea(floorMatch[0]);
  const landMatch = html.match(/land[^0-9]*([0-9,]+)\s*m/i);
  if (landMatch) listing.landAreaSqm = parseArea(landMatch[0]);

  if (listing.photoUrls.length === 0) {
    $("img[src*='raywhite'], img[src*='cloudfront'], [class*='gallery'] img, [class*='carousel'] img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      if (src.startsWith("http") && !src.includes("logo")) listing.photoUrls.push(src);
    });
    listing.photoUrls = [...new Set(listing.photoUrls)].slice(0, 30);
  }

  listing.agentName  = $("[class*='agent-name'], .agent__name").first().text().trim() || null;
  listing.agencyName = $("[class*='office'], .agency-name").first().text().trim() || null;
  listing.propertyType = detectPropertyType(html, listing.address);
  listing.titleType    = detectTitleType(html);
  listing.features     = extractFeatures($);
  if (!listing.buildYear) {
    const yrMatch = html.match(/(?:built|year)[^0-9]*([12][0-9]{3})/i);
    if (yrMatch) listing.buildYear = parseYear(yrMatch[1]);
  }

  listing.scrapedOk = !!(listing.address || listing.photoUrls.length > 0);
  return listing;
}
