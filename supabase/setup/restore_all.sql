-- ============================================================
-- RoiQ — FULL DATABASE RESTORE (single-run)
-- Paste this whole file into Supabase SQL Editor and click Run.
-- Idempotent: safe to re-run. Generated from supabase/migrations/*.
-- ============================================================


-- ####################  20260605_base_schema.sql  ####################

-- ============================================================
-- RoiQ — Base schema (foundation the other migrations build on)
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- ============================================================
--
-- Creates the core tables (users, reports, listing_photos, market_data,
-- map_listings, watchlist, alerts), row-level security, and the trigger that
-- mirrors auth.users into public.users on signup.
--
-- Run BEFORE: 20260606_v3_schema.sql, 20260708_map_feature.sql,
--             20260804_shared_reports.sql
-- Idempotent — safe to re-run.

create extension if not exists pgcrypto;   -- gen_random_bytes / gen_random_uuid

-- ── users (profile mirror of auth.users) ────────────────────────────────────
create table if not exists public.users (
  id                     uuid primary key references auth.users(id) on delete cascade,
  email                  text not null,
  created_at             timestamptz not null default now(),
  plan                   text not null default 'free',   -- 'free' | 'starter' | 'pro'
  stripe_customer_id     text,
  stripe_subscription_id text,
  subscription_status    text,
  preferred_deposit_pct  numeric not null default 20,
  preferred_currency     text not null default 'NZD',
  dark_mode              boolean not null default false,
  alert_preferences      jsonb
);

-- ── reports ─────────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  created_at        timestamptz not null default now(),
  listing_url       text,
  address           text,
  suburb            text,
  region            text,
  country           text not null default 'NZ',
  asking_price      numeric,
  floor_area_sqm    numeric,
  land_area_sqm     numeric,
  bedrooms          integer,
  bathrooms         numeric,
  car_parks         integer,
  build_year        integer,
  property_type     text,
  title_type        text,
  listing_source    text,
  quality_score     integer,
  vfm_grade         text,
  category_scores   jsonb,
  photo_analysis    jsonb,
  renovation_items  jsonb,
  healthy_homes     jsonb,
  financial_defaults jsonb,
  hazard_findings   jsonb,
  comparables       jsonb,
  report_status     text not null default 'pending',   -- pending|processing|complete|failed
  is_public         boolean not null default false,
  share_token       text,
  pdf_url           text,
  quick_score_only  boolean not null default false
);
create index if not exists reports_user_id on public.reports(user_id);

-- ── listing_photos ──────────────────────────────────────────────────────────
create table if not exists public.listing_photos (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references public.reports(id) on delete cascade,
  photo_number    integer not null,
  storage_url     text not null,
  ai_analysis     jsonb,
  confidence_tier integer,
  flags           jsonb
);
create index if not exists listing_photos_report_id on public.listing_photos(report_id);

-- ── market_data (public reference data) ─────────────────────────────────────
create table if not exists public.market_data (
  id                  uuid primary key default gen_random_uuid(),
  suburb              text not null,
  region              text not null,
  country             text not null default 'NZ',
  avg_value           numeric,
  median_rent_weekly  numeric,
  growth_rate_annual  numeric,
  days_to_sell_median numeric,
  rental_yield_gross  numeric,
  data_source         text,
  last_updated        timestamptz not null default now()
);

-- ── map_listings (public listings for the Property Map) ─────────────────────
-- Core columns only; 20260708_map_feature.sql adds the scoring/deal columns.
create table if not exists public.map_listings (
  id                  uuid primary key default gen_random_uuid(),
  listing_url         text not null,
  address             text,
  suburb              text,
  region              text,
  lat                 double precision,
  lng                 double precision,
  asking_price        numeric,
  bedrooms            integer,
  bathrooms           numeric,
  property_type       text,
  title_type          text,
  build_year          integer,
  quick_quality_score integer,
  vfm_grade           text,
  gross_yield_est     double precision,
  profit_10yr_est     numeric,
  opportunity_grade   text,
  full_report_id      uuid references public.reports(id) on delete set null,
  listing_status      text not null default 'active',   -- active|sold|removed
  first_seen          timestamptz not null default now(),
  last_seen           timestamptz not null default now(),
  source_portal       text
);

-- ── watchlist ───────────────────────────────────────────────────────────────
create table if not exists public.watchlist (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  map_listing_id uuid not null references public.map_listings(id) on delete cascade,
  added_at       timestamptz not null default now(),
  unique(user_id, map_listing_id)
);
create index if not exists watchlist_user_id on public.watchlist(user_id);

-- ── alerts ──────────────────────────────────────────────────────────────────
create table if not exists public.alerts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  filters        jsonb not null default '{}'::jsonb,
  last_triggered timestamptz,
  is_active      boolean not null default true
);
create index if not exists alerts_user_id on public.alerts(user_id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.users          enable row level security;
alter table public.reports        enable row level security;
alter table public.listing_photos enable row level security;
alter table public.market_data    enable row level security;
alter table public.map_listings   enable row level security;
alter table public.watchlist      enable row level security;
alter table public.alerts         enable row level security;

-- users: a person sees and edits only their own profile row.
drop policy if exists "Users read own profile" on public.users;
create policy "Users read own profile" on public.users
  for select using (id = auth.uid());
drop policy if exists "Users update own profile" on public.users;
create policy "Users update own profile" on public.users
  for update using (id = auth.uid());

-- reports: full CRUD on your own reports.
drop policy if exists "Users manage own reports" on public.reports;
create policy "Users manage own reports" on public.reports
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- listing_photos: access gated through the owning report.
drop policy if exists "Users manage photos on own reports" on public.listing_photos;
create policy "Users manage photos on own reports" on public.listing_photos
  for all using (report_id in (select id from public.reports where user_id = auth.uid()))
  with check (report_id in (select id from public.reports where user_id = auth.uid()));

-- market_data + map_listings: public reference data, readable by anyone.
drop policy if exists "Anyone can read market data" on public.market_data;
create policy "Anyone can read market data" on public.market_data
  for select using (true);
drop policy if exists "Anyone can read map listings" on public.map_listings;
create policy "Anyone can read map listings" on public.map_listings
  for select using (true);

-- watchlist + alerts: per-user.
drop policy if exists "Users manage own watchlist" on public.watchlist;
create policy "Users manage own watchlist" on public.watchlist
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users manage own alerts" on public.alerts;
create policy "Users manage own alerts" on public.alerts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- Mirror new auth users into public.users
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any auth users that predate this trigger.
insert into public.users (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ============================================================
-- Done. Now run 20260606_v3_schema.sql, 20260708_map_feature.sql,
-- then 20260804_shared_reports.sql (or use setup/restore_all.sql).
-- ============================================================

-- ####################  20260606_v3_schema.sql  ####################

-- ============================================================
-- RoiQ V3 Schema Migration
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- ============================================================

-- ── User profile additions ─────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'buyer';
  -- 'buyer' | 'investor' | 'both'

ALTER TABLE users ADD COLUMN IF NOT EXISTS hold_period_years integer DEFAULT 10;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_budget numeric;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deposit_available numeric;
ALTER TABLE users ADD COLUMN IF NOT EXISTS target_regions text[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS target_suburbs text[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS min_bedrooms integer DEFAULT 2;
ALTER TABLE users ADD COLUMN IF NOT EXISTS min_land_sqm integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_property_types text[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS freehold_only boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS min_quality_score integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS min_gross_yield numeric DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rental_type text DEFAULT 'longterm';
  -- 'longterm' | 'shortterm' | 'both'
ALTER TABLE users ADD COLUMN IF NOT EXISTS nationwide_search boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hold_indefinitely boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- ── Report gaps ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_gaps (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id               uuid REFERENCES reports(id) ON DELETE CASCADE,
  gap_type                text NOT NULL,
    -- 'missing_photo' | 'missing_data' | 'unconfirmed'
  area                    text NOT NULL,
    -- e.g. 'west_wall' | 'foundation' | 'floor_area' | 'electrical_board'
  label                   text NOT NULL,
  description             text,
  included_in_agent_letter boolean DEFAULT true,
  included_in_lim_letter  boolean DEFAULT false,
  resolved                boolean DEFAULT false,
  resolved_at             timestamptz,
  resolved_by_photo_id    uuid,
  created_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_gaps_report_id ON report_gaps(report_id);
CREATE INDEX IF NOT EXISTS report_gaps_resolved   ON report_gaps(report_id, resolved);

-- RLS
ALTER TABLE report_gaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own report gaps" ON report_gaps;
CREATE POLICY "Users can view their own report gaps"
  ON report_gaps FOR SELECT
  USING (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert gaps for their own reports" ON report_gaps;
CREATE POLICY "Users can insert gaps for their own reports"
  ON report_gaps FOR INSERT
  WITH CHECK (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their own gaps" ON report_gaps;
CREATE POLICY "Users can update their own gaps"
  ON report_gaps FOR UPDATE
  USING (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

-- ── Upload tokens (agent portal) ──────────────────────────
CREATE TABLE IF NOT EXISTS report_upload_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid REFERENCES reports(id) ON DELETE CASCADE,
  -- URL-safe token: base64 with +/ → -_ and padding stripped (encode() has no
  -- native 'base64url', so we derive it — Postgres only supports base64/hex/escape).
  token       text UNIQUE NOT NULL DEFAULT rtrim(replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'), '='),
  created_at  timestamptz DEFAULT now(),
  expires_at  timestamptz DEFAULT (now() + interval '30 days'),
  used_count  integer DEFAULT 0,
  is_active   boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS upload_tokens_token ON report_upload_tokens(token);
CREATE INDEX IF NOT EXISTS upload_tokens_report ON report_upload_tokens(report_id);

-- No RLS on upload tokens — agents access via token only (public, expiry-controlled)
ALTER TABLE report_upload_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active non-expired tokens by token value" ON report_upload_tokens;
CREATE POLICY "Anyone can read active non-expired tokens by token value"
  ON report_upload_tokens FOR SELECT
  USING (is_active = true AND expires_at > now());

DROP POLICY IF EXISTS "Report owners can manage their tokens" ON report_upload_tokens;
CREATE POLICY "Report owners can manage their tokens"
  ON report_upload_tokens FOR ALL
  USING (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

-- ── Regional labour rates ──────────────────────────────────
CREATE TABLE IF NOT EXISTS regional_labour_rates (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region               text NOT NULL,
  trade                text NOT NULL,
    -- 'roofing' | 'cladding_paint' | 'windows' | 'electrical' | 'plumbing'
    -- 'tiling' | 'flooring_carpet' | 'flooring_timber' | 'insulation'
    -- 'heat_pump' | 'decking' | 'fencing' | 'concrete' | 'drainage'
  rate_per_sqm         numeric,
  rate_per_hour        numeric,
  material_per_sqm     numeric,
  regional_multiplier  numeric NOT NULL DEFAULT 1.0,
  job_count            integer DEFAULT 0,
  data_source          text,
  confidence           text DEFAULT 'medium',
    -- 'high' | 'medium' | 'low' | 'ai_estimate'
  last_updated         timestamptz DEFAULT now(),
  UNIQUE(region, trade)
);

-- Seed regional multipliers for all NZ regions × common trades
INSERT INTO regional_labour_rates (region, trade, rate_per_sqm, rate_per_hour, material_per_sqm, regional_multiplier, job_count, data_source, confidence)
VALUES
  -- Auckland (base = 1.0)
  ('Auckland', 'roofing',         95,  null, 22, 1.00, 142, 'Builderscrack Auckland', 'high'),
  ('Auckland', 'cladding_paint',  28,  null,  8, 1.00,  98, 'Builderscrack Auckland', 'high'),
  ('Auckland', 'windows',         null, 85, null, 1.00, 67, 'Builderscrack Auckland', 'high'),
  ('Auckland', 'electrical',      null,110, null, 1.00, 203, 'Registered Master Electricians', 'high'),
  ('Auckland', 'plumbing',        null,115, null, 1.00, 178, 'Plumbers Gasfitters NZ', 'high'),
  ('Auckland', 'insulation',      14,  null,  9, 1.00,  54, 'Builderscrack Auckland', 'high'),
  ('Auckland', 'decking',         120, null, 80, 1.00,  41, 'Builderscrack Auckland', 'high'),

  -- Wellington
  ('Wellington', 'roofing',       88,  null, 22, 0.92,  67, 'Builderscrack Wellington', 'high'),
  ('Wellington', 'cladding_paint',26,  null,  8, 0.92,  43, 'Builderscrack Wellington', 'high'),
  ('Wellington', 'electrical',    null,101, null, 0.92, 89, 'Registered Master Electricians', 'high'),
  ('Wellington', 'plumbing',      null,106, null, 0.92, 72, 'Plumbers Gasfitters NZ', 'high'),
  ('Wellington', 'insulation',    13,  null,  9, 0.92,  28, 'Builderscrack Wellington', 'medium'),

  -- Christchurch
  ('Christchurch', 'roofing',     81,  null, 22, 0.85,  89, 'Builderscrack Christchurch', 'high'),
  ('Christchurch', 'cladding_paint',24, null, 8, 0.85,  61, 'Builderscrack Christchurch', 'high'),
  ('Christchurch', 'electrical',  null, 94, null, 0.85, 112, 'Registered Master Electricians', 'high'),
  ('Christchurch', 'plumbing',    null, 98, null, 0.85,  94, 'Plumbers Gasfitters NZ', 'high'),
  ('Christchurch', 'insulation',  12,  null,  9, 0.85,  37, 'Builderscrack Christchurch', 'high'),

  -- Hamilton
  ('Hamilton', 'roofing',         84,  null, 22, 0.88,  34, 'Builderscrack Hamilton', 'medium'),
  ('Hamilton', 'electrical',      null, 97, null, 0.88, 45, 'Registered Master Electricians', 'medium'),
  ('Hamilton', 'plumbing',        null,101, null, 0.88, 38, 'Plumbers Gasfitters NZ', 'medium'),

  -- Dunedin
  ('Dunedin', 'roofing',          78,  null, 22, 0.82,  23, 'Builderscrack Dunedin', 'medium'),
  ('Dunedin', 'electrical',       null, 90, null, 0.82, 31, 'Registered Master Electricians', 'medium'),
  ('Dunedin', 'plumbing',         null, 94, null, 0.82, 27, 'Plumbers Gasfitters NZ', 'medium'),

  -- Nelson / Marlborough
  ('Nelson / Marlborough', 'roofing',  76, null, 22, 0.80, 12, 'Builderscrack + AI', 'low'),
  ('Nelson / Marlborough', 'electrical',null, 88, null, 0.80, 9, 'AI estimate', 'ai_estimate'),

  -- West Coast
  ('West Coast', 'roofing',       74,  null, 22, 0.78,  6, 'AI estimate — remoteness factor', 'ai_estimate'),
  ('West Coast', 'electrical',    null, 86, null, 0.78, 4, 'AI estimate — remoteness factor', 'ai_estimate'),

  -- Northland
  ('Northland', 'roofing',        83,  null, 22, 0.87, 18, 'Builderscrack Northland', 'medium'),
  ('Northland', 'electrical',     null, 96, null, 0.87, 22, 'Registered Master Electricians', 'medium'),

  -- Hawke''s Bay
  ('Hawke''s Bay', 'roofing',     80,  null, 22, 0.84, 19, 'Builderscrack Hawke''s Bay', 'medium'),
  ('Hawke''s Bay', 'electrical',  null, 92, null, 0.84, 24, 'Registered Master Electricians', 'medium'),

  -- Southland
  ('Southland', 'roofing',        76,  null, 22, 0.80, 11, 'Builderscrack + AI', 'low'),
  ('Southland', 'electrical',     null, 88, null, 0.80,  8, 'AI estimate', 'ai_estimate')

ON CONFLICT (region, trade) DO UPDATE SET
  rate_per_sqm        = EXCLUDED.rate_per_sqm,
  rate_per_hour       = EXCLUDED.rate_per_hour,
  regional_multiplier = EXCLUDED.regional_multiplier,
  job_count           = EXCLUDED.job_count,
  data_source         = EXCLUDED.data_source,
  confidence          = EXCLUDED.confidence,
  last_updated        = now();

-- ── User cost quotes (overrides system estimates) ──────────
CREATE TABLE IF NOT EXISTS user_cost_quotes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id    uuid REFERENCES reports(id) ON DELETE CASCADE,
  sub_item_id  text NOT NULL,
  quote_amount numeric NOT NULL,
  quote_source text DEFAULT 'tradesperson',
    -- 'tradesperson' | 'online' | 'estimate'
  entered_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_quotes_report ON user_cost_quotes(report_id);

ALTER TABLE user_cost_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own quotes" ON user_cost_quotes;
CREATE POLICY "Users can manage their own quotes"
  ON user_cost_quotes FOR ALL
  USING (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

-- ── Report versions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid REFERENCES reports(id) ON DELETE CASCADE,
  version_number  integer NOT NULL DEFAULT 1,
  created_at      timestamptz DEFAULT now(),
  trigger         text DEFAULT 'initial',
    -- 'initial' | 'photo_upload' | 'manual'
  gaps_resolved   integer DEFAULT 0,
  notes           text,
  snapshot        jsonb
);

CREATE INDEX IF NOT EXISTS report_versions_report ON report_versions(report_id);

ALTER TABLE report_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own report versions" ON report_versions;
CREATE POLICY "Users can view their own report versions"
  ON report_versions FOR SELECT
  USING (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert versions for their reports" ON report_versions;
CREATE POLICY "Users can insert versions for their reports"
  ON report_versions FOR INSERT
  WITH CHECK (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

-- ============================================================
-- Done. Run this migration once in Supabase SQL Editor.
-- ============================================================

-- ####################  20260708_map_feature.sql  ####################

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

-- ####################  20260804_shared_reports.sql  ####################

-- ============================================================
-- RoiQ — Shared reports (send a report to someone via link)
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- ============================================================
--
-- A generated report normally lives only in the sender's browser. To share it,
-- we store a snapshot of the report JSON under an unguessable token; the
-- recipient opens /report/share_<token> and reads it back — no account needed.

CREATE TABLE IF NOT EXISTS shared_reports (
  token       text PRIMARY KEY,
  report      jsonb NOT NULL,
  -- Small denormalised fields for a future "reports I've shared" list / previews.
  address     text,
  score       integer,
  shared_by   uuid,          -- users.id of the sender, when logged in (nullable)
  recipient   text,          -- email the sender sent it to, if any (nullable)
  note        text,          -- optional personal message from the sender
  view_count  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_reports_shared_by ON shared_reports(shared_by);
CREATE INDEX IF NOT EXISTS shared_reports_created_at ON shared_reports(created_at);

-- Row Level Security ---------------------------------------------------------
ALTER TABLE shared_reports ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous recipients) can read a share by its token. The
-- token is a 32-char unguessable secret, so possession of the link is the grant.
DROP POLICY IF EXISTS "Anyone can read a shared report by token" ON shared_reports;
CREATE POLICY "Anyone can read a shared report by token"
  ON shared_reports FOR SELECT
  USING (true);

-- Anyone can create a share (the sender may be logged out on the public sample).
DROP POLICY IF EXISTS "Anyone can create a shared report" ON shared_reports;
CREATE POLICY "Anyone can create a shared report"
  ON shared_reports FOR INSERT
  WITH CHECK (true);

-- Only the original sender can delete a share they created.
DROP POLICY IF EXISTS "Owners can delete their shares" ON shared_reports;
CREATE POLICY "Owners can delete their shares"
  ON shared_reports FOR DELETE
  USING (shared_by = auth.uid());

-- View counter --------------------------------------------------------------
-- SECURITY DEFINER so anonymous recipients can bump the counter without an
-- UPDATE policy that would otherwise let anyone rewrite a share.
CREATE OR REPLACE FUNCTION increment_share_view(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE shared_reports SET view_count = view_count + 1 WHERE token = p_token;
$$;

GRANT EXECUTE ON FUNCTION increment_share_view(text) TO anon, authenticated;

-- ============================================================
-- Done. Run this migration once in Supabase SQL Editor.
-- ============================================================
