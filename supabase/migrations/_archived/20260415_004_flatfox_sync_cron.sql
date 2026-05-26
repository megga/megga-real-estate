-- ============================================================================
-- pg_cron : déclenchement automatique quotidien du sync Flatfox
-- Spec: supabase/functions/flatfox-sync/index.ts
-- Created: 2026-04-15
--
-- Lance flatfox-sync chaque jour à 04:00 UTC (06:00 Europe/Zurich) :
--   - Auto-chainage par chunks (self-invocation)
--   - Upsert additions + mises à jour
--   - Marque 'removed' les biens disparus (avec safety check anti-wipe)
--
-- Prérequis :
--   - Extension pg_cron activée (Settings → Database → Extensions)
--   - Extension pg_net activée (pour net.http_post)
--   - Edge Function flatfox-sync déployée
--
-- Idempotent : safe à réexécuter.
-- ============================================================================

BEGIN;

-- 1. Active les extensions nécessaires (si pas déjà fait)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Stocke l'URL de la fonction et la service key dans les GUC settings
--    (permet au cron d'appeler l'Edge Function via net.http_post)
--    NOTE: la service key doit être définie manuellement via :
--    ALTER DATABASE postgres SET app.settings.service_role_key = 'xxx';
--    (voir docs activation en bas du fichier)

-- 3. Supprime l'ancien job s'il existe (idempotence)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'flatfox-sync-daily') THEN
    PERFORM cron.unschedule('flatfox-sync-daily');
    RAISE NOTICE 'flatfox-sync-daily: previous schedule removed';
  END IF;
END $$;

-- 4. Planifie le nouveau job : chaque jour à 04:00 UTC (06:00 CH été, 05:00 CH hiver)
SELECT cron.schedule(
  'flatfox-sync-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/flatfox-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

COMMIT;

-- ─── Activation manuelle requise (à faire UNE SEULE FOIS) ─────────────────
--
-- Après avoir appliqué cette migration, exécute ces deux commandes dans le
-- SQL Editor (remplace YOUR_SERVICE_ROLE_KEY par la vraie clé depuis
-- Settings → API → service_role) :
--
--   ALTER DATABASE postgres SET app.settings.supabase_url = 'https://eayczugyrvmtqnnmvjod.supabase.co';
--   ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
--
-- Puis vérifie que le job est planifié :
--
--   SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'flatfox-sync-daily';
--
-- Pour déclencher MANUELLEMENT le sync (hors cron) :
--
--   SELECT net.http_post(
--     url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/flatfox-sync',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'),
--     body := '{}'::jsonb
--   );
--
-- Pour consulter les logs d'exécution du cron :
--
--   SELECT * FROM cron.job_run_details
--   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'flatfox-sync-daily')
--   ORDER BY start_time DESC LIMIT 10;
--
-- ──────────────────────────────────────────────────────────────────────────
