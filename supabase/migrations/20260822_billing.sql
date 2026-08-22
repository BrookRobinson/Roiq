-- ============================================================
-- RoiQ — Billing (one-off purchases, 30 days of access)
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- ============================================================
--
-- The product is sold a month at a time and nothing auto-renews, which the
-- landing page, the pricing page and the FAQ all promise in as many words. So
-- there is no subscription here: a purchase writes a plan and a date it runs
-- out, and after that date the account is free again until someone buys another
-- month. `users.stripe_subscription_id` and `subscription_status` predate that
-- decision and stay unused rather than half-filled.
--
-- Run AFTER: 20260605_base_schema.sql
-- Idempotent — safe to re-run.

-- ── When the current plan lapses ────────────────────────────────────────────
-- NULL means "no purchased access" (free), never "unlimited": every read pairs
-- the plan with this date, so a null here on a paid plan would read as expired,
-- which is the safe direction to fail.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

COMMENT ON COLUMN public.users.plan_expires_at IS
  'When purchased access ends. Past or NULL means the effective plan is free.';

-- Anyone already on a paid plan got there by hand, before there was anywhere to
-- record an end date. Reading plan + a NULL expiry now resolves to free, so
-- without this they'd silently lose access the moment this migration lands.
-- Give them a month from now; after that they buy like everyone else.
UPDATE public.users
   SET plan_expires_at = now() + interval '30 days'
 WHERE plan IN ('starter', 'pro')
   AND plan_expires_at IS NULL;

-- ── purchases (one row per completed Stripe checkout) ───────────────────────
CREATE TABLE IF NOT EXISTS public.purchases (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Stripe delivers webhooks at least once, so the same checkout can arrive
  -- twice. This unique constraint is what makes replay harmless: the second
  -- insert conflicts and the extra month is never granted.
  stripe_session_id        text NOT NULL UNIQUE,
  stripe_payment_intent_id text,
  stripe_customer_id       text,
  plan                     text NOT NULL,             -- 'starter' | 'pro'
  amount_cents             integer,                   -- what was actually charged
  currency                 text NOT NULL DEFAULT 'nzd',
  status                   text NOT NULL DEFAULT 'paid',  -- 'paid' | 'refunded'
  receipt_url              text,                      -- Stripe-hosted receipt
  access_from              timestamptz NOT NULL DEFAULT now(),
  access_until             timestamptz NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchases_user_id    ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS purchases_created_at ON public.purchases(created_at DESC);

-- Row Level Security ---------------------------------------------------------
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Read your own receipts. There is deliberately NO insert or update policy:
-- purchases are written only by the Stripe webhook through the service role,
-- which bypasses RLS. The anon key ships to every browser, so any write policy
-- here would let a visitor grant themselves a plan.
DROP POLICY IF EXISTS "Users can read their own purchases" ON public.purchases;
CREATE POLICY "Users can read their own purchases"
  ON public.purchases FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- Done. Run this migration once in Supabase SQL Editor.
-- ============================================================
