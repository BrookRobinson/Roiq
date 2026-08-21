-- ============================================================
-- Property Map — make map_listings actually writable.
--
-- The map fills up from reports users run (/api/map/from-report) and from the
-- daily refresh job, but three things in the original schema stopped any of
-- those writes landing:
--
--   1. `id` is a generated uuid and there is no natural key, so every write was
--      an INSERT of a brand new row. The daily job would have added twenty
--      duplicate rows a day, and re-running a report would have duplicated its
--      pin instead of updating it.
--   2. `full_report_id` is a FK to public.reports, but nothing writes to that
--      table — reports live in sessionStorage — so setting it would fail every
--      insert with a foreign-key violation.
--   3. RLS is on with a SELECT policy and nothing else. That part is CORRECT and
--      stays: the anon key is public (NEXT_PUBLIC_), so an insert policy would
--      let anyone write listings onto the map. Writes go through the service
--      role instead, from trusted server routes only.
--
-- Additive and idempotent.
-- ============================================================

alter table public.map_listings
  -- Our stable pin id: `report-<reportId>`, `manual-<ts>`, `seed-01`. Gives the
  -- write path something to upsert on, so a property has one row forever.
  add column if not exists source_key text,
  -- The originating report, as plain text. Deliberately NOT a FK: reports are
  -- not persisted yet, and a pin pointing at a report we never stored is a
  -- normal state, not an integrity error.
  add column if not exists full_report_ref text;

-- Plain (not partial) unique index so `on conflict (source_key)` can infer it.
-- Postgres allows repeated NULLs, so pre-existing rows without a key are fine.
create unique index if not exists map_listings_source_key_idx
  on public.map_listings (source_key);

comment on column public.map_listings.source_key is
  'Stable app-side pin id used as the upsert key (report-<id> | manual-<ts> | seed-<n>).';
comment on column public.map_listings.full_report_ref is
  'Report this pin came from. Plain text, not a FK — reports are not persisted yet.';
