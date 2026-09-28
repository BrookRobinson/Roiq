// ============================================================
// Property Map — shared types (client + server).
// ============================================================

import type { LoanType } from "@/lib/finance/calculator";

export type MapMode = "homebuyer" | "investor";
export type DealColour = "green" | "orange" | "red";

/**
 * What a pin can be on the wire: one of the three verdicts, or a reason there
 * isn't one. `unanalysed` = nobody has run a report; `unvalued` = we have a
 * report but no valuation to compare the asking price against. Both are grey,
 * because inventing a verdict is worse than admitting to not having one.
 */
export type PinColour = DealColour | "unvalued" | "unanalysed";

/**
 * A scored listing in the shape the map + detail sheet consume. Mirrors the
 * Supabase `map_listings` row (camelCased) plus the pre-computed scoring outputs
 * the 24-hour job / seed writes. The map never re-runs the AI — it reads these.
 */
export interface MapListing {
  id: string;
  address: string;
  suburb: string | null;
  city: string | null;
  region: string | null;
  lat: number;
  lng: number;
  askingPrice: number;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string | null;
  floorAreaSqm: number | null;
  landAreaSqm: number | null;
  photos: string[];
  listingType: "sale" | "auction" | "tender" | "deadline" | "negotiation" | null;

  // ── Pre-computed scoring outputs (from analyseProperty + investment math) ──
  /**
   * 0–1000 (buyer base), or null when the analysis assessed nothing.
   *
   * Null is NOT "not analysed" — a report exists and somebody paid for it. It
   * means every item came back unassessable, so there is no score to show. A
   * literal 0 must never reach a reader: against a real address it reads as the
   * worst property in the country. See isScorable().
   */
  roiqScore: number | null;
  /**
   * Our valuation — or null when we could not make one.
   *
   * It needs a suburb $/m² from recent sales AND a floor area, and neither is
   * guaranteed: a bare section has no floor area at all, and some suburbs come
   * back with no sales to median. This used to fall back to the ASKING PRICE,
   * which is not a fallback — it is the vendor's number handed back as ours,
   * and it made every property we had failed to value read on the map as
   * "Fair price — close to our estimated value." Null instead, and every
   * consumer says so rather than showing a figure.
   */
  roiqValuation: number | null;             // NZD — the REPORT's valuation, carried
  medianPerSqm: number | null;              // suburb median $/m² used for the valuation
  repairAllowance: number;                  // NZD — summed detected repairs
  repairBreakdown: Record<string, number>;  // e.g. { "Roof replacement": 29000 }
  estimatedWeeklyRent: number;              // NZD/week (suburb + bedrooms)
  suburbGrowthRatePct: number;              // annual capital-growth %, e.g. 4.5

  /** The portal page this pin came from — what "Analyse this property" opens. */
  listingUrl: string | null;
  fullReportId: string | null;              // link to an existing Tectara, if any
  /**
   * `removed` = the listing left the portal's for-sale index and a second
   * complete crawl confirmed it. Removed, NOT sold: a withdrawal and a sale
   * look identical from outside, so `sold` stays reserved for a row a sale
   * feed has actually priced. See lib/map/delisting.ts.
   */
  status: "active" | "sold" | "removed";

  /**
   * Has this property actually been analysed?
   *
   * False for a pin the nightly discovery job found on OneRoof's sitemap: we
   * know the house is for sale and roughly where, and nothing else. Every
   * scoring field above is a placeholder zero for these, so anything that
   * DISPLAYS or FILTERS on a number must check this first — a $0 valuation
   * shown against a real address is an invented figure, which is the one thing
   * this product can't do.
   */
  analysed: boolean;
  /** When its report was last scored — picks the current read when one house has two pins. */
  lastScoredAt?: string | null;
}

/**
 * The user's saved personal financial variables (Screen 1). Every figure the
 * investor-mode return calculation depends on lives here so the same listing can
 * read green for one user and red for another.
 */
export interface UserVariables {
  // Purchase
  budget: number;             // NZD — max purchase price; listings above this are hidden
  depositAmount: number;      // NZD
  interestRatePct: number;    // e.g. 6.5
  loanTermYears: number;      // 1–30
  /** How the loan is repaid: principal & interest, or interest only. */
  repaymentType: LoanType;
  holdPeriodYears: number;    // 1–30
  buyingCosts: number;        // NZD (legal + LIM)
  buildingReport: number;     // NZD

  // Selling
  agentCommissionPct: number; // e.g. 2.5
  sellingLegalCosts: number;  // NZD

  // Ongoing (investor mode only)
  propertyMgmtFeePct: number; // % of rent
  annualInsurance: number;    // NZD
  maintenancePct: number;     // % of property value
  vacancyRatePct: number;     // % of year

  // Growth
  capitalGrowthPct: number | null; // null = use each listing's own suburb rate
  rentalGrowthPct: number;         // % pa

  defaultMode: MapMode;

  /**
   * The property types this reader is looking for — the map, its pins and the
   * Top list only show these. Empty means every type. Saved with the rest so
   * the best deals don't surface on types they'd never buy.
   */
  propertyTypes: string[];

  /**
   * Opened with "Browse all properties" — no numbers entered. The home buyer
   * view needs none (our valuation against the asking price); the investor
   * view does, so it asks for them rather than running on figures nobody gave.
   * The purchase numbers held alongside are placeholders and must not be shown.
   */
  browsing?: boolean;

  /**
   * The reader saved their own purchase numbers through Variables. The investor
   * view is built from those numbers, so it runs ONLY when this is true. Old
   * saved settings don't have it: the form used to come pre-filled, so their
   * deposit and rate may never have been theirs.
   */
  numbersSet?: boolean;
}

/** Everything the map marker + detail sheet need after applying a user's variables. */
export interface ComputedListing {
  colour: PinColour;
  /** The marker % — gap for homebuyer, net-profit-of-invested for investor.
   *  Null in homebuyer mode when there is no valuation to compare against. */
  pct: number | null;
  holdYears: number;

  // Homebuyer
  roiqValuation: number | null;
  valuationGapPct: number | null;

  // Investor
  adjustedBuyIn: number;       // asking + repair allowance
  weeklyRent: number;
  annualCashflow: number;
  capitalGain: number;         // over the hold period
  netProfit: number;           // over the hold period
  returnOnDepositPct: number;  // net profit / deposit
  netProfitPctOfInvested: number;
}
