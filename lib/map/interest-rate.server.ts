// ============================================================
// Property Map — the live default interest rate for Screen 1.
//
// SERVER ONLY. Kept apart from `interest-rate.ts` on purpose: that file holds
// the plain constant and is pulled into the client bundle by `variables.ts`,
// so it must stay free of the Anthropic SDK.
//
// The rate itself comes from `lib/ai/rates.ts`, which already researches the
// current NZ mortgage market (interest.co.nz + the major banks) with the source
// cited — the map has no reason to grow a second, separate rate feed.
// ============================================================

import { fetchMortgageRates, type MortgageRates } from "@/lib/ai/rates";
import { DEFAULT_INTEREST_RATE } from "./interest-rate";

const TTL_MS = 24 * 60 * 60 * 1000;

export interface DefaultRate {
  ratePct: number;
  /** Short, caption-sized attribution, e.g. "ASB 6-month fixed". */
  label: string;
  /** The full citation, for a tooltip or the methodology tab. */
  source: string;
  /** true = the hardcoded indicative rate, because the live lookup came back empty. */
  isFallback: boolean;
  retrievedAt: string | null;
}

/**
 * The research step often names every bank offering the equal-best rate
 * ("ASB / Kiwibank (6-month); ANZ & ASB (1yr); …"), which is useful in a citation
 * and far too long for a caption under a form field. Keep the first lender and
 * the term; the full string stays available as `source`.
 */
function shortLabel(lender: string, type: string): string {
  const firstLender = lender.split(/[;,/]|\band\b|&/)[0].replace(/\s*\([^)]*\)/g, "").trim();
  const term = type.split(/[;,]/)[0].replace(/\s*\([^)]*\)/g, "").trim();
  return [firstLender, term].filter(Boolean).join(" ").slice(0, 48) || "current market rate";
}

let cache: { at: number; value: DefaultRate } | null = null;
let inFlight: Promise<DefaultRate> | null = null;

const FALLBACK: DefaultRate = {
  ratePct: DEFAULT_INTEREST_RATE,
  label: "indicative rate",
  source: "Indicative NZ rate — live lookup unavailable",
  isFallback: true,
  retrievedAt: null,
};

/**
 * A user setting their variables shouldn't wait on a web search, and the whole
 * point of the number is to be a sensible default they can overtype. So: serve
 * the cache, refresh at most once a day, and fall back rather than fail.
 */
export async function getLiveDefaultRate(): Promise<DefaultRate> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  if (inFlight) return inFlight; // collapse a thundering herd into one search

  inFlight = (async () => {
    let rates: MortgageRates | null = null;
    try {
      rates = await fetchMortgageRates();
    } catch (err) {
      console.error("[map/interest-rate] live rate lookup failed", err);
    }

    const value: DefaultRate = rates
      ? {
          // The map's default should be what a buyer would actually pay, so use
          // the best advertised rate rather than a floating headline.
          ratePct: rates.bestRatePct,
          label: shortLabel(rates.lender, rates.bestType),
          source: `${rates.lender} ${rates.bestType} — ${rates.source}`,
          isFallback: false,
          retrievedAt: rates.retrievedAt,
        }
      : FALLBACK;

    // Cache the fallback too, so a flat API doesn't mean a web search per request.
    cache = { at: Date.now(), value };
    inFlight = null;
    return value;
  })();

  return inFlight;
}

/** Back-compat shim for callers that only want the number. */
export async function getDefaultInterestRate(): Promise<number> {
  return (await getLiveDefaultRate()).ratePct;
}
