-- Trigram index on market_listings.city so the V3 storefront search can filter
-- active rentals by city (ILIKE prefix) faster than a sequential scan.
--
-- Wrapped in a tolerant DO block: the index is a performance bonus (city ILIKE
-- still works without it), so if pg_trgm / gin_trgm_ops can't be resolved in
-- this environment we log and continue instead of failing the whole deploy.
-- Idempotent and safe to replay.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS idx_ml_rent_active_city_trgm
    ON market_listings USING gin (city gin_trgm_ops)
    WHERE transaction_type = 'rent' AND status = 'active';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'city trgm index skipped: %', SQLERRM;
END $$;
