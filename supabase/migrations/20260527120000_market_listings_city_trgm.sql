-- Trigram index on market_listings.city so the V3 storefront search can filter
-- active rentals by city (ILIKE prefix) without a sequential scan on ~59k rows.
-- Idempotent: safe to replay (the deploy workflow replays today's migrations).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_ml_rent_active_city_trgm
  ON market_listings USING gin (city gin_trgm_ops)
  WHERE transaction_type = 'rent' AND status = 'active';
