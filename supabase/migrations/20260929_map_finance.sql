-- 20260929_map_finance
-- What a report leaves on its map pin so the map can run that property's
-- Financial tab (lib/map/pin-finance.ts): the renovation plan (each job's cost,
-- due year and whether it's needed at purchase) plus rent, growth, floor area
-- and build year. The investor return is computed per reader from this; no
-- return is stored.
alter table public.map_listings
  add column if not exists finance jsonb;
