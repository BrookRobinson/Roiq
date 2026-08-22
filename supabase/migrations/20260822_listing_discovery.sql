-- ============================================================
-- RoiQ — Nightly listing discovery
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- ============================================================
--
-- The map only knew about properties someone had paid to analyse, so it was
-- empty everywhere nobody had looked. The nightly job now reads OneRoof's
-- published for-sale sitemap and records what EXISTS — address, region, and
-- when the portal last touched the page. Nothing is analysed: discovery is
-- nearly free, and the analysis is the part that costs real money.
--
-- A discovered pin is one with `source_key` like 'oneroof-%' and no
-- `full_report_ref`. It carries no score, no valuation and no yield, because
-- none have been worked out — the map must never show an invented number
-- beside a real address.
--
-- Run AFTER: 20260821_map_listing_writes.sql
-- Idempotent — safe to re-run.

ALTER TABLE public.map_listings
  -- <lastmod> from the portal's sitemap. Lets the next run ask "what changed
  -- since?" without fetching a single listing page, and tells us when a
  -- property we hold a report for has been edited — a signal the cached
  -- analysis may have gone stale.
  ADD COLUMN IF NOT EXISTS portal_last_modified date,
  -- When our crawler last saw it in the index. A listing that stops appearing
  -- has sold or been withdrawn.
  ADD COLUMN IF NOT EXISTS discovered_at timestamptz;

COMMENT ON COLUMN public.map_listings.portal_last_modified IS
  'The <lastmod> the source portal published for this listing. Drives "what is new since last night" and stale-report detection.';
COMMENT ON COLUMN public.map_listings.discovered_at IS
  'When the nightly discovery job first indexed this listing.';

-- The nightly diff reads by portal date; the reconciler reads by URL.
CREATE INDEX IF NOT EXISTS map_listings_portal_last_modified
  ON public.map_listings(portal_last_modified DESC);
CREATE INDEX IF NOT EXISTS map_listings_listing_url
  ON public.map_listings(listing_url);

-- ============================================================
-- Done. Run this migration once in Supabase SQL Editor.
-- ============================================================
