// ============================================================
// Property Map — deal calculation. One function turns a scored listing + a
// user's saved variables + a mode into a colour, a headline %, and the figures
// the detail sheet shows. Investor figures are the report's own Financial tab
// (pin-finance.ts), never a separate formula.
// ============================================================

import { isScorable } from "@/lib/scoring/investment";
import { investorFromPin } from "./pin-finance";
import type { MapListing, UserVariables, MapMode, DealColour, PinColour, ComputedListing } from "./types";

// ±15% bands for green / orange / red (both modes, per spec).
const BAND = 15;

function colourFor(pct: number): DealColour {
  if (pct > BAND) return "green";
  if (pct < -BAND) return "red";
  return "orange";
}

/**
 * A stored valuation, or null if it isn't a real one.
 *
 * Two ways a row has none. New rows write null when the valuation couldn't be
 * made. OLDER rows were written when a failed valuation fell back to the ASKING
 * PRICE — so they hold the vendor's number under our name, indistinguishable
 * from ours except that it matches the asking price to the dollar. A real
 * valuation is `median $/m² × quality × floor area` rounded to the dollar, and
 * landing exactly on a round asking price essentially never happens, so the
 * exact match is the tell. Withholding the odd real valuation beats publishing
 * one we invented.
 */
export function realValuation(valuation: number | null, askingPrice: number | null): number | null {
  if (valuation == null) return null;
  if (askingPrice != null && valuation === askingPrice) return null;
  return valuation;
}

/**
 * A stored valuation, checked against the score it was built from.
 *
 * A valuation only exists because an analysis produced one, so a row whose
 * score doesn't qualify cannot have a valuation worth keeping — and the rows
 * are already in the table. 244 Upper Kokatahi Road scored zero because nothing
 * in it could be assessed, and $242,028 was written against a $699,000 asking
 * price before anything stopped it. Refusing only on the write path would leave
 * that figure on the map forever.
 */
export function valuationForScore(
  valuation: number | null,
  askingPrice: number | null,
  score: number | null
): number | null {
  if (!isScorable(score)) return null;
  return realValuation(valuation, askingPrice);
}

/**
 * Homebuyer mode = value vs price. The colour compares Tectara's valuation (already
 * computed from suburb $/m² × quality × floor area) against the asking price and
 * is the same for every user. Investor mode = projected return over the hold
 * period using this user's deposit / rate / costs, so it varies per user.
 */
export function computeListing(listing: MapListing, vars: UserVariables, mode: MapMode): ComputedListing {
  const asking = listing.askingPrice;
  const holdYears = vars.holdPeriodYears;

  // ── Homebuyer: valuation vs asking ──────────────────────────────
  // No valuation, or no asking price, means no gap — not a gap of zero. A zero
  // reads as "priced exactly right", which is a verdict, and we haven't got one.
  const roiqValuation = listing.roiqValuation;
  const valuationGapPct =
    roiqValuation != null && asking > 0 ? ((roiqValuation - asking) / asking) * 100 : null;

  // ── Investor: the report's own Financial tab, on this reader's numbers ──
  // The map used to run a simpler sum of its own (no rates, flat insurance,
  // only the work needed now). It now runs the Financial tab's summarise() on
  // the finance record the report left on the pin, so a pin's return is the
  // report's return for the same deposit, rate, loan and hold. A pin without
  // one (made before it existed, or bare land) gets no figure at all.
  const inv = listing.finance ? investorFromPin(listing.finance, vars) : null;
  const s = inv?.summary;
  const netProfitPctOfInvested = inv ? inv.pct : 0;
  const deposit = s?.deposit ?? 0;
  const returnOnDepositPct = s && deposit > 0 ? (s.walkAway / deposit) * 100 : 0;
  const adjustedPrice = asking + (inv?.renoAtPurchase ?? 0);

  const pct = mode === "homebuyer" ? valuationGapPct : inv ? netProfitPctOfInvested : null;
  const colour: PinColour = pct == null ? "unvalued" : colourFor(pct);

  return {
    colour,
    pct,
    holdYears,
    roiqValuation,
    valuationGapPct,
    investorAvailable: !!inv,
    renoAtPurchase: inv?.renoAtPurchase ?? 0,
    renoDuringHold: inv?.renoDuringHold ?? 0,
    totalCashIn: s?.totalCashIn ?? 0,
    adjustedBuyIn: Math.round(adjustedPrice),
    weeklyRent: listing.finance?.weeklyRent ?? listing.estimatedWeeklyRent,
    annualCashflow: Math.round((s?.netWeeklyCashflow ?? 0) * 52),
    capitalGain: Math.round((s?.projectedValue ?? 0) - (listing.finance?.price ?? asking)),
    netProfit: s?.walkAway ?? 0,
    returnOnDepositPct,
    netProfitPctOfInvested,
  };
}

/**
 * May the investor view run on these variables? Only on numbers the reader
 * saved themselves — anything else would be returns built on figures nobody
 * gave. Demo listings are fictional and exempt (callers pass `demo`).
 */
export function investorReady(vars: Pick<UserVariables, "numbersSet" | "browsing">): boolean {
  return vars.numbersSet === true && !vars.browsing;
}

/** Marker label, e.g. "+22%", "−18%". */
export function pctLabel(pct: number): string {
  const r = Math.round(pct);
  return `${r >= 0 ? "+" : "−"}${Math.abs(r)}%`;
}

export const DEAL_HEX: Record<DealColour, string> = {
  green: "#00e676",
  orange: "#fbbf24",
  red: "#ff5f5f",
};

/** No verdict — deliberately off the green/orange/red scale, matching the pin. */
export const NEUTRAL_HEX = "#8b93a1";

/** Colour for any pin state, verdict or not. */
export function pinHex(colour: PinColour): string {
  return colour === "green" || colour === "orange" || colour === "red"
    ? DEAL_HEX[colour]
    : NEUTRAL_HEX;
}
