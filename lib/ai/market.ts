import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropic, ANALYSIS_MODEL } from "./client";
import type { MarketRent, CapitalGrowth } from "@/lib/scoring/investment";
import type { ScrapedListing } from "@/lib/scraper/types";

// Researches real, cited market rent + capital-growth for the property's suburb
// using Anthropic's web-search tool. Non-fatal: if it fails or finds nothing,
// callers fall back to indicative defaults. Never invents figures.

interface RawMarketData {
  found: boolean;
  weekly_rent?: number;
  rent_source?: string;
  annual_growth_pct?: number;
  growth_source?: string;
  growth_why?: string;
  recent_note?: string;
}

const MARKET_TOOL_NAME = "submit_market_data";

const MARKET_TOOL: Anthropic.Tool = {
  name: MARKET_TOOL_NAME,
  description: "Submit the researched market rent and capital-growth figures for the property's suburb, with the exact sources cited.",
  input_schema: {
    type: "object",
    properties: {
      found: { type: "boolean", description: "False if you could not find reliable data for this suburb." },
      weekly_rent: { type: "number", description: "Median WEEKLY rent for this property's size/type in this suburb, NZD." },
      rent_source: { type: "string", description: "Specific source + figure, e.g. 'Tenancy Services market rent — $850/wk (Remuera, 3-bed)' or 'myRent median $820/wk'." },
      annual_growth_pct: { type: "number", description: "Long-run annual capital-growth rate for the suburb/region, % (e.g. 4.7)." },
      growth_source: { type: "string", description: "Specific source, e.g. 'QV House Price Index' or 'OneRoof suburb profile'." },
      growth_why: { type: "string", description: "Plain-English drivers: schools, infrastructure, supply/demand, lifestyle/coastal premium, population." },
      recent_note: { type: "string", description: "Honest recent 12-month trend, e.g. 'median down 9% over the last year'." },
    },
    required: ["found"],
  },
};

const WEB_SEARCH_TOOL = { type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 5 };

function marketPrompt(listing: ScrapedListing): string {
  const loc = [listing.suburb, listing.region ?? listing.city].filter(Boolean).join(", ") || listing.address || "the property's suburb";
  const beds = listing.bedrooms ? `${listing.bedrooms}-bedroom ` : "";
  const type = listing.propertyType !== "unknown" ? listing.propertyType : "home";
  return `Research the rental and capital-growth market for this New Zealand property to support an investment analysis.

PROPERTY: ${beds}${type} in ${loc}${listing.address ? ` (${listing.address})` : ""}.

Use web search to find:
1. MARKET RENT — the current median WEEKLY rent for a ${beds}${type} in ${loc}. Prefer Tenancy Services market rent (tenancy.govt.nz), myRent, or current rental listings for the suburb.
2. CAPITAL GROWTH — the suburb (or wider region) long-run annual growth %, and the recent 12-month trend. Prefer QV House Price Index, OneRoof suburb profiles, REINZ, or Opes Partners.

Then call ${MARKET_TOOL_NAME} with the figures and cite the EXACT source for each. Report only what the sources actually show — never invent a figure. If you genuinely cannot find reliable data, call ${MARKET_TOOL_NAME} with found=false.`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface MarketResult {
  marketRent?: MarketRent;
  capitalGrowth?: CapitalGrowth;
}

export async function fetchMarketData(listing: ScrapedListing): Promise<MarketResult> {
  const client = getAnthropic();
  const resp = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 2000,
    tools: [WEB_SEARCH_TOOL as unknown as Anthropic.ToolUnion, MARKET_TOOL],
    messages: [{ role: "user", content: marketPrompt(listing) }],
  });

  const tu = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === MARKET_TOOL_NAME
  );
  if (!tu) return {};
  const d = tu.input as RawMarketData;
  if (!d.found) return {};

  const out: MarketResult = {};
  if (Number.isFinite(d.weekly_rent) && (d.weekly_rent as number) > 0) {
    out.marketRent = {
      weekly: Math.round(d.weekly_rent as number),
      source: d.rent_source?.trim() || "Web search",
      isEstimate: false,
    };
  }
  if (Number.isFinite(d.annual_growth_pct)) {
    out.capitalGrowth = {
      annualRatePct: round1(d.annual_growth_pct as number),
      source: d.growth_source?.trim() || "Web search",
      why: d.growth_why?.trim() || "",
      recentNote: d.recent_note?.trim() || undefined,
    };
  }
  return out;
}
