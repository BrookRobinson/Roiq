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
      found: { type: "boolean", description: "False if you genuinely could not find this property for sale anywhere." },
      address: { type: "string", description: "Full street address." },
      suburb: { type: "string" },
      city: { type: "string" },
      region: { type: "string", description: "Region, e.g. 'Canterbury', 'West Coast'." },
      asking_price: { type: "number", description: "Asking price in NZD if a fixed/indicative figure is shown." },
      price_text: { type: "string", description: "The price as displayed, e.g. 'Asking $309,000', 'Auction', 'By negotiation'." },
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
      photo_urls: { type: "array", items: { type: "string" }, description: "Direct image URLs of the property photos, if visible." },
      source_site: { type: "string", description: "Which site you found it on, e.g. 'OneRoof', 'realestate.co.nz', 'homes.co.nz'." },
      source_url: { type: "string", description: "The page URL where you found it." },
    },
    required: ["found"],
  },
};

const WEB_SEARCH_TOOL = { type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 6 };

// A portal blocked the scrape → recover the SAME property from another source.
function urlRecoveryPrompt(url: string, partialAddress?: string | null): string {
  return `A New Zealand property listing could not be scraped directly — the portal blocked it or returned no data. Find the SAME property from another source.

ORIGINAL URL: ${url}
${partialAddress ? `KNOWN ADDRESS: ${partialAddress}` : "If you can, work out the street address from the URL slug."}

Use web search to find this exact property currently for sale. Try, in order: OneRoof (oneroof.co.nz), realestate.co.nz, homes.co.nz, then a general web search${partialAddress ? ` for "${partialAddress} for sale NZ"` : ' for the address + "for sale NZ"'} (which picks up the listing agency's own site — Harcourts, Ray White, Bayleys, Barfoot & Thompson, First National, Property Brokers, etc.). NZ listings are usually cross-posted, so the same property is often on several sites.

Then call ${TOOL_NAME} with the property's details and any photo image URLs you can see, plus which site you found it on (source_site) and the page URL (source_url). Report ONLY what the sources actually show — never invent a figure. If you genuinely cannot find the property anywhere, call ${TOOL_NAME} with found=false.`;
}

// The user typed an address by hand → look that exact property up.
function addressLookupPrompt(address: string): string {
  return `A New Zealand homeowner or investor wants this property analysed and has given you its address by hand:

ADDRESS: ${address}

Use web search to find this exact property, checking these sources in order until you have solid data:
1. OneRoof — oneroof.co.nz
2. realestate.co.nz
3. homes.co.nz
4. A general web search for "${address} for sale NZ" (picks up the listing agency's own site and any other portal)

NZ properties are usually cross-posted, so the same one often appears on several sites — prefer whichever gives the most complete data (photos, price, bedrooms, bathrooms, floor area, land area, description).

Then call ${TOOL_NAME} with everything the sources actually show, plus any photo image URLs, the site you found it on (source_site) and the page URL (source_url). Report ONLY what the sources show — never invent a figure. If this property is not currently listed for sale anywhere, call ${TOOL_NAME} with found=false — that's a valid outcome, the address alone is still useful.`;
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
  if (!d.found) return { found: false, source: str(d.source_site), sourceUrl: str(d.source_url), fields: {} };

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
    photoUrls: Array.isArray(d.photo_urls) ? d.photo_urls.filter((u) => typeof u === "string" && /^https?:\/\//.test(u)) : [],
  };
  return { found: true, source: str(d.source_site) ?? "web search", sourceUrl: str(d.source_url), fields };
}
