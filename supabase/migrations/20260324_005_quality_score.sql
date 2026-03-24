-- ═══════════════════════════════════════════════════════════════════════════
-- Colonnes quality_score + quality_flags pour market_listings
-- Contrôle qualité automatique des données scrappées
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE market_listings
  ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_flags JSONB DEFAULT '[]'::jsonb;

-- Index pour filtrer rapidement les biens de qualité
CREATE INDEX IF NOT EXISTS idx_market_listings_quality_score
  ON market_listings (quality_score)
  WHERE status IN ('active', 'price_reduced');

COMMENT ON COLUMN market_listings.quality_score IS 'Score qualité 0-100 (100 = fiable). Biens < 50 masqués sur la page publique.';
COMMENT ON COLUMN market_listings.quality_flags IS 'Détail des problèmes détectés : ["price_per_m2_low", "no_photos", ...]';
