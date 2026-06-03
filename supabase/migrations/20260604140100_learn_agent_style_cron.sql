-- Apprentissage T1 : cron quotidien qui déclenche learn-agent-style (distillation par agent).
-- Quotidien (pas minute) : la distillation est best-effort et le style bouge lentement.
-- Gardé par la présence de pg_cron : planifié en prod, sauté en local/CI (schema "cron" absent)
-- pour ne pas casser l'application des migrations.

BEGIN;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'learn-agent-style-daily',
      '40 4 * * *',
      $cron$
      SELECT net.http_post(
        url := public.get_app_config('supabase_url') || '/functions/v1/learn-agent-style',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — learn-agent-style-daily non planifié';
  END IF;
END
$do$;

COMMIT;
