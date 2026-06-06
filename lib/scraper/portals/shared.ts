import type { CheerioAPI } from "cheerio";
import type { PropertyType, TitleType } from "../types";

export function detectPropertyType(html: string, address: string | null): PropertyType {
  const text = (html + " " + (address ?? "")).toLowerCase();
  if (text.includes("townhouse") || text.includes("town house")) return "townhouse";
  if (text.includes("apartment")) return "apartment";
  if (text.match(/\bunit\b/)) return "unit";
  if (text.includes("lifestyle") || text.includes("rural")) return "lifestyle";
  if (text.includes("section") || text.includes("vacant land")) return "section";
  if (text.includes("house") || text.includes("home") || text.includes("bungalow") || text.includes("villa")) return "house";
  return "unknown";
}

export function detectTitleType(html: string): TitleType {
  const lower = html.toLowerCase();
  if (lower.includes("cross lease") || lower.includes("cross-lease")) return "cross_lease";
  if (lower.includes("unit title")) return "unit_title";
  if (lower.includes("leasehold")) return "leasehold";
  if (lower.includes("licence to occupy") || lower.includes("license to occupy")) return "licence_to_occupy";
  if (lower.includes("freehold")) return "freehold";
  return "unknown";
}

const FEATURE_KEYWORDS = [
  "heat pump", "air conditioning", "double glazing", "double glazed",
  "ceiling insulation", "underfloor insulation", "solar panels", "solar hot water",
  "swimming pool", "spa pool", "log fire", "wood fire", "open fire",
  "heat transfer", "underfloor heating", "ducted heating",
  "double garage", "single garage", "internal access garage", "carport",
  "deck", "patio", "outdoor entertaining", "fenced",
  "dishwasher", "alarm system", "security system", "cctv",
  "fibre broadband", "broadband", "smart home",
  "ensuite", "walk-in wardrobe", "walk-in robe",
];

export function extractFeatures($: CheerioAPI): string[] {
  const text = $("body").text().toLowerCase();
  return FEATURE_KEYWORDS.filter((kw) => text.includes(kw));
}
