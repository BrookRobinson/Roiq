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

CREATE POLICY IF NOT EXISTS "Users can view their own report gaps"
  ON report_gaps FOR SELECT
  USING (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "Users can insert gaps for their own reports"
  ON report_gaps FOR INSERT
  WITH CHECK (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "Users can update their own gaps"
  ON report_gaps FOR UPDATE
  USING (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

-- ── Upload tokens (agent portal) ──────────────────────────
CREATE TABLE IF NOT EXISTS report_upload_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid REFERENCES reports(id) ON DELETE CASCADE,
  token       text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'base64url'),
  created_at  timestamptz DEFAULT now(),
  expires_at  timestamptz DEFAULT (now() + interval '30 days'),
  used_count  integer DEFAULT 0,
  is_active   boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS upload_tokens_token ON report_upload_tokens(token);
CREATE INDEX IF NOT EXISTS upload_tokens_report ON report_upload_tokens(report_id);

-- No RLS on upload tokens — agents access via token only (public, expiry-controlled)
ALTER TABLE report_upload_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Anyone can read active non-expired tokens by token value"
  ON report_upload_tokens FOR SELECT
  USING (is_active = true AND expires_at > now());

CREATE POLICY IF NOT EXISTS "Report owners can manage their tokens"
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

CREATE POLICY IF NOT EXISTS "Users can manage their own quotes"
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

CREATE POLICY IF NOT EXISTS "Users can view their own report versions"
  ON report_versions FOR SELECT
  USING (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "Users can insert versions for their reports"
  ON report_versions FOR INSERT
  WITH CHECK (
    report_id IN (SELECT id FROM reports WHERE user_id = auth.uid())
  );

-- ============================================================
-- Done. Run this migration once in Supabase SQL Editor.
-- ============================================================
