-- Tighten the anon read policy on market_listings from
--   status IN ('active','price_reduced')
-- to
--   status = 'active'
--
-- Reasons:
--   1. price_reduced is unused: 0 rows in the table have that status today
--      and no code path writes it. The "baisse de prix" badge in the React
--      app is derived from price_at_first_seen vs current_price, not from
--      the status column (see src/hooks/useMarketListings.ts:73-76).
--   2. Performance: status IN (...) prevents the planner from matching the
--      partial indexes that have WHERE status='active'. Under the anon role
--      the planner fell back to a Seq Scan + Sort that exceeded the 3s
--      statement_timeout on city-filtered rental searches (~7-9s for
--      "Lausanne"). With status='active' in the RLS predicate, the planner
--      uses idx_ml_rent_active_created and returns in <1s.
--
-- Already applied on production via the Supabase MCP on 2026-05-28; this
-- file mirrors the exact DDL so migration history stays in sync. Idempotent
-- (DROP POLICY IF EXISTS).
DROP POLICY IF EXISTS "Public can read active market_listings" ON public.market_listings;

CREATE POLICY "Public can read active market_listings"
  ON public.market_listings
  FOR SELECT
  TO anon
  USING (status = 'active');
