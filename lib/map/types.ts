// ============================================================
// Property Map — shared types (client + server).
// ============================================================

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
  roiqScore: number;                        // 0–1000 (buyer base)
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
  roiqValuation: number | null;             // NZD — roiqFairValue(medianPerSqm, score, floor)
  medianPerSqm: number | null;              // suburb median $/m² used for the valuation
  repairAllowance: number;                  // NZD — summed detected repairs
  repairBreakdown: Record<string, number>;  // e.g. { "Roof replacement": 29000 }
  estimatedWeeklyRent: number;              // NZD/week (suburb + bedrooms)
  suburbGrowthRatePct: number;              // annual capital-growth %, e.g. 4.5

  /** The portal page this pin came from — what "Analyse this property" opens. */
  listingUrl: string | null;
  fullReportId: string | null;              // link to an existing Tectara, if any
  status: "active" | "sold";

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
