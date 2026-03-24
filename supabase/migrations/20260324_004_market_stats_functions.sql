-- ═══════════════════════════════════════════════════════════════════════════
-- Fonctions RPC pour les statistiques market_listings
-- Utilisées par useMarketStats() dans le frontend
-- ═══════════════════════════════════════════════════════════════════════════

-- Comptage par canton
CREATE OR REPLACE FUNCTION count_market_by_canton(p_context TEXT DEFAULT 'buy')
RETURNS TABLE(canton TEXT, count BIGINT) AS $$
  SELECT
    ml.canton,
    COUNT(*)::BIGINT as count
  FROM market_listings ml
  WHERE ml.transaction_type = p_context
    AND ml.status IN ('active', 'price_reduced')
    AND ml.canton IS NOT NULL
    AND ml.canton != ''
  GROUP BY ml.canton
  ORDER BY count DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Comptage par type de bien
CREATE OR REPLACE FUNCTION count_market_by_type(p_context TEXT DEFAULT 'buy')
RETURNS TABLE(type TEXT, count BIGINT) AS $$
  SELECT
    ml.type,
    COUNT(*)::BIGINT as count
  FROM market_listings ml
  WHERE ml.transaction_type = p_context
    AND ml.status IN ('active', 'price_reduced')
    AND ml.type IS NOT NULL
  GROUP BY ml.type
  ORDER BY count DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Accès anon pour les pages publiques
GRANT EXECUTE ON FUNCTION count_market_by_canton(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION count_market_by_type(TEXT) TO anon, authenticated;
