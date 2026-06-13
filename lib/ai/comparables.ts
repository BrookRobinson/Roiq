import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropic, ANALYSIS_MODEL } from "./client";
import type { SuburbValue } from "@/lib/scoring/investment";
import type { ScrapedListing } from "@/lib/scraper/types";

// Researches the suburb's median sale price per m² from REAL recent sales using
// Anthropic's web-search tool (OneRoof first, cross-checked against homes.co.nz /
// QV). Never hardcoded, never invented. Non-fatal: callers fall back gracefully.
// Powers the RoIQ Value Verdict (Change 1/2).

interface RawSuburbValue {
  found: boolean;
  median_per_sqm?: number;
  sample_size?: number;
  median_sale_price?: number;
  median_floor_area?: number;
  source?: string;
  widened_note?: string;
}

const TOOL_NAME = "submit_suburb_value";

const SUBURB_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description: "Submit the suburb's median sale price per square metre, computed from real recent comparable sales, with the source cited.",
  input_schema: {
    type: "object",
    properties: {
      found: { type: "boolean", description: "False if you could not find enough recent sales to compute a reliable figure." },
      median_per_sqm: { type: "number", description: "Median sale price ÷ floor area across the recent sales, NZD per m² (e.g. 2908)." },
      sample_size: { type: "number", description: "How many recent sales the median is based on (aim for 15–20)." },
      median_sale_price: { type: "number", description: "Median sale price across those sales, NZD." },
      median_floor_area: { type: "number", description: "Median floor area across those sales, m²." },
      source: { type: "string", description: "Where the sales came from, e.g. 'oneroof.co.nz' or 'oneroof.co.nz + homes.co.nz'." },
      widened_note: { type: "string", description: "Set ONLY if you widened beyond the suburb due to thin data, e.g. 'Fewer than 5 suburb sales — widened to the wider Westland district.'" },
    },
    required: ["found"],
  },
};

const WEB_SEARCH_TOOL = { type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 6 };

function suburbPrompt(listing: ScrapedListing): string {
  const loc = [listing.suburb, listing.region ?? listing.city].filter(Boolean).join(", ") || listing.address || "the property's suburb";
  const type = listing.propertyType !== "unknown" ? listing.propertyType : "house";
  return `Work out the median sale price per square metre for recently SOLD properties in this New Zealand suburb, to value a comparable property.

SUBURB: ${loc}
PROPERTY TYPE: ${type} (filter the comparable sales to this type — house / apartment / townhouse — as closely as you can).

Method:
1. On oneroof.co.nz, find the last 15–20 RECENT SALES in this suburb for this property type (oneroof.co.nz/property/<region>/<suburb> sold listings).
2. For each sale, divide the sale price by the floor area (m²) to get $/m².
3. Take the MEDIAN of those $/m² figures — that is the suburb median $/m².
4. Cross-check the figure against homes.co.nz suburb data and QV / CoreLogic suburb reports if available.
5. If there are FEWER THAN 5 recent sales in this exact suburb, widen to the nearest town or district and say so in widened_note.

Then call ${TOOL_NAME} with the median $/m², how many sales it's based on (sample_size), the median sale price and median floor area, and the source. Report ONLY what the data actually shows — never invent figures. If you genuinely cannot find enough sales, call ${TOOL_NAME} with found=false.`;
}

export async function fetchSuburbValue(listing: ScrapedListing): Promise<SuburbValue | undefined> {
  const client = getAnthropic();
  const resp = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 2000,
    tools: [WEB_SEARCH_TOOL as unknown as Anthropic.ToolUnion, SUBURB_TOOL],
    messages: [{ role: "user", content: suburbPrompt(listing) }],
  });

  const tu = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME
  );
  if (!tu) return undefined;
  const d = tu.input as RawSuburbValue;
  if (!d.found || !Number.isFinite(d.median_per_sqm) || (d.median_per_sqm as number) <= 0) return undefined;

  const num = (n: unknown): number | undefined => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined);
  const retrieved = new Date().toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
  const suburb = [listing.suburb, listing.region ?? listing.city].filter(Boolean).join(", ") || listing.address || "this suburb";

  return {
    medianPerSqm: Math.round(d.median_per_sqm as number),
    sampleSize: num(d.sample_size) ?? 0,
    medianSalePrice: num(d.median_sale_price),
    medianFloorArea: num(d.median_floor_area),
    propertyType: listing.propertyType !== "unknown" ? listing.propertyType : undefined,
    suburb,
    source: d.source?.trim() || "oneroof.co.nz",
    widenedNote: d.widened_note?.trim() || undefined,
    retrieved,
  };
}
