import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropic, ANALYSIS_MODEL } from "./client";

// Researches the current best NZ residential mortgage rate via web search
// (interest.co.nz + the major banks), with the source cited. Non-fatal — callers
// fall back to an indicative default. Never invents a rate.

export interface MortgageRates {
  bestRatePct: number;
  bestType: string; // "1yr fixed" | "2yr fixed" | "floating"
  lender: string;
  options: { label: string; ratePct: number }[];
  source: string;
  retrievedAt: string; // YYYY-MM-DD
  note?: string;
}

interface RawRates {
  found: boolean;
  best_rate_pct?: number;
  best_type?: string;
  lender?: string;
  one_yr_pct?: number;
  two_yr_pct?: number;
  floating_pct?: number;
  source?: string;
  note?: string;
}

const RATES_TOOL_NAME = "submit_rates";
const RATES_TOOL: Anthropic.Tool = {
  name: RATES_TOOL_NAME,
  description: "Submit the current best NZ residential mortgage rates found, with the exact source cited.",
  input_schema: {
    type: "object",
    properties: {
      found: { type: "boolean", description: "False if you could not find reliable current rates." },
      best_rate_pct: { type: "number", description: "The LOWEST current advertised standard residential rate across the terms, % (e.g. 6.89)." },
      best_type: { type: "string", description: "Which term the best rate is, e.g. '1yr fixed', '2yr fixed', 'floating'." },
      lender: { type: "string", description: "The bank offering the best rate (ANZ, ASB, Westpac, BNZ, Kiwibank)." },
      one_yr_pct: { type: "number", description: "Best 1-year fixed rate, %." },
      two_yr_pct: { type: "number", description: "Best 2-year fixed rate, %." },
      floating_pct: { type: "number", description: "Best floating/variable rate, %." },
      source: { type: "string", description: "Exact source + date, e.g. 'interest.co.nz mortgage rates table, 9 Jun 2026'." },
      note: { type: "string", description: "Any honest caveat, e.g. 'special rates may require 20% equity'." },
    },
    required: ["found"],
  },
};

const WEB_SEARCH_TOOL = { type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 5 };

const PROMPT = `Find the CURRENT best advertised residential mortgage interest rates in New Zealand right now.
Use web search — prefer interest.co.nz's mortgage rates table, and the major banks (ANZ, ASB, Westpac, BNZ, Kiwibank).
Find the best current 1-year fixed, 2-year fixed, and floating rates, and which bank offers each.
Then call ${RATES_TOOL_NAME} with the figures, the lowest overall rate as best_rate_pct, and the EXACT source + date. Report only what the sources actually show — never invent a rate. If you cannot find reliable data, call ${RATES_TOOL_NAME} with found=false.`;

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function fetchMortgageRates(): Promise<MortgageRates | null> {
  const client = getAnthropic();
  const resp = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 1500,
    tools: [WEB_SEARCH_TOOL as unknown as Anthropic.ToolUnion, RATES_TOOL],
    messages: [{ role: "user", content: PROMPT }],
  });

  const tu = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === RATES_TOOL_NAME
  );
  if (!tu) return null;
  const d = tu.input as RawRates;
  if (!d.found || !Number.isFinite(d.best_rate_pct) || (d.best_rate_pct as number) <= 0) return null;

  const options: { label: string; ratePct: number }[] = [];
  if (Number.isFinite(d.one_yr_pct)) options.push({ label: "1yr fixed", ratePct: round2(d.one_yr_pct as number) });
  if (Number.isFinite(d.two_yr_pct)) options.push({ label: "2yr fixed", ratePct: round2(d.two_yr_pct as number) });
  if (Number.isFinite(d.floating_pct)) options.push({ label: "Floating", ratePct: round2(d.floating_pct as number) });

  return {
    bestRatePct: round2(d.best_rate_pct as number),
    bestType: d.best_type?.trim() || "fixed",
    lender: d.lender?.trim() || "NZ bank",
    options,
    source: d.source?.trim() || "interest.co.nz",
    retrievedAt: new Date().toISOString().slice(0, 10),
    note: d.note?.trim() || undefined,
  };
}
