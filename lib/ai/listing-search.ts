import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropic, ANALYSIS_MODEL } from "./client";
import type { ScrapedListing, PropertyType } from "@/lib/scraper/types";

// Listing recovery via web search, used two ways:
//   • a portal blocked the scrape (e.g. TradeMe) → find the SAME property elsewhere;
//   • the user typed an address by hand → look that property up directly.
// Either way we check OneRoof / realestate.co.nz / homes.co.nz / a Google search /
// the listing agency, with the source cited. Never invents data.

export interface ListingSearchResult {
  found: boolean;
  source: string | null; // site the data came from, e.g. "OneRoof"
  sourceUrl: string | null;
  /** Every page URL where the listing appears (agency site first) — scraped for photos. */
  candidateUrls: string[];
  fields: Partial<ScrapedListing>;
}

interface RawListing {
  found: boolean;
  address?: string;
  suburb?: string;
  city?: string;
  region?: string;
  asking_price?: number;
  price_text?: string;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  car_parks?: number;
  floor_area_sqm?: number;
  land_area_sqm?: number;
  build_year?: number;
  description?: string;
  agency_name?: string;
  agent_name?: string;
  days_on_market?: number;
  photo_urls?: string[];
  source_site?: string;
  source_url?: string;
  candidate_urls?: string[];
}

const TOOL_NAME = "submit_listing";
const LISTING_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description: "Submit the property listing details recovered from another source, with the source cited.",
  input_schema: {
    type: "object",
    properties: {
      found: { type: "boolean", description: "True ONLY if the property is CURRENTLY for sale (a live listing). False if it is sold / off-market / you found only past or property-data records — even if you filled in physical details below." },
      address: { type: "string", description: "Full street address." },
      suburb: { type: "string" },
      city: { type: "string" },
      region: { type: "string", description: "Region, e.g. 'Canterbury', 'West Coast'." },
      asking_price: { type: "number", description: "CURRENT asking price in NZD if a fixed/indicative figure is shown. NEVER a past SOLD price — leave blank for a sold/past record." },
      price_text: { type: "string", description: "The CURRENT price as displayed, e.g. 'Asking $309,000', 'Auction', 'By negotiation'. Leave blank if the property is not currently for sale." },
      property_type: { type: "string", description: "house | townhouse | unit | apartment | section | lifestyle | rural | commercial." },
      bedrooms: { type: "number" },
      bathrooms: { type: "number" },
      car_parks: { type: "number" },
      floor_area_sqm: { type: "number" },
      land_area_sqm: { type: "number" },
      build_year: { type: "number" },
      description: { type: "string", description: "A short description of the property from the listing." },
      agency_name: { type: "string", description: "Listing agency, e.g. 'First National Success'." },
      agent_name: { type: "string" },
      days_on_market: { type: "number", description: "Days the listing has been on the market, if shown." },
      photo_urls: { type: "array", items: { type: "string" }, description: "Direct image URLs of the property photos, if visible." },
      source_site: { type: "string", description: "Which site you found it on, e.g. 'OneRoof', 'realestate.co.nz', 'homes.co.nz', 'chaneys.co.nz'." },
      source_url: { type: "string", description: "The page URL where you found it." },
      candidate_urls: { type: "array", items: { type: "string" }, description: "EVERY page URL where this listing appears — the listing agency's OWN listing page FIRST (it usually has the full photo gallery), then portals (oneroof / realestate / homes / propertyvalue). We fetch these to scrape the photos, so include as many as you find." },
    },
    required: ["found"],
  },
};

const WEB_SEARCH_TOOL = { type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 10 };

