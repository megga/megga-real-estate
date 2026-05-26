-- ============================================================================
-- Rental listings support: add transaction_type + rental-specific columns
-- Spec: docs/superpowers/specs/2026-04-15-rental-listings-design.md
-- Created: 2026-04-15
--
-- Changes:
--   properties:      +transaction_type, +deposit_months, +is_furnished, +external_regie
--   market_listings: +deposit_months, +is_furnished, +external_regie
--                    (transaction_type already exists since 20260324_001)
--
-- The price column is reused for both sale price and monthly rent.
-- transaction_type disambiguates the interpretation at display time.
-- Idempotent: safe to run multiple times.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- properties: add rental columns
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'properties') THEN

    -- transaction_type: 'buy' (default) or 'rent'
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'properties' AND column_name = 'transaction_type'
    ) THEN
      ALTER TABLE properties
        ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'buy';

      ALTER TABLE properties
        ADD CONSTRAINT properties_transaction_type_check
        CHECK (transaction_type IN ('buy', 'rent'));

      RAISE NOTICE 'properties: transaction_type added (default buy)';
    ELSE
      RAISE NOTICE 'properties: transaction_type already exists, skipping';
    END IF;

    -- deposit_months: 1, 2 or 3 (rental only, NULL for sale)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'properties' AND column_name = 'deposit_months'
    ) THEN
      ALTER TABLE properties ADD COLUMN deposit_months SMALLINT;
      RAISE NOTICE 'properties: deposit_months added';
    ELSE
      RAISE NOTICE 'properties: deposit_months already exists, skipping';
    END IF;

    -- is_furnished: rental only, defaults to false
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'properties' AND column_name = 'is_furnished'
    ) THEN
      ALTER TABLE properties ADD COLUMN is_furnished BOOLEAN DEFAULT false;
      RAISE NOTICE 'properties: is_furnished added';
    ELSE
      RAISE NOTICE 'properties: is_furnished already exists, skipping';
    END IF;

    -- external_regie: optional override for rental contact info
    -- Shape: {"name": "...", "phone": "...", "email": "...", "website": "..."}
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'properties' AND column_name = 'external_regie'
    ) THEN
      ALTER TABLE properties ADD COLUMN external_regie JSONB;
      RAISE NOTICE 'properties: external_regie added';
    ELSE
      RAISE NOTICE 'properties: external_regie already exists, skipping';
    END IF;

    -- Index on transaction_type for active listings (public search filtering)
    CREATE INDEX IF NOT EXISTS idx_properties_transaction_type
      ON properties(transaction_type)
      WHERE status = 'active';

  ELSE
    RAISE NOTICE 'properties: table not found, skipping';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- market_listings: add rental columns (transaction_type already exists)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_listings') THEN

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'market_listings' AND column_name = 'deposit_months'
    ) THEN
      ALTER TABLE market_listings ADD COLUMN deposit_months SMALLINT;
      RAISE NOTICE 'market_listings: deposit_months added';
    ELSE
      RAISE NOTICE 'market_listings: deposit_months already exists, skipping';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'market_listings' AND column_name = 'is_furnished'
    ) THEN
      ALTER TABLE market_listings ADD COLUMN is_furnished BOOLEAN DEFAULT false;
      RAISE NOTICE 'market_listings: is_furnished added';
    ELSE
      RAISE NOTICE 'market_listings: is_furnished already exists, skipping';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'market_listings' AND column_name = 'external_regie'
    ) THEN
      ALTER TABLE market_listings ADD COLUMN external_regie JSONB;
      RAISE NOTICE 'market_listings: external_regie added';
    ELSE
      RAISE NOTICE 'market_listings: external_regie already exists, skipping';
    END IF;

  ELSE
    RAISE NOTICE 'market_listings: table not found, skipping';
  END IF;
END $$;

COMMIT;
