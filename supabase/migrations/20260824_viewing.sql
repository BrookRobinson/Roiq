-- ============================================================
-- The viewing — answers, the date, and the buyer's own photo assessments.
--
-- This is filled in AT the property: hours or days after the report was read,
-- on a phone, quite possibly on a different device from the one that ran the
-- analysis, and often on bad signal in someone else's driveway. It has been
-- living in localStorage, which meant it was tied to one browser on one device
-- and was lost with a cleared cache — for the one artefact in the product that
-- records somebody physically going somewhere, that was the wrong place for it.
--
-- Stored as a single jsonb on the report rather than a table of answers. It is
-- always read and written whole, it is never queried across reports, and its
-- shape belongs to lib/viewing/status.ts — which is exactly the argument the
-- reports.report blob already makes for itself.
--
-- The client keeps writing to localStorage first and syncs after, so the answer
-- survives no signal; the two are merged per-answer on load, newest wins.
--
-- Run AFTER: 20260821_reports_persistence.sql
-- Additive and idempotent.
-- ============================================================

alter table public.reports
  add column if not exists viewing jsonb;

comment on column public.reports.viewing is
  'ViewingState: the checklist answers, the date the property was viewed, and any photo assessments the buyer uploaded. Gates the agent letter — see lib/viewing/status.ts.';
