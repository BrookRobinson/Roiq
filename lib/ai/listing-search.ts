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
      source_site: { type: "string", description: "Which site you found it on, e.g. 'OneRoof', 'realestate.co.nz', 'homes.co.nz'." },
      source_url: { type: "string", description: "The page URL where you found it." },
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
  portals: ["trademe.co.nz/property", "oneroof.co.nz", "realestate.co.nz", "homes.co.nz", "homesell.co.nz", "arizto.co.nz"],
  chains: ["harcourts.co.nz", "raywhite.co.nz", "barfoot.co.nz", "bayleys.co.nz", "ljhooker.co.nz", "century21.co.nz", "professionals.co.nz", "firstnational.co.nz", "propertybrokers.co.nz", "tallpoppy.co.nz", "tommys.co.nz", "harveys.co.nz", "lodge.co.nz", "pggwrightson.co.nz", "raineandhorne.co.nz", "mikepero.com", "remax.co.nz", "nzsir.com", "oneagency.co.nz", "realty.co.nz", "leaders.co.nz", "settle.co.nz"],
  regional: ["citysales.co.nz", "crockers.co.nz", "unitedrealty.co.nz", "eves.co.nz", "tremains.co.nz", "psbayofplenty.co.nz", "monarch.co.nz", "pnrealty.co.nz", "capitalrealty.co.nz", "nelsonrealty.co.nz", "whittle-knight.co.nz", "westcoastrealty.co.nz", "cowdy.co.nz", "bradleysnelling.co.nz", "dunedinrealestate.co.nz", "centralotagorealty.co.nz", "johnstonfullerton.co.nz", "southlandrealestate.co.nz", "northlandproperty.co.nz"],
  commercialRural: ["colliers.co.nz", "jll.co.nz", "cbre.co.nz", "savills.co.nz", "knightfrank.co.nz", "ruralrealty.co.nz", "farmlands.co.nz"],
};

// A portal blocked the scrape → recover the SAME property from another source.
function urlRecoveryPrompt(url: string, partialAddress?: string | null): string {
  return `A New Zealand property listing could not be scraped directly — the portal blocked it or returned no data. Find the SAME property from another source.

ORIGINAL URL: ${url}
${partialAddress ? `KNOWN ADDRESS: ${partialAddress}` : "If you can, work out the street address from the URL slug."}

Use web search to find this exact property currently for sale. Try, in order: OneRoof (oneroof.co.nz), realestate.co.nz, homes.co.nz, then a general web search${partialAddress ? ` for "${partialAddress} for sale NZ"` : ' for the address + "for sale NZ"'} (which picks up the listing agency's own site — Harcourts, Ray White, Bayleys, Barfoot & Thompson, First National, Property Brokers, etc.). NZ listings are usually cross-posted, so the same property is often on several sites. Prefer the CURRENT for-sale listing — never report a past SOLD price as the asking price.

Then call ${TOOL_NAME} with the property's details and any photo image URLs you can see, plus which site you found it on (source_site) and the page URL (source_url). Report ONLY what the sources actually show — never invent a figure. If you genuinely cannot find the property anywhere, call ${TOOL_NAME} with found=false.`;
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
  if (!tu) return { found: false, source: null, sourceUrl: null, fields: {} };
  const d = tu.input as RawListing;

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
    fields,
  };
}
