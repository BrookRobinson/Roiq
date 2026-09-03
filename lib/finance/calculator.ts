// ============================================================
// Tectara — property financial calculator (v3.8)
// Pure + deterministic. Answers: "buy today, sell in N years → walk away with $X".
// All NZ defaults live here; every value is overridable from the Finance tab UI.
// ============================================================

import { maintenancePctForAge } from "./maintenance";

export type RateType = "1yr" | "2yr" | "floating";
export type LoanType = "pi" | "io"; // principal & interest | interest only

export const FINANCE_DEFAULTS = {
  interestRatePct: 6.89, // indicative current NZ rate — override or fetch live
  depositPctBuyer: 0.2,
  depositPctInvestor: 0.3,
  loanTermYears: 30,
  maintenancePctOfPrice: 0.01,
  rebuildRatePerSqm: 2200,
  insurancePctOfRebuild: 0.0025,
  vacancyWeeks: 2,
  mgmtFeePct: 0.09,
  agentCommissionPct: 0.035,
  legalAtSale: 2000,
  taxRatePct: 33,
  brightLineYears: 2,
  termDepositRatePct: 5.5,
};

export const PURCHASE_COST_DEFAULTS = { legal: 2000, lim: 400, inspection: 600, loanFee: 500, valuation: 800 };
export type PurchaseCostKey = keyof typeof PURCHASE_COST_DEFAULTS;
export const PURCHASE_COST_LABELS: Record<PurchaseCostKey, string> = {
  legal: "Legal / conveyancing", lim: "LIM report", inspection: "Building inspection",
  loanFee: "Loan establishment fee", valuation: "Registered valuation",
};

/** Indicative annual council rates — a regional ESTIMATE, not a per-address figure. */
export function councilRatesEstimate(price: number): number {
  return Math.round(Math.max(2200, price * 0.003) / 50) * 50;
}

/** Annual home-insurance estimate via rebuild cost (floor × $/m² rebuild × premium %). */
export function insuranceEstimate(floorSqm: number): { annual: number; rebuild: number } {
  const floor = floorSqm > 0 ? floorSqm : 140;
  const rebuild = Math.round(floor * FINANCE_DEFAULTS.rebuildRatePerSqm);
  return { annual: Math.round((rebuild * FINANCE_DEFAULTS.insurancePctOfRebuild) / 10) * 10, rebuild };
}