// NZ property sites, deduped to unique domains, for the address-lookup fallback.
// A plain Google search ("<address> property for sale NZ") finds a listing on ANY
// of these without checking each one, so these are the model's `site:` fallbacks
// when the open search comes up empty.
const NZ_PROPERTY_SITES = {
  portals: ["trademe.co.nz/property", "oneroof.co.nz", "realestate.co.nz", "homes.co.nz", "propertyvalue.co.nz", "homesell.co.nz", "arizto.co.nz"],
  chains: ["harcourts.co.nz", "raywhite.co.nz", "barfoot.co.nz", "bayleys.co.nz", "ljhooker.co.nz", "century21.co.nz", "professionals.co.nz", "firstnational.co.nz", "propertybrokers.co.nz", "tallpoppy.co.nz", "tommys.co.nz", "harveys.co.nz", "lodge.co.nz", "pggwrightson.co.nz", "raineandhorne.co.nz", "mikepero.com", "remax.co.nz", "nzsir.com", "oneagency.co.nz", "realty.co.nz", "leaders.co.nz", "settle.co.nz"],
  regional: ["citysales.co.nz", "crockers.co.nz", "unitedrealty.co.nz", "eves.co.nz", "tremains.co.nz", "psbayofplenty.co.nz", "monarch.co.nz", "pnrealty.co.nz", "capitalrealty.co.nz", "nelsonrealty.co.nz", "chaneys.co.nz", "whittle-knight.co.nz", "westcoastrealty.co.nz", "cowdy.co.nz", "bradleysnelling.co.nz", "dunedinrealestate.co.nz", "centralotagorealty.co.nz", "johnstonfullerton.co.nz", "southlandrealestate.co.nz", "northlandproperty.co.nz"],
  commercialRural: ["colliers.co.nz", "jll.co.nz", "cbre.co.nz", "savills.co.nz", "knightfrank.co.nz", "ruralrealty.co.nz", "farmlands.co.nz"],
};

// A portal (usually TradeMe) blocked the scrape / hid the photos → automatically
// find the SAME property elsewhere so we can recover its PHOTOS + details. The user
// must NEVER see "no photos" if they exist anywhere online.
function urlRecoveryPrompt(url: string, partialAddress?: string | null): string {
  return `A New Zealand property listing could not be scraped — the portal (often TradeMe) blocked it or hid the photos. Find the SAME property on other sources so we can recover its PHOTOS and details. Be persistent: a Google search for the address almost always surfaces the listing with photos.

ORIGINAL URL: ${url}
${partialAddress ? `KNOWN ADDRESS: ${partialAddress}` : "Work out the street address from the URL slug if you can."}

Work through these and DON'T stop until you've found the listing's photos:
1. AGENCY — work out the listing agency/agent from the original listing or its slug (TradeMe usually shows the agent + agency even when photos are blocked). NZ agencies cross-post to their OWN website, which carries the full photo gallery — that's the best photo source.
2. GOOGLE the address with the agency, and across portals, e.g. "${partialAddress ?? "<the address>"}" <agency-domain>   and   "${partialAddress ?? "<the address>"}" property for sale NZ — this surfaces the agency site + TradeMe + homes.co.nz + propertyvalue.co.nz + OneRoof.
3. Check the address on: oneroof.co.nz, realestate.co.nz, homes.co.nz, propertyvalue.co.nz, and the listing agency's own website.
NZ listings are cross-posted, so the same property is on several sites — prefer the CURRENT for-sale listing (never a past SOLD price).

Then call ${TOOL_NAME} with: the property's details, agency_name/agent_name, any photo image URLs you can see, source_site + source_url, AND **candidate_urls** = EVERY page URL where this listing appears (the agency's own listing page FIRST, then portals) so we can fetch the full photo gallery from them. Report ONLY what the sources show — never invent a figure. Only set found=false if the property genuinely is not online anywhere.`;
}

// The user typed an address by hand → look that exact property up. Google-style
// search first (catches any site), then targeted site: searches as a fallback.
function addressLookupPrompt(address: string): string {
  const portals = [...NZ_PROPERTY_SITES.portals, ...NZ_PROPERTY_SITES.chains].join(", ");
  const regional = NZ_PROPERTY_SITES.regional.join(", ");
  const commercial = NZ_PROPERTY_SITES.commercialRural.join(", ");
  return `A New Zealand homeowner or investor has given you this property address by hand and wants it analysed:

ADDRESS: ${address}

Find this exact property with web search. Work the steps in order and STOP as soon as you have a CURRENT for-sale listing.

STEP 1 — Google-style search FIRST (this catches a listing on ANY site without checking each one):
  • "${address}" property for sale NZ
  • "<street number> <street name> <suburb>" real estate NZ   ← pull the number / street / suburb out of the address above
Read the top results and open the best CURRENT listing. NZ listings are cross-posted, so the property is usually on a major portal or an agency's own site.

STEP 2 — If Step 1 does NOT surface a CURRENT listing (you found only sold/past records, or nothing), DO NOT give up — on NZ the live listing is often on a portal or agency site that didn't rank in the open search. Run several targeted "site:" searches for this exact address before concluding, e.g.:
  • "${address}" site:professionals.co.nz
  • "${address}" site:trademe.co.nz OR site:realestate.co.nz OR site:oneroof.co.nz OR site:homes.co.nz
  • "${address}" site:harcourts.co.nz OR site:raywhite.co.nz OR site:bayleys.co.nz OR site:propertybrokers.co.nz OR site:ljhooker.co.nz
A current listing on ANY site counts. Full list to draw from — major portals & national chains: ${portals}; regional / specialist agencies (use the ones for this property's region): ${regional}; commercial / rural: ${commercial}. Only treat the property as not currently for sale AFTER these site: searches also come up empty.

CURRENT vs SOLD — IMPORTANT: results for one address usually MIX the live for-sale listing with OLD sold records and property-data pages (e.g. "Sold", "/sold/" URLs, OneRoof / propertyvalue past-sale prices). You want the one ON THE MARKET NOW — status like "For Sale", "Asking", "Offers Over", "Deadline Sale", "Auction", "Tender", "By Negotiation", "Enquiries Over". NEVER report a past SOLD price as the asking price, and don't stop at a sold record if a current listing also exists — keep looking for the live one.

EXTRACT — only what the sources actually show, never invent: the CURRENT asking/listing price, bedrooms, bathrooms, car parks/garages, floor area (m²), land area (m²), the full description, ALL listing photo image URLs, agent + agency, days on market, and the site (source_site) + page URL (source_url).

Then call ${TOOL_NAME}, setting found as follows:
  • found=TRUE only if the property is CURRENTLY for sale — include the current price / price_text.
  • found=FALSE if you find ONLY sold / past / property-data records (no live listing) — but STILL fill in the physical facts you learned (bedrooms, bathrooms, floor_area_sqm, land_area_sqm, build_year, property_type, description) and LEAVE asking_price / price_text blank. Those facts still help a public-data analysis.
  • found=FALSE with no fields if you find nothing at all.`;
}

