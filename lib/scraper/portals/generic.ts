/**
 * Generic scraper — handles Harcourts, Bayleys, Barfoot, Property Brokers, OneRoof.
 * Uses JSON-LD first, then common CSS patterns and regex fallbacks.
 * Good enough to extract the key data from most NZ real estate portals.
 */

import * as cheerio from "cheerio";
import { ScrapedListing, emptyListing, SupportedPortal, PriceMethod, PropertyType } from "../types";
import { scrapeFetch, extractJsonLd, stripHtml, parsePrice, parseArea, parseQuantitativeArea, extractAreaFromJson, parseYear } from "../fetch";
import { detectPropertyType, detectTitleType, extractFeatures } from "./shared";

/**
 * A floor area published as exactly 0, in any of the escaped JSON shapes the
 * portals embed (`floorAreaString\":\"0m²`, `"floor_area": 0`). Anchored on a
 * zero that is immediately followed by a unit or a delimiter so that a real
 * "0" never comes from the middle of "1,097m²".
 */
const STATED_ZERO_FLOOR_AREA = /\bfloor_?area(?:string|sqm|_sqm)?\\?"?\s*:\s*\\?"?\s*0\s*(?:m|"|\\|,|})/i;

/**
 * The portal's own category for the listing — `"category":"Section"`.
 *
 * This is the trustworthy signal for what kind of property it is, and the page
 * <title> is not: OneRoof files sections under "Houses for Sale" too, so the
 * title says "House" for a bare paddock.
 */
const PORTAL_CATEGORY = /"category\\?"?\s*:\s*\\?"([A-Za-z ]{3,30})/i;

/** Portal category → our property type. Only the unambiguous ones. */
const CATEGORY_TYPES: Record<string, PropertyType> = {
  section: "section",
  land: "section",
  "bare land": "section",
  house: "house",
  townhouse: "townhouse",
  apartment: "apartment",
  unit: "unit",
  lifestyle: "lifestyle",
};

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
  // (a CV, a finance widget, a weekly-rent estimate) that the loose scans would grab first
  // (seen: $495k vs $395k; and a stray "$1,460/wk" read as the asking price).
  //
  // OneRoof is the exception for the LOOSE scans: its pages embed 45+ nearby and
  // related-listing prices, so a page-wide scan returns a neighbour's (seen: a
  // $2.099m listing scraped as $380k).
  //
  // It is NOT an exception for the heading-anchored scan below. That reason used
  // to be "the subject listing's own price loads client-side and is absent from
  // the server HTML" — that is no longer true: the price now renders in a span
  // directly after the address <h1>, and skipping it meant a report telling the
  // buyer to "add a price" on a page displaying $599,000. Anchoring to the h1 is
  // what makes it safe: 600 characters after the subject property's own address
  // cannot reach a related-listing carousel.
  const scanPrice = portal !== "oneroof";
  let priceText = scanPrice ? askingPriceText(html) : "";
  if (scanPrice && !priceText) {
    for (const sel of priceSelectors) {
      const t = $(sel).first().text().trim();
      if (t) { priceText = t; break; }
    }
  }
  // A "By Negotiation" / POA listing carries no number — detect the phrasing so it's
  // labelled correctly instead of falling through and grabbing an unrelated $ figure.
  if (scanPrice && (!priceText || !/\$\s?[0-9]/.test(priceText))) {
    const neg = negotiationPriceText(html);
    if (neg) priceText = neg;
  }
  if (scanPrice && !priceText) priceText = extractPriceFromText(html);
  // A plainly advertised price with no keyword in front of it. OneRoof puts the
  // figure in its own span directly after the address <h1> — "$599,000", nothing
  // else — so every keyword-anchored pattern above walks past it and the report
  // then asks the buyer to type in a price the page is displaying. Anchored to
  // the h1 so it can't pick up a CV, a rates figure or a finance widget.
  if (!priceText) priceText = priceBesideHeading(html);

  if (priceText) {
    const lower = priceText.toLowerCase();
    const method: PriceMethod = lower.includes("auction") ? "auction"
      : lower.includes("deadline")                    ? "deadline"
      : lower.includes("tender")                      ? "tender"
      : lower.includes("enquir") || lower.includes("oeo") || lower.includes("offers over") ? "enquiries_over"
      : /negotiation|\bpoa\b|price on application/.test(lower) ? "price_by_negotiation"
      : "fixed";
    const parsed = parsePrice(priceText);
    // Guard against a stray sub-$40k figure (weekly rent, rates, finance widget, chattels)
    // being read as the asking price — no NZ residential dwelling sells below this.
    if (parsed !== null && parsed < MIN_ASKING_PRICE) {
      listing.priceText = method === "price_by_negotiation" ? priceText : null;
      listing.priceMethod = method === "price_by_negotiation" ? method : "unknown";
      listing.askingPrice = null;
    } else {
      listing.priceText = priceText;
      listing.priceMethod = method;
      listing.askingPrice = parsed;
    }
  }

  // Beds / baths / cars from an ICON-LABELLED count.
  //
  // The text patterns below need the number to come first ("4 bedrooms"), and
  // OneRoof writes the icon first: `<i class="icon icon-bath"></i><span>2</span>`.
  // So a four-bedroom, two-bathroom house came back with no bathroom count at
  // all. Read from the same post-heading window the price uses, so a related
  // listing further down the page can't answer for the subject property.
  const summary = headingWindow(html);
  if (summary) {
    if (!listing.bedrooms) listing.bedrooms = countAfterIcon(summary, "bed");
    if (!listing.bathrooms) listing.bathrooms = countAfterIcon(summary, "bath");
    if (!listing.carParks) listing.carParks = countAfterIcon(summary, "car");
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

  // A portal that publishes `floorAreaString:"0m²"` is not failing to give us a
  // floor area — it is saying there is no building. The area parsers above drop
  // it as falsy, which is right for a measurement and wrong as an answer, so it
  // is read separately here.
  //
  // It also overrules the schema.org type, which is why this runs after it:
  // OneRoof marks up EVERY property page as `SingleFamilyResidence`, sections
  // included, and trusting that scored a bare paddock as a house.
  // The portal's own category, which beats both the schema.org type and the
  // page title. OneRoof marks every property page `SingleFamilyResidence` and
  // files sections under "Houses for Sale", but its category field says
  // "Section" plainly.
  const categoryRaw = html.match(PORTAL_CATEGORY)?.[1]?.trim().toLowerCase();
  const categoryType = categoryRaw ? CATEGORY_TYPES[categoryRaw] : undefined;
  if (categoryType) listing.propertyType = categoryType;

  // A published floor area of 0 is NOT proof there is no building. OneRoof
  // prints `floorAreaString:"0m"` when it simply doesn't hold the figure — a
  // four-bedroom house in Whakatāne reads 0m² exactly like a bare paddock does.
  // Treating the zero alone as evidence turned that house into a land report.
  //
  // So the zero only counts when the listing agrees with it some other way:
  // the portal calls it a section, or it has no bedrooms. Either on its own is
  // weak; the zero plus one of them is what a section actually looks like.
  const noBedrooms = listing.bedrooms == null || listing.bedrooms === 0;
  if (
    listing.floorAreaSqm == null &&
    STATED_ZERO_FLOOR_AREA.test(html) &&
    (categoryType === "section" || noBedrooms)
  ) {
    listing.noBuildingStated = true;
    if (listing.propertyType === "house" || listing.propertyType === "unknown") {
      listing.propertyType = "section";
    }

    // Room counts on a bare section are page furniture, not facts about the
    // property. A 5,002m² Hokitika section came back "1 bed" — scraped from a
    // similar-listings strip elsewhere on the page — which the land report would
    // then print in its header as though somebody could sleep there. The portal
    // agreeing there is no building outranks any count parsed from the markup,
    // so they are dropped rather than carried through as zero: null is "no such
    // thing here", zero would read as a measured fact.
    listing.bedrooms = null;
    listing.bathrooms = null;
    listing.carParks = null;
  }

  // Build year
  if (!listing.buildYear) {
    const m = html.match(/(?:built|year\s*built|circa|c\.?)\s*([12][0-9]{3})/i);
    if (m) listing.buildYear = parseYear(m[1]);
  }

  // Decade built. OneRoof's property-data panel publishes "Decade Built / 1950s"
  // as a label and a value in separate elements, so the year regex above walks
  // straight past it and the report goes on to say the build year wasn't stated
  // — on a page that states it. Mid-decade, because that is the least wrong
  // single number for "the 1950s" and every era band in the model is decades
  // wide (pre-1970 piles, post-1978 draught stopping, post-2008 insulation).
  if (!listing.buildYear) {
    const d = html.match(/decade\s*(?:built)?[^0-9]{0,120}?\b([12][0-9]{2})0s\b/i);
    if (d) listing.buildYear = parseYear(`${d[1]}5`);
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
  // The SUBURB, from the address heading.
  //
  // OneRoof's JSON-LD gives `addressLocality: "Westland"` — the district, not the
  // suburb — so 230 Sewell Street, Hokitika was filed under Westland and its
  // suburb $/m² comparables were drawn from the wrong place, which feeds the
  // valuation. The <h1> is human-written and says "230 Sewell Street, Hokitika,
  // Westland": street, suburb, district. Take the middle when the first part is
  // the street address we already have, so this can't fire on some other heading.
  const heading = headingText(html);
  if (heading) {
    const parts = heading.split(",").map((x) => x.trim()).filter(Boolean);
    const street = (listing.address ?? "").toLowerCase();
    if (parts.length >= 3 && street && parts[0].toLowerCase() === street) {
      const suburb = parts[1];
      // Never overwrite with the region under a different name.
      if (suburb && suburb.toLowerCase() !== (listing.region ?? "").toLowerCase()) {
        listing.suburb = suburb;
        if (!listing.city || listing.city === listing.region) listing.city = parts[2];
      }
    }
  }

  // The BODY, not just the headline. OneRoof's JSON-LD description is the
  // marketing title alone ("A Smart Move in Central Hokitika") — so the analysis
  // was handed six words and never saw the paragraph stating this house has had
  // double glazing, Insulmax wall insulation, a heat pump and a multi-fuel fire
  // installed. It then reported the windows as original single glazing. The
  // description is the one place a vendor lists work the photos cannot show, so
  // a short one is treated as a heading and the real text is hunted for.
  const HEADLINE_MAX = 200;
  if (!listing.description || listing.description.length < HEADLINE_MAX) {
    const body = longestParagraphBlock($);
    if (body && body.length > (listing.description?.length ?? 0)) {
      listing.description = [listing.description, body].filter(Boolean).join("\n\n").slice(0, 4000);
    }
  }

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

// NZ residential sale-price floor. Below this a "$" figure on a listing page is rent,
// rates, a fee, or a chattels/renovation number — never the asking price.
const MIN_ASKING_PRICE = 40000;

// Detect a no-number price method ("By Negotiation", "Price on Application") so those
// listings are labelled correctly instead of falling through to a stray $ figure.
function negotiationPriceText(html: string): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  if (/price\s*by\s*negotiation|by\s*negotiation/i.test(text)) return "By Negotiation";
  if (/price\s*on\s*application|\bPOA\b/i.test(text)) return "Price by Negotiation";
  return "";
}

function extractPriceFromText(html: string): string {
  // First $ figure that is plausibly a sale price — skip weekly rents / rates / fees
  // that would otherwise be grabbed as the asking price.
  const re = /\$\s?[0-9][0-9,]{3,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const n = parsePrice(m[0]);
    if (n !== null && n >= MIN_ASKING_PRICE) return m[0].trim();
  }
  return "";
}

/**
 * The biggest run of prose on the page.
 *
 * Portals wrap the listing body in whatever utility classes their design system
 * happens to produce — OneRoof's is `childs-[p+p]:mt-10 childs-[*]:break-words`,
 * which no class-name selector will ever guess. What IS stable is the shape:
 * the listing description is the largest cluster of <p> text on a property page.
 * So find the element whose direct <p> children hold the most text, rather than
 * trying to name it.
 */
function longestParagraphBlock($: cheerio.CheerioAPI): string | null {
  let best = "";
  $("div, section, article").each((_i, el) => {
    const node = $(el);
    // Direct children only: a wrapper high up the tree would otherwise win by
    // swallowing the whole page, navigation and agent blurb included.
    const paras = node.children("p");
    if (paras.length < 2) return;
    const text = paras
      .map((_j, p) => $(p).text().trim())
      .get()
      .filter(Boolean)
      .join("\n\n")
      .trim();
    if (text.length > best.length) best = text;
  });
  return best.length > 120 ? best : null;
}

/** The text inside the page's first <h1> — the property address on every portal. */
function headingText(html: string): string {
  const m = html.match(/<h1[^>]*>([\s\S]{0,200}?)<\/h1>/i);
  return m ? m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
}

/** The markup immediately after that heading — the subject property's own summary. */
function headingWindow(html: string): string {
  const m = html.match(/<h1[^>]*>[\s\S]{0,200}?<\/h1>([\s\S]{0,900})/i);
  return m ? m[1] : "";
}

/** `<i class="icon icon-bath"></i><span>2</span>` → 2. */
function countAfterIcon(window: string, what: "bed" | "bath" | "car"): number | null {
  const m = window.match(new RegExp(`icon-${what}\\b[\\s\\S]{0,160}?>\\s*(\\d{1,2})\\s*<`, "i"));
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 && n < 30 ? n : null;
}

/**
 * The asking price where it sits beside the address heading, unlabelled.
 *
 * Only the first $ figure within a short window after the </h1> counts: further
 * down the page live rating valuations, estimated ranges, rates and mortgage
 * calculators, and any of them would be a wrong number presented as the ask.
 */
function priceBesideHeading(html: string): string {
  const after = headingWindow(html).slice(0, 600).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  if (!after) return "";
  const m = after.match(/\$\s?[0-9][0-9,]{4,}/);
  return m ? m[0].replace(/\s+/g, "") : "";
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
