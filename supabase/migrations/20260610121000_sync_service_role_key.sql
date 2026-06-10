-- Self-heal de la copie DB de la clé service-role (incident 2026-06-10).
--
-- Les wrappers pg_cron appellent les edge functions avec app_config.service_role_key.
-- Cette ligne était une copie MANUELLE de la clé : après la rotation post-incident
-- (cf. src/lib/supabase.ts), elle est restée périmée → 401 silencieux sur tous les
-- crons internes ; daily_matching_scan n'a plus créé un seul match du 16/04 au 10/06.
--
-- Source de vérité = l'env du runtime edge (SUPABASE_SERVICE_ROLE_KEY, gérée par la
-- plateforme, toujours à jour). L'edge function sync-service-key recopie env →
-- app_config ; ce wrapper la déclenche toutes les heures à :45 (les scans internes
-- tournent à :00 → fenêtre de staleness max ~1 h après une rotation de clé).
--
-- Auth : jeton partagé app_config.service_key_sync_token, provisionné HORS GIT
-- (aléa inséré via SQL editor/MCP — fait en prod le 2026-06-10). Si absent
-- (CI, local), le wrapper est un no-op silencieux et la fonction répond 500
-- « sync token not provisioned » sans rien écrire.

CREATE OR REPLACE FUNCTION public.sync_service_role_key() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  base_url TEXT;
  sync_token TEXT;
BEGIN
  base_url := get_app_config('supabase_url');
  sync_token := get_app_config('service_key_sync_token');
  IF base_url IS NULL OR sync_token IS NULL THEN
    RETURN; -- non provisionné (CI/local) : no-op
  END IF;

  PERFORM net.http_post(
    url := base_url || '/functions/v1/sync-service-key',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-token', sync_token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
END;
$$;

ALTER FUNCTION public.sync_service_role_key() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sync_service_role_key() FROM PUBLIC, anon, authenticated;

-- Cron horaire. Idempotent : cron.schedule remplace le job homonyme.
-- Sauté si pg_cron est absent (CI/local) pour ne pas casser l'application
-- des migrations — même pattern que les crons WhatsApp.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'sync-service-key-hourly',
      '45 * * * *',
      'SELECT public.sync_service_role_key();'
    );
  END IF;
END
$do$;
