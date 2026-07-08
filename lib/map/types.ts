// ============================================================
// Property Map — shared types (client + server).
// ============================================================

export type MapMode = "homebuyer" | "investor";
export type DealColour = "green" | "orange" | "red";

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
  roiqValuation: number;                    // NZD — roiqFairValue(medianPerSqm, score, floor)
  medianPerSqm: number | null;              // suburb median $/m² used for the valuation
  repairAllowance: number;                  // NZD — summed detected repairs
  repairBreakdown: Record<string, number>;  // e.g. { "Roof replacement": 29000 }
  estimatedWeeklyRent: number;              // NZD/week (suburb + bedrooms)
  suburbGrowthRatePct: number;              // annual capital-growth %, e.g. 4.5

  fullReportId: string | null;              // link to an existing RoiQ report, if any
  status: "active" | "sold";
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
  colour: DealColour;
  pct: number;                 // the marker % (gap for homebuyer, net-profit-of-invested for investor)
  holdYears: number;

  // Homebuyer
  roiqValuation: number;
  valuationGapPct: number;

  // Investor
  adjustedBuyIn: number;       // asking + repair allowance
  weeklyRent: number;
  annualCashflow: number;
  capitalGain: number;         // over the hold period
  netProfit: number;           // over the hold period
  returnOnDepositPct: number;  // net profit / deposit
  netProfitPctOfInvested: number;
}
