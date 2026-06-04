-- Planifie whatsapp-agent-async chaque minute. Miroir EXACT du cron whatsapp-process
-- (get_app_config + net.http_post + Bearer service_role). Gardé par la présence de
-- pg_cron : planifié en prod, sauté en local/CI (schema "cron" absent) pour ne pas
-- casser l'application des migrations.

BEGIN;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'whatsapp-agent-async-minute',
      '* * * * *',
      $cron$
      SELECT net.http_post(
        url := public.get_app_config('supabase_url') || '/functions/v1/whatsapp-agent-async',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — whatsapp-agent-async-minute non planifié';
  END IF;
END
$do$;

COMMIT;