/** Monthly principal & interest repayment. */
export function monthlyPI(principal: number, annualRatePct: number, termYears: number): number {
  const r = annualRatePct / 100 / 12;
  const n = termYears * 12;
  if (principal <= 0 || n <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function monthlyRepayment(principal: number, annualRatePct: number, termYears: number, loanType: LoanType): number {
  if (loanType === "io") return (principal * (annualRatePct / 100)) / 12;
  return monthlyPI(principal, annualRatePct, termYears);
}

/** Remaining loan balance after `afterYears` (P&I amortises; interest-only stays at principal). */
export function remainingBalance(principal: number, annualRatePct: number, termYears: number, afterYears: number, loanType: LoanType): number {
  if (loanType === "io") return principal;
  const r = annualRatePct / 100 / 12;
  const n = termYears * 12;
  const p = Math.min(Math.round(afterYears * 12), n);
  const m = monthlyPI(principal, annualRatePct, termYears);
  if (r === 0) return Math.max(0, principal - m * p);
  return Math.max(0, principal * Math.pow(1 + r, p) - (m * (Math.pow(1 + r, p) - 1)) / r);
}

export function projectValue(price: number, growthPct: number, years: number): number {
  return price * Math.pow(1 + growthPct / 100, years);
}

// ── Inputs / outputs ─────────────────────────────────────────────────────────
export interface FinanceInputs {
  persona: "buyer" | "investor";
  price: number;
  floorSqm: number;
  holdYears: number;
  depositPct: number;
  renoCost: number;
  /**
   * What the selected renovations add to what the property is WORTH, in the
   * app's own valuation model — not a market resale promise.
   *
   * Without this the walk-away figure counted every renovation as pure cash out
   * and moved the sale price not at all, which is not a neutral position: it
   * states that renovation returns EXACTLY ZERO, a claim as strong as any uplift
   * number and a good deal less likely. Spend $50k and the ten-year figure fell
   * by $50k to the dollar.
   */
  renoUplift: number;
  /**
   * Work that falls due LATER in the hold, not at settlement.
   *
   * Once the plan started following the hold slider, the renovation figure went
   * from $3,859 to $195,729 on a ten-year hold — and all of it landed in "Total
   * money needed to buy", which then read $430,029. A roof you replace in year
   * seven is not money you need on settlement day, and putting it there
   * overstates the deposit somebody has to find by the price of a roof.
   *
   * It is still real money and still comes off the walk-away; it just belongs in
   * the cost of OWNING the place rather than the cost of buying it.
   */
  renoDeferred: number;
  interestRatePct: number;
  loanTermYears: number;
  loanType: LoanType;
  purchaseCosts: Record<PurchaseCostKey, number>;
  purchaseCostsEnabled: Record<PurchaseCostKey, boolean>;
  councilRates: number; // annual
  insurance: number; // annual
  maintenancePctOfPrice: number;
  bodyCorp: number; // annual (0 if n/a)
  growthPct: number;
  // investor
  weeklyRent: number;
  vacancyWeeks: number;
  mgmtFeePct: number;
  mgmtEnabled: boolean;
  agentCommissionPct: number;
  legalAtSale: number;
  taxRatePct: number;
  termDepositRatePct: number;
}

export interface FinanceSummary {
  deposit: number;
  loan: number;
  purchaseCostsTotal: number;
  totalCashIn: number;
  monthly: number;
  weekly: number;
  annualRepay: number;
  totalRepayments: number;
  totalInterest: number;
  maintenance: number;
  annualOngoing: number;
  weeklyOngoing: number;
  // investor
  grossAnnualRent: number;
  vacancyLoss: number;
  mgmtFee: number;
  netAnnualRent: number;
  netWeeklyRent: number;
  netWeeklyCashflow: number;
  grossYieldPct: number;
  netYieldPct: number;
  totalInvestment: number;
  rentalIncomeOverHold: number;
  // sale
  projectedValue: number;
  renoUplift: number;
  renoDeferred: number;
  remainingLoan: number;
  agentFees: number;
  saleLegal: number;
  netSaleProceeds: number;
  // projection
  projection: { year: number; value: number; equity: number }[];
  // tax
  brightLineApplies: boolean;
  interestDeductSaving: number;
  // final answer
  totalOngoingOverHold: number; // rates+ins+maint+bodycorp + mortgage repayments
  netCostOfOwnership: number; // total ongoing − rental income
  walkAway: number;
  returnOnCashPct: number;
  annualReturnPct: number;
  termDepositValue: number;
}

export function summarise(i: FinanceInputs): FinanceSummary {
  const price = Math.max(0, i.price);
  const deposit = Math.round(price * i.depositPct);
  const loan = Math.max(0, price - deposit);

  const keys: PurchaseCostKey[] = ["legal", "lim", "inspection", "loanFee", "valuation"];
  const purchaseCostsTotal = keys.reduce((s, k) => s + (i.purchaseCostsEnabled[k] === false ? 0 : i.purchaseCosts[k] || 0), 0);
  // Settlement cash only — deferred work is a holding cost, counted below.
  const totalCashIn = deposit + purchaseCostsTotal + (i.renoCost || 0);

  const monthly = monthlyRepayment(loan, i.interestRatePct, i.loanTermYears, i.loanType);
  const weekly = (monthly * 12) / 52;
  const annualRepay = monthly * 12;
  const holdMonths = Math.min(i.holdYears, i.loanTermYears) * 12;
  const totalRepayments = monthly * holdMonths;
  const remainingLoan = Math.round(remainingBalance(loan, i.interestRatePct, i.loanTermYears, i.holdYears, i.loanType));
  const principalPaid = loan - remainingLoan;
  const totalInterest = Math.max(0, totalRepayments - principalPaid);

  const maintenance = price * i.maintenancePctOfPrice;
  const annualOngoing = i.councilRates + i.insurance + maintenance + i.bodyCorp;
  const weeklyOngoing = annualOngoing / 52;

  // investor
  const grossAnnualRent = i.weeklyRent * 52;
  const vacancyLoss = i.weeklyRent * i.vacancyWeeks;
  const mgmtFee = i.mgmtEnabled ? grossAnnualRent * i.mgmtFeePct : 0;
  const netAnnualRent = grossAnnualRent - vacancyLoss - mgmtFee;
  const netWeeklyRent = netAnnualRent / 52;
  const netWeeklyCashflow = netWeeklyRent - weekly - weeklyOngoing;
  const totalInvestment = price + purchaseCostsTotal + (i.renoCost || 0) + (i.renoDeferred || 0);
  const grossYieldPct = price > 0 ? (grossAnnualRent / price) * 100 : 0;
  const netYieldPct = totalInvestment > 0 ? (netAnnualRent / totalInvestment) * 100 : 0;
  const isInvestor = i.persona === "investor";
  const rentalIncomeOverHold = isInvestor ? Math.round(netAnnualRent * i.holdYears) : 0;

  // sale
  // The renovation lands at purchase, so the market grows the improved value
  // rather than the bought value. `renoUplift` is 0 unless work is ticked.
  const improvedValue = price + (i.renoUplift || 0);
  const projectedValue = Math.round(projectValue(improvedValue, i.growthPct, i.holdYears));
  const agentFees = Math.round(projectedValue * i.agentCommissionPct);
  const saleLegal = i.legalAtSale;
  const netSaleProceeds = projectedValue - remainingLoan - agentFees - saleLegal;

  // year-by-year projection (value + equity) for the chart
  const projection: { year: number; value: number; equity: number }[] = [];
  for (let y = 1; y <= i.holdYears; y++) {
    const v = Math.round(projectValue(improvedValue, i.growthPct, y));
    const bal = Math.round(remainingBalance(loan, i.interestRatePct, i.loanTermYears, y, i.loanType));
    projection.push({ year: y, value: v, equity: v - bal });
  }

  // tax
  const brightLineApplies = i.holdYears < FINANCE_DEFAULTS.brightLineYears;
  const annualInterestApprox = loan * (i.interestRatePct / 100); // ~year-1 interest
  const interestDeductSaving = isInvestor ? Math.round(annualInterestApprox * (i.taxRatePct / 100)) : 0;

  // final answer — full-cashflow model (principal paydown is captured in net sale
  // proceeds, so subtracting full repayments here is correct double-entry).
  const totalOngoingOverHold = Math.round(annualOngoing * i.holdYears + totalRepayments);
  // Deferred renovation is money spent while you own it, so it sits here
  // rather than in the deposit. The walk-away subtracts both either way.
  const netCostOfOwnership = Math.round(totalOngoingOverHold - rentalIncomeOverHold + (i.renoDeferred || 0));
  const walkAway = Math.round(netSaleProceeds - totalCashIn - netCostOfOwnership);
  const returnOnCashPct = totalCashIn > 0 ? (walkAway / totalCashIn) * 100 : 0;
  const totalReturnRatio = totalCashIn > 0 ? (walkAway + totalCashIn) / totalCashIn : 1;
  const annualReturnPct = totalCashIn > 0 && totalReturnRatio > 0 && i.holdYears > 0
    ? (Math.pow(totalReturnRatio, 1 / i.holdYears) - 1) * 100
    : 0;
  const termDepositValue = Math.round(totalCashIn * Math.pow(1 + i.termDepositRatePct / 100, i.holdYears));

  return {
    deposit, loan, purchaseCostsTotal, totalCashIn,
    monthly: Math.round(monthly), weekly: Math.round(weekly), annualRepay: Math.round(annualRepay),
    totalRepayments: Math.round(totalRepayments), totalInterest: Math.round(totalInterest),
    maintenance: Math.round(maintenance), annualOngoing: Math.round(annualOngoing), weeklyOngoing: Math.round(weeklyOngoing),
    grossAnnualRent: Math.round(grossAnnualRent), vacancyLoss: Math.round(vacancyLoss), mgmtFee: Math.round(mgmtFee),
    netAnnualRent: Math.round(netAnnualRent), netWeeklyRent: Math.round(netWeeklyRent), netWeeklyCashflow: Math.round(netWeeklyCashflow),
    grossYieldPct, netYieldPct, totalInvestment, rentalIncomeOverHold,
    projectedValue, renoUplift: i.renoUplift || 0, renoDeferred: i.renoDeferred || 0, remainingLoan, agentFees, saleLegal, netSaleProceeds,
    projection, brightLineApplies, interestDeductSaving,
    totalOngoingOverHold, netCostOfOwnership, walkAway, returnOnCashPct, annualReturnPct, termDepositValue,
  };
}

/** Build default inputs for a property — the UI seeds its editable state from this. */
export function defaultInputs(args: {
  persona: "buyer" | "investor";
  price: number;
  floorSqm: number;
  holdYears: number;
  renoCost: number;
  weeklyRent: number;
  growthPct: number;
  interestRatePct?: number;
  bodyCorp?: number;
  /** Scales the maintenance allowance — a new build costs less to keep. */
  buildYear?: number | null;
  /** Injected so the figure is reproducible rather than drifting with the clock. */
  thisYear?: number;
}): FinanceInputs {
  const ins = insuranceEstimate(args.floorSqm);
  return {
    persona: args.persona,
    price: args.price,
    floorSqm: args.floorSqm,
    holdYears: args.holdYears,
    depositPct: args.persona === "investor" ? FINANCE_DEFAULTS.depositPctInvestor : FINANCE_DEFAULTS.depositPctBuyer,
    renoCost: args.renoCost,
    renoUplift: 0,   // set per render from the ticked reno lines
    renoDeferred: 0,
    interestRatePct: args.interestRatePct ?? FINANCE_DEFAULTS.interestRatePct,
    loanTermYears: FINANCE_DEFAULTS.loanTermYears,
    loanType: args.persona === "investor" ? "io" : "pi",
    purchaseCosts: { ...PURCHASE_COST_DEFAULTS },
    purchaseCostsEnabled: { legal: true, lim: true, inspection: true, loanFee: true, valuation: true },
    councilRates: councilRatesEstimate(args.price),
    insurance: ins.annual,
    maintenancePctOfPrice: maintenancePctForAge(args.buildYear, args.thisYear ?? new Date().getFullYear()),
    bodyCorp: args.bodyCorp ?? 0,
    growthPct: args.growthPct,
    weeklyRent: args.weeklyRent,
    vacancyWeeks: FINANCE_DEFAULTS.vacancyWeeks,
    mgmtFeePct: FINANCE_DEFAULTS.mgmtFeePct,
    mgmtEnabled: true,
    agentCommissionPct: FINANCE_DEFAULTS.agentCommissionPct,
    legalAtSale: FINANCE_DEFAULTS.legalAtSale,
    taxRatePct: FINANCE_DEFAULTS.taxRatePct,
    termDepositRatePct: FINANCE_DEFAULTS.termDepositRatePct,
  };
}
