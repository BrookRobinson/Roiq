-- ============================================================
-- RoiQ — Inbox identity for the free-report allowance
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- ============================================================
--
-- The free report is one per person. A browser cookie can't tell two people
-- apart on a shared laptop — a couple looking at houses together is the normal
-- case for this product, and counting per browser refused the second one a
-- report they never used.
--
-- An inbox can. But an inbox has many spellings: Gmail ignores dots, and most
-- providers treat "+tag" as a tag on the same mailbox. `email_key` holds the
-- one spelling they all resolve to, so aliases of one inbox count as one
-- person while genuinely different addresses stay separate.
--
-- Deliberately NOT unique and NOT enforced here: it's an allowance-counting
-- aid, not an identity constraint. Two people who really do share a mailbox
-- should still be able to hold two accounts.
--
-- Populated by the app on the first authenticated request (see
-- app/api/auth/me/route.ts) rather than by a trigger — the normalisation rules
-- live in lib/auth/email-key.ts, and a second copy of them in PL/pgSQL would
-- drift from the first.
--
-- Run AFTER: 20260605_base_schema.sql
-- Idempotent — safe to re-run.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_key text;

COMMENT ON COLUMN public.users.email_key IS
  'The mailbox this account''s email resolves to, aliases collapsed. Groups accounts for the free-report allowance. Set by the app, see lib/auth/email-key.ts.';

CREATE INDEX IF NOT EXISTS users_email_key ON public.users(email_key);

-- Lowercase existing rows so the common case groups straight away. The full
-- rules (Gmail dots, plus-tags) are applied by the app the next time each
-- person signs in; until then an unmatched account simply gets its own
-- allowance, which errs toward letting someone through rather than refusing
-- them.
UPDATE public.users
   SET email_key = lower(trim(email))
 WHERE email_key IS NULL
   AND email IS NOT NULL;

-- ============================================================
-- Done. Run this migration once in Supabase SQL Editor.
-- ============================================================