const num = (n: unknown): number | null => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null);
const int = (n: unknown): number | null => { const v = num(n); return v == null ? null : Math.round(v); };
const str = (s: unknown): string | null => (typeof s === "string" && s.trim() ? s.trim() : null);

function normType(s?: string): PropertyType {
  const t = (s ?? "").toLowerCase();
  const types: PropertyType[] = ["house", "townhouse", "unit", "apartment", "section", "lifestyle", "rural", "commercial"];
  return types.find((x) => t.includes(x)) ?? "unknown";
}

/**
 * Find a listing via web search. Pass `{ url }` (with an optional known `address`)
 * to recover a property whose portal blocked the scrape, or `{ address }` alone to
 * look up a property the user typed in by hand.
 */
export async function searchListing(opts: { url?: string; address?: string | null }): Promise<ListingSearchResult> {
  const prompt = opts.url
    ? urlRecoveryPrompt(opts.url, opts.address ?? null)
    : addressLookupPrompt((opts.address ?? "").trim());

  const client = getAnthropic();
  const resp = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 2500,
    tools: [WEB_SEARCH_TOOL as unknown as Anthropic.ToolUnion, LISTING_TOOL],
    messages: [{ role: "user", content: prompt }],
  });

  const tu = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME
  );
  if (!tu) return { found: false, source: null, sourceUrl: null, candidateUrls: [], fields: {} };
  const d = tu.input as RawListing;

  const candidateUrls = Array.from(new Set(
    [d.source_url, ...(Array.isArray(d.candidate_urls) ? d.candidate_urls : [])]
      .filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u.trim()))
      .map((u) => u.trim())
  ));

  // Build whatever facts the model gathered. We keep these EVEN when the property
  // isn't currently for sale (found=false) so a past-sale / property-data record can
  // still feed a public-data analysis instead of starving it.
  const fields: Partial<ScrapedListing> = {
    address: str(d.address),
    suburb: str(d.suburb),
    city: str(d.city),
    region: str(d.region),
    askingPrice: num(d.asking_price),
    priceText: str(d.price_text),
    bedrooms: int(d.bedrooms),
    bathrooms: int(d.bathrooms),
    carParks: int(d.car_parks),
    floorAreaSqm: num(d.floor_area_sqm),
    landAreaSqm: num(d.land_area_sqm),
    buildYear: int(d.build_year),
    propertyType: normType(d.property_type),
    description: str(d.description),
    agencyName: str(d.agency_name),
    agentName: str(d.agent_name),
    daysOnMarket: int(d.days_on_market),
    photoUrls: Array.isArray(d.photo_urls) ? d.photo_urls.filter((u) => typeof u === "string" && /^https?:\/\//.test(u)) : [],
  };
  const currentlyForSale = Boolean(d.found);
  return {
    found: currentlyForSale,
    source: str(d.source_site) ?? (currentlyForSale ? "web search" : null),
    sourceUrl: str(d.source_url),
    candidateUrls,
    fields,
  };
}
