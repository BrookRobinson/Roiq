import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropic, ANALYSIS_MODEL } from "./client";
import type { SuburbValue } from "@/lib/scoring/investment";
import type { ScrapedListing } from "@/lib/scraper/types";

// Researches the suburb's median sale price per m² from REAL recent sales using
// Anthropic's web-search tool (OneRoof first, cross-checked against homes.co.nz /
// QV). Never hardcoded, never invented. Non-fatal: callers fall back gracefully.
// Powers the BDR Value Verdict (Change 1/2).

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

function suburbPrompt(listing: ScrapedListing, widen: boolean): string {
  const suburb = listing.suburb || null;
  const district = listing.city || null;                    // e.g. "Whanganui"
  const region = listing.region ?? listing.city ?? null;    // e.g. "Manawatū-Whanganui"
  const loc = [suburb, region].filter(Boolean).join(", ") || listing.address || "the property's suburb";
  const type = listing.propertyType !== "unknown" ? listing.propertyType : "house";

  const widenLine = widen
    ? `\nA previous attempt found too little suburb-level data. START WIDE this time — work at the ${district ?? "district"} / ${region ?? "region"} level from the outset and compute the figure from there. found=false is NOT acceptable unless the entire district has no published sales, which is essentially never true for an inhabited NZ area.`
    : "";

  return `Work out the median sale price per square metre (NZD/m²) for recently SOLD ${type}s in this New Zealand area, to value a comparable property.

AREA: ${loc}${district && district !== suburb ? `  (district: ${district})` : ""}
PROPERTY TYPE: ${type}

Use whichever method below gets a reliable figure fastest — you do NOT need all of them:
  A. PUBLISHED SUBURB STAT (easiest) — homes.co.nz, oneroof.co.nz and QV publish a suburb "median sale price" and "median floor area", and sometimes a $/m² figure directly. If $/m² is published, use it; otherwise divide the published median sale price by the published median floor area.
  B. RECENT SALES — find ~15 recent ${type} sales in the area (oneroof.co.nz sold listings), divide each sale price by its floor area, and take the MEDIAN of those $/m².
  C. CROSS-CHECK across at least two of homes.co.nz / oneroof.co.nz / QV where you can.

If this exact suburb has FEWER THAN 5 recent sales, WIDEN to the wider ${district ?? "district"} (then the ${region ?? "region"}) and set widened_note to say so.${widenLine}

Then call ${TOOL_NAME} with the median $/m², the sample_size, the median sale price and median floor area, and the source. Report ONLY figures the data shows — never invent. Use found=false ONLY if even the wider district has no published sales data at all.`;
}

// Plausible band for NZ residential $/m² — guards against a stray figure (a total
// sale price, a per-acre number, an OCR'd typo) producing an absurd Value Verdict.
const MIN_PER_SQM = 300;
const MAX_PER_SQM = 40_000;

export async function fetchSuburbValue(listing: ScrapedListing): Promise<SuburbValue | undefined> {
  // Web search is non-deterministic and thin-data suburbs routinely fail the first
  // pass, so the verdict would silently never render. Retry once, escalating to a
  // wider (district / region) search, before giving up.
  return (await attemptSuburbValue(listing, false)) ?? (await attemptSuburbValue(listing, true));
}

async function attemptSuburbValue(listing: ScrapedListing, widen: boolean): Promise<SuburbValue | undefined> {
  let resp;
  try {
    const client = getAnthropic();
    resp = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 2000,
      tools: [WEB_SEARCH_TOOL as unknown as Anthropic.ToolUnion, SUBURB_TOOL],
      messages: [{ role: "user", content: suburbPrompt(listing, widen) }],
    });
  } catch {
    return undefined; // let the caller fall through to the retry / graceful default
  }

  const tu = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME
  );
  if (!tu) return undefined;
  const d = tu.input as RawSuburbValue;
  const perSqm = d.median_per_sqm;
  if (!d.found || typeof perSqm !== "number" || !Number.isFinite(perSqm) || perSqm < MIN_PER_SQM || perSqm > MAX_PER_SQM) {
    return undefined;
  }

  const num = (n: unknown): number | undefined => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined);
  const retrieved = new Date().toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
  const suburb = [listing.suburb, listing.region ?? listing.city].filter(Boolean).join(", ") || listing.address || "this suburb";

  return {
    medianPerSqm: Math.round(perSqm),
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
