-- ============================================================
-- Migration: Allow public (anon) read access to market_listings
-- Date: 2026-03-24
-- Description: Market listings are public — visible on the
--              "Acheter" page without authentication
-- ============================================================

-- Public (anon) users can read market listings
CREATE POLICY "Public can read active market_listings"
  ON market_listings FOR SELECT
  TO anon
  USING (status IN ('active', 'price_reduced'));

-- Public can also read price history (for price change indicators)
CREATE POLICY "Public can read market_price_history"
  ON market_price_history FOR SELECT
  TO anon
  USING (true);
