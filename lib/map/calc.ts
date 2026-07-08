// ============================================================
// Property Map — deal calculation. One function turns a scored listing + a
// user's saved variables + a mode into a colour, a headline %, and the figures
// the detail sheet shows. Reuses the existing investment math (investment.ts).
// ============================================================

import { projectValue } from "@/lib/scoring/investment";
import type { MapListing, UserVariables, MapMode, DealColour, ComputedListing } from "./types";

// ±15% bands for green / orange / red (both modes, per spec).
const BAND = 15;

function colourFor(pct: number): DealColour {
  if (pct > BAND) return "green";
  if (pct < -BAND) return "red";
  return "orange";
}

/**
 * Homebuyer mode = value vs price. The colour compares RoiQ's valuation (already
 * computed from suburb $/m² × quality × floor area) against the asking price and
 * is the same for every user. Investor mode = projected return over the hold
 * period using this user's deposit / rate / costs, so it varies per user.
 */
export function computeListing(listing: MapListing, vars: UserVariables, mode: MapMode): ComputedListing {
  const asking = listing.askingPrice;
  const holdYears = vars.holdPeriodYears;
  // A global growth override, else each listing's own suburb rate.
  const growthRate = vars.capitalGrowthPct ?? listing.suburbGrowthRatePct;

  // ── Homebuyer: valuation vs asking ──────────────────────────────
  const roiqValuation = listing.roiqValuation;
  const valuationGapPct = asking > 0 ? ((roiqValuation - asking) / asking) * 100 : 0;

  // ── Investor: projected return over the hold period (spec formula block) ──
  const adjustedPrice = asking + listing.repairAllowance;
  const deposit = vars.depositAmount;
  const loanAmount = Math.max(0, adjustedPrice - deposit);

  const monthlyRate = vars.interestRatePct / 100 / 12;
  const payments = vars.loanTermYears * 12;
  const monthlyRepayment =
    payments <= 0
      ? 0
      : monthlyRate > 0
        ? (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, payments))) /
          (Math.pow(1 + monthlyRate, payments) - 1)
        : loanAmount / payments;
  const annualMortgage = monthlyRepayment * 12;

  const grossAnnualRent = listing.estimatedWeeklyRent * 52 * (1 - vars.vacancyRatePct / 100);
  const managementFee = grossAnnualRent * (vars.propertyMgmtFeePct / 100);
  const maintenance = adjustedPrice * (vars.maintenancePct / 100);
  const netAnnualRent = grossAnnualRent - managementFee - vars.annualInsurance - maintenance;

  const annualCashflow = netAnnualRent - annualMortgage;

  const salePrice = projectValue(adjustedPrice, growthRate, holdYears);
  const capitalGain = salePrice - adjustedPrice;
  const agentFee = salePrice * (vars.agentCommissionPct / 100);
  const netSaleProceeds = salePrice - agentFee - vars.sellingLegalCosts - loanAmount;

  const totalCashflow = annualCashflow * holdYears;
  const netProfit = totalCashflow + netSaleProceeds - deposit - vars.buyingCosts - vars.buildingReport;

  const totalInvested = deposit + vars.buyingCosts + vars.buildingReport;
  const netProfitPctOfInvested = totalInvested > 0 ? (netProfit / totalInvested) * 100 : 0;
  const returnOnDepositPct = deposit > 0 ? (netProfit / deposit) * 100 : 0;

  const pct = mode === "homebuyer" ? valuationGapPct : netProfitPctOfInvested;

  return {
    colour: colourFor(pct),
    pct,
    holdYears,
    roiqValuation,
    valuationGapPct,
    adjustedBuyIn: Math.round(adjustedPrice),
    weeklyRent: listing.estimatedWeeklyRent,
    annualCashflow: Math.round(annualCashflow),
    capitalGain: Math.round(capitalGain),
    netProfit: Math.round(netProfit),
    returnOnDepositPct,
    netProfitPctOfInvested,
  };
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
