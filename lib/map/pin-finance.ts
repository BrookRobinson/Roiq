// ============================================================
// A pin's investor return, worked out the way its report's Financial tab does.
//
// The map used to run its own simpler sum: repairs by an older rule, no council
// rates, flat insurance, flat purchase costs, nothing for the work due during
// the hold and nothing for what renovating adds. So a pin could read better than
// its own report. Now a report leaves behind what that calculation needs — the
// renovation plan and the property's own estimates — and the map runs the
// Financial tab's `summarise()` on it with the reader's deposit, rate, loan and
// hold. One calculation, not two.
//
// Pure: runs where the report is (to build it) and on the server (to use it).
// ============================================================

import { buildRenoLines, lineCost, renoSplit, selectedRenoUplift } from "@/lib/renovations/plan";
import { defaultInputs, summarise, type FinanceSummary } from "@/lib/finance/calculator";
import type { StoredReport } from "@/lib/report-store";
import type { UserVariables } from "./types";

/** One line of the property's renovation plan, costed at the report's default option. */
export interface PinRenoLine {
  key: string;
  cost: number;
  /** Years until it falls due, from the item's own life. */
  urgencyYears: number;
  /** Needed at purchase or before renting — ticked by default in the report. */
  autoInclude: boolean;
  stopGap?: boolean;
  wholeRoom?: boolean;
  optIn?: boolean;
  /** What doing it adds to the property's value (0 for a repair). */
  valueGap?: number;
}

export interface PinFinance {
  v: 1;
  price: number;
  floorSqm: number;
  buildYear: number | null;
  weeklyRent: number;
  growthPct: number;
  reno: PinRenoLine[];
}

/**
 * What the map needs from a finished report to reproduce its Financial tab.
 *
 * Null when there is nothing to let — a bare section has no rent, no yield and
 * no cash flow, and the report refuses to compute one (see landOnly) — or no
 * price to buy it at.
 */
export function pinFinanceFrom(
  report: Pick<StoredReport, "listing" | "subItems" | "extraDwellings" | "context" | "marketRent" | "capitalGrowth" | "landOnly">
): PinFinance | null {
  const price = report.listing.askingPrice ?? 0;
  if (!(price > 0) || report.landOnly) return null;

  // The investor's plan, as the Renovations tab builds it for an investor
  // (that adds the Healthy Homes lines a landlord has to do).
  const lines = buildRenoLines(
    report.subItems ?? [],
    report.listing,
    "investor",
    report.extraDwellings ?? [],
    report.context?.healthyHomes
  );

  return {
    v: 1,
    price,
    floorSqm: report.listing.floorAreaSqm ?? 0,
    buildYear: report.listing.buildYear ?? null,
    // The Financial tab's own default rent.
    weeklyRent: report.marketRent?.weekly ?? Math.round((price * 0.04) / 52),
    growthPct: report.capitalGrowth?.annualRatePct ?? 5,
    reno: lines.map((l) => ({
      key: l.key,
      // Costed exactly as the plan's total costs it at the default option,
      // stored so the server needn't rebuild the costing tables.
      cost: Math.round(lineCost(l)),
      urgencyYears: l.urgencyYears,
      autoInclude: l.autoInclude,
      ...(l.stopGap ? { stopGap: true } : {}),
      ...(l.wholeRoom ? { wholeRoom: true } : {}),
      ...(l.optIn ? { optIn: true } : {}),
      ...(l.valueGap ? { valueGap: Math.round(l.valueGap) } : {}),
    })),
  };
}

export interface PinInvestor {
  summary: FinanceSummary;
  /** Return on the cash put in over the hold — the Financial tab's figure. */
  pct: number;
  renoAtPurchase: number;
  renoDuringHold: number;
}

/**
 * The Financial tab's answer for this property, on the reader's numbers.
 *
 * Everything the reader sets (deposit, rate, loan term, repayments, hold) comes
 * from their variables; everything about the property comes from its report.
 * The rest are the tab's own defaults, exactly as a reader opening the report
 * would first see them.
 */
export function investorFromPin(pf: PinFinance, vars: UserVariables): PinInvestor {
  const holdYears = vars.holdPeriodYears;
  const withinHold = (years: number) => years <= holdYears;
  // Stored lines carry a single cost; low = high = cost makes the plan's own
  // costing return it unchanged.
  const lines = pf.reno.map((l) => ({ ...l, low: l.cost, high: l.cost }));
  const { atPurchase, duringHold } = renoSplit(lines, {}, withinHold);
  const uplift = selectedRenoUplift(lines, {}, withinHold);

  const base = defaultInputs({
    persona: "investor",
    price: pf.price,
    floorSqm: pf.floorSqm,
    holdYears,
    renoCost: atPurchase,
    weeklyRent: pf.weeklyRent,
    growthPct: pf.growthPct,
    interestRatePct: vars.interestRatePct,
    buildYear: pf.buildYear,
  });
  const summary = summarise({
    ...base,
    depositPct: pf.price > 0 ? Math.min(1, Math.max(0, vars.depositAmount / pf.price)) : 0,
    loanTermYears: vars.loanTermYears,
    loanType: vars.repaymentType ?? "pi",
    holdYears,
    renoCost: atPurchase,
    renoDeferred: duringHold,
    renoUplift: uplift,
  });

  return { summary, pct: summary.returnOnCashPct, renoAtPurchase: Math.round(atPurchase), renoDuringHold: Math.round(duringHold) };
}
