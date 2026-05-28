-- GIN trigram index on market_listings.city for fast ILIKE filtering by city
-- on the public storefront search (active rentals).
--
-- Already applied on the production project (eayczugyrvmtqnnmvjod) via the
-- Supabase MCP on 2026-05-28 — this file mirrors that exact DDL so the
-- migration history stays in sync. Both statements are idempotent: replays
-- on staging / fresh local stacks are no-ops once installed.
--
-- pg_trgm is created in the dedicated `extensions` schema (Supabase
-- convention) and gin_trgm_ops is qualified accordingly so the index DDL
-- resolves the operator class regardless of search_path.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_ml_rent_active_city_trgm
  ON market_listings USING gin (city extensions.gin_trgm_ops)
  WHERE transaction_type = 'rent' AND status = 'active';
