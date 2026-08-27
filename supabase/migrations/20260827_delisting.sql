-- ============================================================
-- Tectara — Off-market tracking
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- ============================================================
--
-- Every pin on the map claimed to be for sale forever. Nothing ever noticed a
-- listing leaving the portal, so a property that sold in June is still pinned
-- as available — and the far more valuable loss is silent: the day a listing
-- disappears is the day we could have recorded what it was asking, how long it
-- had been on the market, and (where we had analysed it) what we scored it.
-- That pairing is the whole point. A sale price bought from a data provider
-- tells you what a house sold for; it cannot tell you what condition it was in.
-- We can, but only if the record exists before the sale price arrives.
--
-- `missing_since` is deliberately separate from `delisted_at`. A listing absent
-- from one crawl has not necessarily gone: sitemaps drop entries, shards come
-- back short, and a crawl that half-failed looks exactly like a thousand
-- properties selling overnight. So absence is NOTED on the first complete crawl
-- that misses it and only CONCLUDED on the second. See lib/map/delisting.ts.
--
-- The status written is 'removed' — the value already in listing_status for
-- exactly this — and never 'sold'. A listing can leave a portal because it
-- sold, because it was withdrawn, or because the vendor gave up. We know it is
-- gone and we know when. We do not know that it sold, and the column that says
-- it did is filled in by the sale feed, not by us.
--
-- Run AFTER: 20260822_listing_discovery.sql
-- Idempotent — safe to re-run.

ALTER TABLE public.map_listings
  -- First complete crawl that did NOT see this listing. Cleared the moment it
  -- reappears. A suspicion, not a finding.
  ADD COLUMN IF NOT EXISTS missing_since     timestamptz,
  -- When we concluded it had left the market — the second complete crawl in a
  -- row that couldn't find it.
  ADD COLUMN IF NOT EXISTS delisted_at       timestamptz,
  -- The asking price at the moment it went, frozen so nothing later moves it.
  -- Null for a discovered pin: OneRoof's sitemap carries an address and no
  -- price, so we only hold one for properties somebody analysed.
  ADD COLUMN IF NOT EXISTS last_asking_price integer,
  -- Filled in by a sale feed (Cotality, LINZ, council), never by the crawler.
  ADD COLUMN IF NOT EXISTS sale_price        integer,
  ADD COLUMN IF NOT EXISTS sale_date         date,
  ADD COLUMN IF NOT EXISTS sale_source       text;

COMMENT ON COLUMN public.map_listings.missing_since IS
  'First complete crawl that did not see this listing. Cleared when it reappears. Absence is only concluded on the second consecutive miss.';
COMMENT ON COLUMN public.map_listings.delisted_at IS
  'When the listing was confirmed gone from the portal index. Gone, not sold — a withdrawal looks identical from outside.';
COMMENT ON COLUMN public.map_listings.last_asking_price IS
  'Asking price at the moment the listing left the market, frozen. Null for pins discovered from the sitemap, which carries no price.';
COMMENT ON COLUMN public.map_listings.sale_price IS
  'What it actually sold for. Written only by a sale-data feed, never inferred from a listing disappearing.';
COMMENT ON COLUMN public.map_listings.sale_source IS
  'Where the sale price came from, e.g. cotality / linz / council. A figure with no source is not evidence.';

-- The sweep reads active pins and asks which are missing; the join reads the
-- off-market ones waiting for a sale price.
CREATE INDEX IF NOT EXISTS map_listings_missing_since
  ON public.map_listings(missing_since)
  WHERE missing_since IS NOT NULL;
CREATE INDEX IF NOT EXISTS map_listings_awaiting_sale
  ON public.map_listings(delisted_at DESC)
  WHERE delisted_at IS NOT NULL AND sale_price IS NULL;

-- ============================================================
-- Done. Run this migration once in Supabase SQL Editor.
-- ============================================================
