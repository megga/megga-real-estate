-- ============================================================================
-- Fix /louer page — three RPCs time out for transaction_type='rent'
--
-- Symptom: HTTP 500 / PostgreSQL code 57014 ("canceling statement due to
-- statement timeout") when the /louer page calls:
--   - get_market_map_points(p_context => 'rent')   → no map pins
--   - count_market_by_canton(p_context => 'rent')  → empty canton dropdown
--   - count_market_by_type(p_context => 'rent')    → missing type counts
-- The /acheter page works because there are only ~11 buy listings vs ~19'500
-- rent listings (the rent dataset is dominated by Flatfox sync).
--
-- Root cause:
--   1. The anon role has a 3s statement_timeout on Supabase Pro.
--   2. The function bodies attempt to extend it via
--          PERFORM set_config('statement_timeout', '30s', true);
--      That's a no-op for this purpose: by the time the function body runs,
--      PostgreSQL has already armed the per-statement timer for the calling
--      role's session. Only `ALTER FUNCTION ... SET statement_timeout` is
--      applied on function entry.
--   3. Even with a longer timeout, scanning ~19'500 rows + heap-fetching the
--      eight columns the map RPC returns is slower than it needs to be.
--
-- Fixes:
--   A. Function-attribute statement_timeout override (proper).
--   B. Covering partial INCLUDE indexes so the planner can do an index-only
--      scan and skip the heap fetch.
-- ============================================================================

-- A. Per-function statement_timeout — applied by PostgreSQL on function entry,
-- regardless of the caller's role-level timeout. This is what actually works.
ALTER FUNCTION public.get_market_map_points(
  TEXT, TEXT[], TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT[]
) SET statement_timeout = '30s';

ALTER FUNCTION public.count_market_by_canton(TEXT)
  SET statement_timeout = '30s';

ALTER FUNCTION public.count_market_by_type(TEXT)
  SET statement_timeout = '30s';

-- B. Covering partial index for the map-points RPC. The INCLUDE clause stores
-- every column the RPC returns inside the index leaf, so PostgreSQL can serve
-- the query without touching the heap (index-only scan). The partial WHERE
-- restricts the index to ~19'500 active+geocoded+priced rows out of ~190K.
--
-- Not CONCURRENTLY: `supabase db push` wraps each migration file in a
-- transaction, and CREATE INDEX CONCURRENTLY cannot run inside one. The
-- partial WHERE keeps the build small (~19'500 rows) so the table-level
-- lock is held only briefly.
CREATE INDEX IF NOT EXISTS idx_ml_map_points_active
  ON market_listings (transaction_type)
  INCLUDE (id, lat, lng, price, current_price, type, rooms)
  WHERE status = 'active'
    AND quality_score >= 50
    AND lat IS NOT NULL
    AND lng IS NOT NULL
    AND price > 0;

-- C. Covering partial index for the canton/type aggregations. GROUP BY canton
-- and GROUP BY type are both served by a single index on
-- (transaction_type, canton, type). The aggregation can scan the partial
-- index instead of the full table.
CREATE INDEX IF NOT EXISTS idx_ml_active_tx_canton_type
  ON market_listings (transaction_type, canton, type)
  WHERE status IN ('active', 'price_reduced');
