-- Migration: pg_cron job pour le moteur de relances automatiques
-- Appelle l'Edge Function automation-engine toutes les heures pour chaque agence
--
-- IMPORTANT : Cette migration nécessite :
-- 1. L'extension pg_cron (activée par défaut sur Supabase Pro)
-- 2. L'extension pg_net (pour net.http_post)
-- 3. La table app_config avec les clés 'supabase_url' et 'service_role_key'
-- 4. La fonction get_app_config() existante
--
-- À exécuter manuellement dans le SQL Editor Supabase

-- Activer les extensions nécessaires (no-op si déjà actives)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Fonction appelée par pg_cron toutes les heures
-- Scanne toutes les agences et appelle l'Edge Function pour chacune
CREATE OR REPLACE FUNCTION hourly_automation_scan()
RETURNS void AS $$
DECLARE
  agency RECORD;
  base_url TEXT;
  svc_key TEXT;
BEGIN
  base_url := get_app_config('supabase_url');
  svc_key := get_app_config('service_role_key');

  -- Pour chaque agence, déclencher un scan de relances
  FOR agency IN SELECT DISTINCT id AS agency_id FROM agencies
  LOOP
    PERFORM net.http_post(
      url := base_url || '/functions/v1/automation-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
      ),
      body := jsonb_build_object(
        'agency_id', agency.agency_id
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Planifier le job toutes les heures
SELECT cron.schedule(
  'hourly-automation-scan',
  '0 * * * *',
  'SELECT hourly_automation_scan()'
);
