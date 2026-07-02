-- GIN trigram index on market_listings.city so the WhatsApp copilot's search_listings tool can do
-- `city ILIKE '%commune%'` without a 34k-row heap scan. Before this, "biens en vente sur Genève"
-- heap-filtered every active+buy row (~34.5k after the RealAdvisor buy backfill) → ~4.6s → timeout
-- in the interactive WhatsApp loop. With the trigram index the same lookup is <10ms (EXPLAIN-verified).
-- Partial on active listings only (the only ones ever surfaced) to keep it small. cf CLAUDE.md §7.
-- Created live in prod via CREATE INDEX CONCURRENTLY (no write lock); this file tracks it in-repo and
-- is a no-op there (IF NOT EXISTS). In a fresh `supabase start` the table is tiny so a plain
-- (non-concurrent) create is instant and CI-safe.
create extension if not exists pg_trgm;

create index if not exists idx_ml_city_trgm
  on public.market_listings using gin (city gin_trgm_ops)
  where status in ('active', 'price_reduced');
