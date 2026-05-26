-- ============================================================
-- Migration: Ajouter source + market_listing_id à matches
-- Date: 2026-03-24
-- Description: Permet au matching engine de créer des matches
--              contre les biens du marché (market_listings)
-- ============================================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'internal';
  -- 'internal' | 'market'

ALTER TABLE matches ADD COLUMN IF NOT EXISTS market_listing_id UUID REFERENCES market_listings(id);

-- Index pour filtrer les matches marché
CREATE INDEX IF NOT EXISTS idx_matches_source ON matches(source);
CREATE INDEX IF NOT EXISTS idx_matches_market_listing ON matches(market_listing_id) WHERE market_listing_id IS NOT NULL;
