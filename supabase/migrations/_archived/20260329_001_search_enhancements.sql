-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Search Enhancements
-- 1. Index sur saved_searches pour les alertes (perf cron)
-- 2. RPC get_cities_by_canton() pour le filtre localisation dynamique
-- 3. Colonne energy_label sur market_listings
-- 4. pg_cron job pour les alertes de recherche (toutes les 30 min)
-- 5. RLS service_role pour saved_searches (Edge Function access)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Index alertes saved_searches ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_saved_searches_alert_enabled
  ON saved_searches(alert_enabled, alert_frequency)
  WHERE alert_enabled = true;

-- ─── 2. RPC: villes par canton avec compteur ────────────────────────────────

CREATE OR REPLACE FUNCTION get_cities_by_canton(p_canton TEXT, p_context TEXT DEFAULT 'buy')
RETURNS TABLE(city TEXT, count BIGINT) AS $$
  SELECT
    ml.city,
    COUNT(*)::BIGINT as count
  FROM market_listings ml
  WHERE ml.canton = p_canton
    AND ml.transaction_type = p_context
    AND ml.status IN ('active', 'price_reduced')
    AND ml.quality_score >= 50
    AND ml.city IS NOT NULL
    AND ml.city != ''
  GROUP BY ml.city
  ORDER BY count DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_cities_by_canton(TEXT, TEXT) TO anon, authenticated;

-- ─── 3. Colonne energy_label sur market_listings ────────────────────────────

ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS energy_label TEXT;

CREATE INDEX IF NOT EXISTS idx_market_listings_energy_label
  ON market_listings(energy_label)
  WHERE energy_label IS NOT NULL;

-- ─── 4. RLS service_role pour saved_searches ────────────────────────────────
-- Permet à l'Edge Function search-alert de lire toutes les recherches

CREATE POLICY "Service role can read all saved searches"
  ON saved_searches FOR SELECT
  TO service_role
  USING (true);

-- ─── 5. pg_cron job pour les alertes de recherche ───────────────────────────
-- Appelle l'Edge Function search-alert toutes les 30 minutes
--
-- IMPORTANT : Nécessite pg_cron + pg_net + table app_config
-- À exécuter dans le SQL Editor Supabase (pas dans les migrations auto)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION run_search_alerts()
RETURNS void AS $$
DECLARE
  base_url TEXT;
  svc_key TEXT;
BEGIN
  base_url := get_app_config('supabase_url');
  svc_key := get_app_config('service_role_key');

  PERFORM net.http_post(
    url := base_url || '/functions/v1/search-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'search-alerts-30min',
  '*/30 * * * *',
  'SELECT run_search_alerts()'
);
