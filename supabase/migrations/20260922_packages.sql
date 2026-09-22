-- ============================================================
-- Tectara — Packages (Bronze / Silver / Gold)
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- ============================================================
--
-- What replaced the tier ladder: three things are sold, and they behave
-- differently, so a purchase now records WHAT IT GRANTED rather than which rung
-- was bought.
--
--   reports_granted      credits. They never expire.
--   includes_map         map access, which runs to access_until and stops.
--   inspections_granted  a person who has to drive to a house.
--
-- Entitlements are SUMMED from these columns on every read (see
-- lib/billing/entitlements.ts) rather than kept as a balance on the user. There
-- is no counter to decrement, so nothing can drift, double-spend, or be granted
-- twice by a replayed webhook — and a refund is revoked by flipping one status,
-- in the same query that reads it.
--
-- Run AFTER: 20260605_base_schema.sql and 20260822_billing.sql
-- Idempotent — safe to re-run.

-- ── What each purchase granted ──────────────────────────────────────────────
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS reports_granted        integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS includes_map           boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inspections_granted    integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inspection_fulfilled_at timestamptz;

COMMENT ON COLUMN public.purchases.reports_granted IS
  'Report credits this purchase granted. Summed at read time; never decremented.';
COMMENT ON COLUMN public.purchases.includes_map IS
  'Did this purchase carry map access? Only these move access_until.';
COMMENT ON COLUMN public.purchases.inspections_granted IS
  'Inspections owed. One per purchase — never one a month.';
COMMENT ON COLUMN public.purchases.inspection_fulfilled_at IS
  'When the inspection was actually carried out. NULL means somebody is still waiting.';

COMMENT ON COLUMN public.purchases.plan IS
  'Which package was bought: bronze | silver | gold. A record, not an entitlement.';

-- ── Backfill anything sold under the old tiers ──────────────────────────────
-- Rows written before this migration have 0 credits and no map, which would
-- silently take away what somebody paid for. Granting from the old names is a
-- one-off: the ladder they were bought on no longer exists, so this is the last
-- moment the mapping is known.
--
-- Generous on purpose. Erring upward costs a few reports; erring downward takes
-- away something that was paid for, and the customer finds out before we do.
UPDATE public.purchases SET
  reports_granted = CASE plan
    WHEN 'starter'  THEN 10
    WHEN 'pro'      THEN 20
    WHEN 'copper'   THEN 3
    WHEN 'bronze'   THEN 10
    WHEN 'silver'   THEN 25
    WHEN 'gold'     THEN 50
    WHEN 'platinum' THEN 50
    WHEN 'diamond'  THEN 75
    ELSE 0
  END,
  includes_map = plan IN ('pro', 'platinum', 'diamond'),
  inspections_granted = CASE WHEN plan = 'diamond' THEN 1 ELSE 0 END
WHERE reports_granted = 0
  AND plan IS NOT NULL
  AND plan <> 'free';

-- The old metal names collapse onto the three packages. `users.plan` is now
-- only a record of what was last bought — nothing reads it for access.
UPDATE public.users SET plan = CASE plan
    WHEN 'starter'  THEN 'bronze'
    WHEN 'copper'   THEN 'bronze'
    WHEN 'pro'      THEN 'silver'
    WHEN 'platinum' THEN 'silver'
    WHEN 'diamond'  THEN 'gold'
    ELSE plan
  END
 WHERE plan IN ('starter', 'copper', 'pro', 'platinum', 'diamond');

-- ── Finding the purchases that owe somebody a visit ─────────────────────────
-- Partial index: the whole point is the short list of outstanding ones, and it
-- stays small forever while the table grows.
CREATE INDEX IF NOT EXISTS purchases_inspection_owed
  ON public.purchases (created_at)
  WHERE inspections_granted > 0 AND inspection_fulfilled_at IS NULL;

-- ============================================================
-- Done. Run this migration once in Supabase SQL Editor.
-- ============================================================
