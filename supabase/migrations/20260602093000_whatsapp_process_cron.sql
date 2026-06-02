-- Planifie whatsapp-process chaque minute. Miroir du pattern existant
-- (get_app_config + net.http_post + Bearer service_role), cf. matching/search-alert.

BEGIN;

SELECT cron.schedule(
  'whatsapp-process-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := public.get_app_config('supabase_url') || '/functions/v1/whatsapp-process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

COMMIT;
