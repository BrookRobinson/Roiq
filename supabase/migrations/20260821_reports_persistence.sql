-- ============================================================
-- Reports — actually persist them.
--
-- Until now a generated report lived only in the author's sessionStorage: it
-- died with the browser tab, couldn't be listed, and couldn't be reopened on
-- another device. The `reports` table has existed since the base schema but
-- nothing has ever written a row to it, for two reasons this migration fixes.
--
-- 1. Its columns describe an older, normalised idea of a report and don't match
--    what the pipeline actually produces (sub-items with spec tiers, both
--    personas' scores, penalties, extra dwellings). Rather than mangle that into
--    columns it doesn't fit, the whole StoredReport goes in a `report` jsonb —
--    the same approach `shared_reports` already uses successfully. The existing
--    denormalised columns stay and get populated where they genuinely match
--    (address, price, score...), so the dashboard can list reports without
--    parsing every blob.
--
-- 2. `user_id` is NOT NULL against a users table that auth never populates,
--    which made every insert impossible. It becomes nullable, with `owner_key`
--    carrying anonymous per-browser ownership until real auth lands — at which
--    point rows can be claimed by setting user_id.
--
-- RLS stays as it is: "Users manage own reports" on user_id = auth.uid(), which
-- currently matches nothing. That's deliberate. Reports are the paid product, so
-- the public anon key must not be able to read them; access goes through server
-- routes using the service role, which enforce owner_key.
--
-- Additive and idempotent.
-- ============================================================

alter table public.reports
  -- The full StoredReport as the app produces it.
  add column if not exists report jsonb,
  -- Opaque per-browser owner, from an httpOnly cookie. Not PII, not guessable.
  add column if not exists owner_key text,
  -- Denormalised for the dashboard list.
  add column if not exists photos_analysed integer,
  add column if not exists model text;

-- Anonymous authorship: no signed-in user to attribute a report to yet.
alter table public.reports alter column user_id drop not null;

create index if not exists reports_owner_key_idx on public.reports (owner_key, created_at desc);

comment on column public.reports.report is
  'The full StoredReport JSON as generated. Source of truth; the sibling columns are denormalised for listing.';
comment on column public.reports.owner_key is
  'Opaque per-browser owner id (httpOnly cookie) used while auth is mocked. Superseded by user_id once auth lands.';
