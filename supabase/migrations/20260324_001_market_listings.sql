-- ============================================================
-- Migration: market_listings + market_price_history
-- Date: 2026-03-24
-- Description: Tables permanentes pour la base de données
--              du marché immobilier suisse (GE + VD)
-- ============================================================

-- Table principale : biens du marché
CREATE TABLE IF NOT EXISTS market_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Localisation
  canton TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,

  -- Descriptif
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'apartment',
    -- 'apartment' | 'house' | 'villa' | 'commercial' | 'land'
  transaction_type TEXT NOT NULL DEFAULT 'buy',
    -- 'buy' | 'rent'

  -- Prix
  price NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'CHF',
  price_at_first_seen NUMERIC(12,2),
  current_price NUMERIC(12,2),
  price_per_m2 NUMERIC(10,2),

  -- Caractéristiques
  rooms NUMERIC(3,1),
  bedrooms INTEGER,
  bathrooms INTEGER,
  surface_m2 NUMERIC(8,2),
  floor INTEGER,
  features JSONB DEFAULT '[]'::jsonb,

  -- Photos (URLs R2)
  photos TEXT[] DEFAULT '{}',
  photos_count INTEGER DEFAULT 0,

  -- Source / traçabilité
  source_portal TEXT NOT NULL DEFAULT 'realadvisor',
  source_url TEXT,
  source_id TEXT NOT NULL,
  agency_name TEXT,
  agency_phone TEXT,

  -- Suivi temporel
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  days_on_market INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
    -- 'active' | 'sold' | 'removed' | 'price_reduced'

  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contrainte unique pour dédoublication
ALTER TABLE market_listings ADD CONSTRAINT market_listings_source_id_unique UNIQUE (source_id);

-- Table historique des prix
CREATE TABLE IF NOT EXISTS market_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_listing_id UUID NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
  old_price NUMERIC(12,2) NOT NULL,
  new_price NUMERIC(12,2) NOT NULL,
  change_pct NUMERIC(5,2),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Index
-- ============================================================

CREATE INDEX idx_market_listings_canton_status ON market_listings(canton, status);
CREATE INDEX idx_market_listings_city_type_price ON market_listings(city, type, price);
CREATE INDEX idx_market_listings_tx_type_status ON market_listings(transaction_type, status);
CREATE INDEX idx_market_listings_source_id ON market_listings(source_id);
CREATE INDEX idx_market_listings_last_seen ON market_listings(last_seen_at);
CREATE INDEX idx_market_price_history_listing ON market_price_history(market_listing_id, detected_at DESC);

-- ============================================================
-- RLS : lecture seule pour tous les agents authentifiés
-- ============================================================

ALTER TABLE market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_price_history ENABLE ROW LEVEL SECURITY;

-- Tous les agents authentifiés peuvent lire tout le marché
CREATE POLICY "Authenticated users can read market_listings"
  ON market_listings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read market_price_history"
  ON market_price_history FOR SELECT
  TO authenticated
  USING (true);

-- Service role peut tout faire (pour les Edge Functions)
CREATE POLICY "Service role can manage market_listings"
  ON market_listings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage market_price_history"
  ON market_price_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Trigger updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_market_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_market_listings_updated_at
  BEFORE UPDATE ON market_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_market_listings_updated_at();
