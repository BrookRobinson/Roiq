import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropic, ANALYSIS_MODEL } from "./client";

// Targeted floor-area + land-area lookup by address. Listings often render these two
// figures client-side (or omit them), so even a clean scrape can come back without
// them — and the RoIQ Value Verdict (suburb median $/m² × condition × FLOOR AREA)
// can't compute without the floor area. This does ONE focused web search against the
// NZ property-data sites that publish council / RV records, and is only called when
// the scrape didn't already supply both. Never estimates — omits what it can't find.

export interface PropertyAreas {
  floorAreaSqm: number | null;
  landAreaSqm: number | null;
  askingPrice: number | null; // current advertised asking price (numeric), if for sale
  priceText: string | null;   // e.g. "$2,099,000", "By Negotiation", "Auction 16 Jul"
  source: string | null;      // e.g. "homes.co.nz"
}

const EMPTY: PropertyAreas = { floorAreaSqm: null, landAreaSqm: null, askingPrice: null, priceText: null, source: null };

const TOOL_NAME = "submit_areas";
const AREAS_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description: "Submit the property's floor area and land area in square metres, plus (only if it is currently for sale) its advertised asking price, citing the source.",
  input_schema: {
    type: "object",
    properties: {
      floor_area_sqm: {
        type: "number",
        description: "Internal floor area (house/building size) in m². This is the council/RV 'floor area'. Omit entirely if no source publishes it — never estimate.",
      },
      land_area_sqm: {
        type: "number",
        description: "Land / section area in m². If a source gives hectares (ha), convert to m² (1 ha = 10,000 m²). Omit entirely if not published — never estimate.",
      },
      asking_price: {
        type: "number",
        description: "The property's CURRENT advertised asking price as a plain number (e.g. 2099000), ONLY if it is presently for sale and a firm numeric price is advertised. NEVER use the OneRoof/homes.co.nz online estimate, the RV/CV rating value, or a past sale price. Omit entirely if the method is by-negotiation/auction/tender/deadline, or if it is not currently for sale.",
      },
      asking_price_text: {
        type: "string",
        description: "The price EXACTLY as advertised on the current for-sale listing, e.g. '$2,099,000', 'Enquiries over $1,900,000', 'By Negotiation', 'Auction 16 Jul 2026', 'Deadline Sale'. Omit if the property is not currently for sale.",
      },
      source_site: {
        type: "string",
        description: "Site the figures came from, e.g. 'homes.co.nz', 'OneRoof', 'propertyvalue.co.nz', 'realestate.co.nz'.",
      },
    },
    required: [],
  },
};

const WEB_SEARCH_TOOL = { type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 5 };

function areaLookupPrompt(address: string): string {
  return `Find the FLOOR AREA (house/building size, in m²), the LAND AREA (section size, in m²), and — only if it is CURRENTLY FOR SALE — the ADVERTISED ASKING PRICE for this New Zealand property:

ADDRESS: ${address}

Floor and land area come from council / rating-valuation (RV) records and are published on NZ property-data sites even when the home is NOT for sale. Search in this order and stop once you have what you need:
  • "${address}" site:homes.co.nz
  • "${address}" site:oneroof.co.nz
  • "${address}" site:propertyvalue.co.nz
  • "${address}" for sale asking price    (finds the live listing on realestate.co.nz / an agency site)
  • "${address}" floor area land area     (a plain search catches the listing / council records)

Rules:
- Report ONLY figures a source actually shows. If a figure isn't published anywhere, OMIT it — do not estimate or infer from comparable homes.
- Land area is sometimes given in hectares (ha) — convert to m² (1 ha = 10,000 m²).
- "Floor area" is the building's internal size; "land area" / "land" / "section" is the section. Don't swap them.
- ASKING PRICE: report it ONLY if the property is presently advertised for sale. Use the price shown on the live for-sale listing ("Priced at $X", "Asking Price $X", "Enquiries over $X", "By Negotiation", "Auction ...", "Deadline Sale"). This is NOT the same as the OneRoof / homes.co.nz automated ESTIMATE, the RV/CV rating value, or a past sale price — never report any of those as the asking price. If it isn't currently for sale, or only an estimate/RV/past sale exists, OMIT the asking price entirely.

Then call ${TOOL_NAME} with whatever you found (and source_site).`;
}

const num = (n: unknown): number | null =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;

/**
 * Look up a property's floor + land area by address. Best-effort: returns nulls on
 * any failure (no key, search miss, malformed response) so callers can simply
 * fill-if-present. A floor area above 100,000 m² is treated as junk (likely a land
 * figure mislabelled) and dropped.
 */
export async function lookupPropertyAreas(address: string): Promise<PropertyAreas> {
  const a = (address ?? "").trim();
  if (!a) return EMPTY;

  try {
    const client = getAnthropic();
    const resp = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 1024,
      tools: [WEB_SEARCH_TOOL as unknown as Anthropic.ToolUnion, AREAS_TOOL],
      messages: [{ role: "user", content: areaLookupPrompt(a) }],
    });

    const tu = resp.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME
    );
    if (!tu) return EMPTY;

    const d = tu.input as {
      floor_area_sqm?: number; land_area_sqm?: number;
      asking_price?: number; asking_price_text?: string; source_site?: string;
    };
    const floor = num(d.floor_area_sqm);
    const ask = num(d.asking_price);
    return {
      floorAreaSqm: floor != null && floor <= 100_000 ? floor : null,
      landAreaSqm: num(d.land_area_sqm),
      // Plausibility band for an NZ residential asking price ($40k–$100m) guards against an
      // online estimate/RV or a mis-parsed figure leaking through as the advertised price.
      askingPrice: ask != null && ask >= 40_000 && ask <= 100_000_000 ? ask : null,
      priceText: typeof d.asking_price_text === "string" && d.asking_price_text.trim() ? d.asking_price_text.trim() : null,
      source: typeof d.source_site === "string" && d.source_site.trim() ? d.source_site.trim() : null,
    };
  } catch {
    return EMPTY;
  }
}
