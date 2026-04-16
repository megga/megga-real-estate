-- ============================================================================
-- Performance: index for market_listings list query
--
-- The frontend list query was hitting statement timeout (error 57014)
-- because count=exact on 33K+ rows is expensive without a covering index.
--
-- This composite index covers the exact WHERE clause used by the frontend:
--   status IN ('active','price_reduced') AND transaction_type = 'rent'
--   AND quality_score >= 50
-- With ORDER BY created_at DESC for pagination.
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_listings_rent_active
  ON market_listings (created_at DESC)
  WHERE status IN ('active', 'price_reduced')
    AND quality_score >= 50;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_listings_tx_type_status
  ON market_listings (transaction_type, status, quality_score, created_at DESC);
