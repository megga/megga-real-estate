-- Digest hebdomadaire (fin de Phase 3) : un bilan de la semaine envoyé par email
-- à chaque agent le vendredi. Bilan 100% AGRÉGÉ (compteurs) → aucune PII client, pas
-- de pseudonymisation nécessaire ; DeepSeek met juste en mots, fallback déterministe.
-- Push vers l'AGENT uniquement (jamais un client). Gated + opt-out par agent.

BEGIN;

-- Kill-switch (défaut OFF).
INSERT INTO public.app_config (key, value)
VALUES ('weekly_digest_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Opt-out par agent (colonne simple ; réglable plus tard depuis les paramètres).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_digest_opt_out boolean NOT NULL DEFAULT false;

-- Planification vendredi 17:00 UTC, une invocation par agence (miroir de
-- hourly_automation_scan). Gardée par la présence de pg_cron.
CREATE OR REPLACE FUNCTION public.weekly_digest_scan()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  agency RECORD;
  base_url TEXT := get_app_config('supabase_url');
  svc_key  TEXT := get_app_config('service_role_key');
BEGIN
  FOR agency IN SELECT DISTINCT id AS agency_id FROM agencies LOOP
    PERFORM net.http_post(
      url := base_url || '/functions/v1/weekly-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
      ),
      body := jsonb_build_object('agency_id', agency.agency_id)
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.weekly_digest_scan() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_digest_scan() TO service_role;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule('weekly-digest-friday', '0 17 * * 5', $cron$ SELECT public.weekly_digest_scan(); $cron$);
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — weekly-digest-friday non planifié';
  END IF;
END
$do$;

COMMIT;
