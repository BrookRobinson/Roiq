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
