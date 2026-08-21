// ============================================================
// Property Map — personal variables: defaults, localStorage persistence, and
// mapping to/from the Supabase `users` map_* columns. localStorage is the
// working store today (these are per-device preferences, not account data);
// the API route additionally persists to the users row when a real user exists.
// ============================================================

import type { UserVariables } from "./types";
import { DEFAULT_INTEREST_RATE } from "./interest-rate";

const KEY = "roiq:map:vars";

// Smart defaults (spec). Deposit is a placeholder ~20% of a typical NZ listing;
// TODO: estimate from the average asking price of the loaded listings.
export const DEFAULT_VARIABLES: UserVariables = {
  budget: 2_000_000, // max purchase price — properties above this are hidden on the map
  depositAmount: 200_000,
  interestRatePct: DEFAULT_INTEREST_RATE,
  loanTermYears: 30,
  holdPeriodYears: 5,
  buyingCosts: 3_000,
  buildingReport: 600,

  agentCommissionPct: 2.5,
  sellingLegalCosts: 1_500,

  propertyMgmtFeePct: 8,
  annualInsurance: 1_800,
  maintenancePct: 1,
  vacancyRatePct: 4,

  capitalGrowthPct: null, // null = use each listing's own suburb rate
  rentalGrowthPct: 3,

  defaultMode: "homebuyer",
};

/** Fill any missing keys with defaults so older saved payloads keep working. */
export function withDefaults(partial: Partial<UserVariables> | null | undefined): UserVariables {
  return { ...DEFAULT_VARIABLES, ...(partial ?? {}) };
}

export function loadVariables(): UserVariables | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? withDefaults(JSON.parse(raw) as Partial<UserVariables>) : null;
  } catch {
    return null;
  }
}

export function saveVariables(vars: UserVariables): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(vars));
  } catch {
    /* storage unavailable */
  }
}

export function hasVariables(): boolean {
  return loadVariables() !== null;
}

// ── Supabase users row <-> UserVariables (map_* columns) ─────────────────────
// Kept as plain objects so this module stays client-safe (no supabase import).

export interface MapUserColumns {
  map_budget: number | null;
  map_deposit_amount: number | null;
  map_interest_rate: number | null;
  map_loan_term_years: number | null;
  map_hold_period_years: number | null;
  map_buying_costs: number | null;
  map_building_report: number | null;
  map_agent_commission: number | null;
  map_selling_legal_costs: number | null;
  map_property_mgmt_fee_pct: number | null;
  map_annual_insurance: number | null;
  map_maintenance_pct: number | null;
  map_vacancy_rate_pct: number | null;
  map_capital_growth_pct: number | null;
  map_rental_growth_pct: number | null;
  map_default_mode: string | null; // "homebuyer" | "investor" — text column
}

export function variablesToColumns(v: UserVariables): MapUserColumns {
  return {
    map_budget: v.budget,
    map_deposit_amount: v.depositAmount,
    map_interest_rate: v.interestRatePct,
    map_loan_term_years: v.loanTermYears,
    map_hold_period_years: v.holdPeriodYears,
    map_buying_costs: v.buyingCosts,
    map_building_report: v.buildingReport,
    map_agent_commission: v.agentCommissionPct,
    map_selling_legal_costs: v.sellingLegalCosts,
    map_property_mgmt_fee_pct: v.propertyMgmtFeePct,
    map_annual_insurance: v.annualInsurance,
    map_maintenance_pct: v.maintenancePct,
    map_vacancy_rate_pct: v.vacancyRatePct,
    map_capital_growth_pct: v.capitalGrowthPct,
    map_rental_growth_pct: v.rentalGrowthPct,
    map_default_mode: v.defaultMode,
  };
}

/** Build UserVariables from a (possibly sparse) users row; missing → default. */
export function variablesFromColumns(row: Partial<MapUserColumns> | null | undefined): UserVariables {
  if (!row) return DEFAULT_VARIABLES;
  const d = DEFAULT_VARIABLES;
  const n = (val: number | null | undefined, fb: number) => (val == null ? fb : val);
  return {
    budget: n(row.map_budget, d.budget),
    depositAmount: n(row.map_deposit_amount, d.depositAmount),
    interestRatePct: n(row.map_interest_rate, d.interestRatePct),
    loanTermYears: n(row.map_loan_term_years, d.loanTermYears),
    holdPeriodYears: n(row.map_hold_period_years, d.holdPeriodYears),
    buyingCosts: n(row.map_buying_costs, d.buyingCosts),
    buildingReport: n(row.map_building_report, d.buildingReport),
    agentCommissionPct: n(row.map_agent_commission, d.agentCommissionPct),
    sellingLegalCosts: n(row.map_selling_legal_costs, d.sellingLegalCosts),
    propertyMgmtFeePct: n(row.map_property_mgmt_fee_pct, d.propertyMgmtFeePct),
    annualInsurance: n(row.map_annual_insurance, d.annualInsurance),
    maintenancePct: n(row.map_maintenance_pct, d.maintenancePct),
    vacancyRatePct: n(row.map_vacancy_rate_pct, d.vacancyRatePct),
    capitalGrowthPct: row.map_capital_growth_pct ?? null,
    rentalGrowthPct: n(row.map_rental_growth_pct, d.rentalGrowthPct),
    defaultMode: row.map_default_mode === "investor" ? "investor" : row.map_default_mode === "homebuyer" ? "homebuyer" : d.defaultMode,
  };
}
