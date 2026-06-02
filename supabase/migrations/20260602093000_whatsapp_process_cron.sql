-- Planifie whatsapp-process chaque minute. Miroir du pattern existant
-- (get_app_config + net.http_post + Bearer service_role), cf. matching/search-alert.

BEGIN;

-- Gardé par la présence de pg_cron : planifié en prod ; sauté en local/CI (où le
-- schema "cron" n'existe pas) pour ne pas casser l'application des migrations.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'whatsapp-process-minute',
      '* * * * *',
      $cron$
      SELECT net.http_post(
        url := public.get_app_config('supabase_url') || '/functions/v1/whatsapp-process',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — whatsapp-process-minute non planifié';
  END IF;
END
$do$;

COMMIT;
