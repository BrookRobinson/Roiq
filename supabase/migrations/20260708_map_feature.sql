-- ============================================================
-- Property Map feature — extend map_listings with the scoring / colour outputs
-- the map reads, and users with the saved personal financial variables.
-- Additive only (IF NOT EXISTS); watchlist + market_data already exist.
-- ============================================================

-- ── map_listings: scoring + deal outputs ────────────────────────────────────
alter table public.map_listings
  add column if not exists city                    text,
  add column if not exists floor_area_sqm          integer,
  add column if not exists land_area_sqm           integer,
  add column if not exists photos                  jsonb,
  add column if not exists description             text,
  add column if not exists listing_type            text,
  add column if not exists roiq_valuation          integer,
  add column if not exists valuation_vs_asking_pct double precision,
  add column if not exists repair_allowance        integer default 0,
  add column if not exists repair_breakdown        jsonb,
  add column if not exists estimated_weekly_rent   integer,
  add column if not exists suburb_growth_rate_pct  double precision,
  add column if not exists projected_cashflow      integer,
  add column if not exists projected_capital_gain  integer,
  add column if not exists projected_net_profit    integer,
  add column if not exists five_year_return_pct    double precision,
  add column if not exists home_buyer_colour       text,
  add column if not exists investor_colour         text,
  add column if not exists last_scored_at          timestamptz,
  add column if not exists last_checked_at         timestamptz;

-- Viewport queries hit lat/lng + active status; index them.
create index if not exists map_listings_active_bbox_idx
  on public.map_listings (listing_status, lat, lng);

-- ── users: saved Property Map personal variables ────────────────────────────
alter table public.users
  add column if not exists map_budget                 integer,
  add column if not exists map_deposit_amount        integer,
  add column if not exists map_interest_rate         double precision,
  add column if not exists map_loan_term_years       integer,
  add column if not exists map_hold_period_years     integer,
  add column if not exists map_buying_costs          integer,
  add column if not exists map_building_report       integer,
  add column if not exists map_agent_commission      double precision,
  add column if not exists map_selling_legal_costs   integer,
  add column if not exists map_property_mgmt_fee_pct double precision,
  add column if not exists map_annual_insurance      integer,
  add column if not exists map_maintenance_pct       double precision,
  add column if not exists map_vacancy_rate_pct      double precision,
  add column if not exists map_capital_growth_pct    double precision,
  add column if not exists map_rental_growth_pct     double precision,
  add column if not exists map_default_mode          text;
