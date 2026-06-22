-- Renovation Marketplace schema.
--
-- ARTIFACT / NOT WIRED: the running app uses an in-memory mock store
-- (lib/marketplace/store.ts) because RoiQ has no working DB yet. This migration
-- mirrors those models 1:1 so real Supabase persistence can be switched on later
-- (swap the store functions for Supabase client queries against these tables).
-- ids are text (use cuid() from the app, or gen_random_uuid() as a default here).

-- ── enums ──────────────────────────────────────────────────────────────────────
do $$ begin
  create type market_role         as enum ('HOMEOWNER', 'TRADESMAN');
  exception when duplicate_object then null; end $$;
do $$ begin
  create type job_status          as enum ('DRAFT', 'LIVE', 'CLOSED');
  exception when duplicate_object then null; end $$;
do $$ begin
  create type verification_status as enum ('PENDING', 'APPROVED', 'REJECTED');
  exception when duplicate_object then null; end $$;

-- ── User additions (added to the existing users table, not a new one) ───────────
alter table public.users add column if not exists role          market_role not null default 'HOMEOWNER';
alter table public.users add column if not exists phone         text;
alter table public.users add column if not exists business_name text;        -- tradesman only
alter table public.users add column if not exists nzbn          text;        -- tradesman only
alter table public.users add column if not exists td_verified   boolean not null default false; -- tradesman only

-- ── Job ────────────────────────────────────────────────────────────────────────
create table if not exists public.jobs (
  id           text primary key default gen_random_uuid()::text,
  homeowner_id uuid not null references public.users (id) on delete cascade,
  category     text not null,
  material     text,            -- roofing only
  colour       text,            -- roofing / painting
  description  text not null,
  address      text not null,
  suburb       text not null,
  photos       text[] not null default '{}',
  status       job_status not null default 'DRAFT',
  urgent       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists jobs_status_idx   on public.jobs (status);
create index if not exists jobs_category_idx on public.jobs (category);

-- ── Quote ──────────────────────────────────────────────────────────────────────
create table if not exists public.quotes (
  id           text primary key default gen_random_uuid()::text,
  job_id       text not null references public.jobs (id) on delete cascade,
  tradesman_id uuid not null references public.users (id) on delete cascade,
  amount_nzd   integer not null,  -- whole dollars
  message      text not null,
  created_at   timestamptz not null default now(),
  unique (job_id, tradesman_id)   -- one quote per tradesman per job
);
create index if not exists quotes_job_idx on public.quotes (job_id);

-- ── Review (one per quote) ──────────────────────────────────────────────────────
create table if not exists public.reviews (
  id          text primary key default gen_random_uuid()::text,
  quote_id    text not null unique references public.quotes (id) on delete cascade,
  reviewer_id uuid not null references public.users (id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  comment     text not null default '',
  created_at  timestamptz not null default now()
);

-- ── TradesmanVerification (one per tradesman) ───────────────────────────────────
create table if not exists public.tradesman_verifications (
  id                text primary key default gen_random_uuid()::text,
  tradesman_id      uuid not null unique references public.users (id) on delete cascade,
  business_reg_url  text not null,
  qualification_url text not null,
  trade_bodies      text[] not null default '{}',
  status            verification_status not null default 'PENDING',
  submitted_at      timestamptz not null default now()
);

-- NOTE: enable RLS + policies before exposing these to the anon/auth roles, e.g.
--   alter table public.jobs enable row level security;
--   create policy "homeowner manages own jobs" on public.jobs
--     for all using (auth.uid() = homeowner_id);
--   create policy "verified tradesmen read live jobs" on public.jobs
--     for select using (status = 'LIVE');
-- Contact-masking (business rule 2) is enforced in the API layer, not SQL.
