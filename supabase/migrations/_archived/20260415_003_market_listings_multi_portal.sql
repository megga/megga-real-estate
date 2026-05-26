-- ============================================================================
-- Multi-portal support: composite UNIQUE constraint on (source_portal, source_id)
-- Spec: enables ingestion from multiple portals (RealAdvisor, Flatfox, Anibis,
-- Petitesannonces, etc.) without source_id collisions across portals.
-- Created: 2026-04-15
--
-- Why: UNIQUE(source_id) was enough when there was a single source (RealAdvisor),
-- but two different portals can use the same numeric ID for different listings.
-- The correct dedup key is (source_portal, source_id).
--
-- Idempotent: safe to run multiple times.
-- Reversible: keeps the underlying index on source_id for backward compat.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_listings') THEN

    -- 1. Drop the single-column UNIQUE constraint if it exists
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'market_listings_source_id_unique'
    ) THEN
      ALTER TABLE market_listings DROP CONSTRAINT market_listings_source_id_unique;
      RAISE NOTICE 'market_listings: dropped old UNIQUE(source_id) constraint';
    ELSE
      RAISE NOTICE 'market_listings: UNIQUE(source_id) constraint not found, skipping drop';
    END IF;

    -- 2. Add the composite UNIQUE constraint (source_portal, source_id)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'market_listings_portal_source_unique'
    ) THEN
      ALTER TABLE market_listings
        ADD CONSTRAINT market_listings_portal_source_unique
        UNIQUE (source_portal, source_id);
      RAISE NOTICE 'market_listings: added composite UNIQUE(source_portal, source_id)';
    ELSE
      RAISE NOTICE 'market_listings: composite UNIQUE already exists, skipping';
    END IF;

    -- 3. Add an index on source_portal alone for fast filtering by portal
    --    (e.g. "all Flatfox listings", "stats per portal")
    CREATE INDEX IF NOT EXISTS idx_market_listings_source_portal
      ON market_listings(source_portal)
      WHERE status IN ('active', 'price_reduced');

  ELSE
    RAISE NOTICE 'market_listings: table not found, skipping';
  END IF;
END $$;

COMMIT;
