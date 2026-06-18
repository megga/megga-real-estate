-- Assainissement crons — retirer les secrets en clair + GUC morts.
--
-- Contexte vérifié en prod le 17 juin 2026 (cron.job + cron.job_run_details) :
--   #17 ai-billing-hourly  + #18 cf-images-backfill-every-10-min
--       utilisent current_setting('app.settings.supabase_url') = GUC inexistant
--       -> ERROR "unrecognized configuration parameter" à CHAQUE run (panne réelle, en continu).
--   #11 platform-metrics-hourly + #12 flatfox-sync-daily
--       embarquent le JWT service_role legacy EN CLAIR (inline) dans cron.command :
--       secret exposé à quiconque lit cron.job, et != clé runtime sb_secret_ -> bombe à la rotation.
--   #4  visit-reminders-j1
--       utilise current_setting('supabase.service_role_key', true) = NULL -> Authorization: 'Bearer ' (vide).
--
-- Correctif : tout passer par public.get_app_config('supabase_url' | 'service_role_key'),
-- le pattern déjà utilisé (et qui résout en contexte cron) par les crons whatsapp #80/#117/#135.
-- Idempotent (cron.alter_job rejoue le même command) + défensif : no-op si pg_cron est absent
-- ou si un job est introuvable (ex. stack CI fraîche). Aucun secret n'apparaît dans ce fichier.

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron absent — migration crons ignorée (no-op).';
    return;
  end if;

  -- #17 ai-billing-hourly : GUC mort -> get_app_config
  if exists (select 1 from cron.job where jobname = 'ai-billing-hourly') then
    perform cron.alter_job(
      (select jobid from cron.job where jobname = 'ai-billing-hourly'),
      command := $cmd$
  SELECT net.http_post(
    url := public.get_app_config('supabase_url') || '/functions/v1/ai-billing-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $cmd$
    );
  end if;

  -- #18 cf-images-backfill-every-10-min : GUC mort -> get_app_config
  if exists (select 1 from cron.job where jobname = 'cf-images-backfill-every-10-min') then
    perform cron.alter_job(
      (select jobid from cron.job where jobname = 'cf-images-backfill-every-10-min'),
      command := $cmd$
  SELECT net.http_post(
    url := public.get_app_config('supabase_url') || '/functions/v1/backfill-cf-images',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
    ),
    body := '{"batch": 25}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cmd$
    );
  end if;

  -- #11 platform-metrics-hourly : retrait du JWT inline -> get_app_config
  if exists (select 1 from cron.job where jobname = 'platform-metrics-hourly') then
    perform cron.alter_job(
      (select jobid from cron.job where jobname = 'platform-metrics-hourly'),
      command := $cmd$SELECT net.http_post(url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/admin-monitoring', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || public.get_app_config('service_role_key')), body := '{}'::jsonb, timeout_milliseconds := 30000);$cmd$
    );
  end if;

  -- #12 flatfox-sync-daily : retrait du JWT inline -> get_app_config
  if exists (select 1 from cron.job where jobname = 'flatfox-sync-daily') then
    perform cron.alter_job(
      (select jobid from cron.job where jobname = 'flatfox-sync-daily'),
      command := $cmd$SELECT net.http_post(url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/flatfox-sync', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || public.get_app_config('service_role_key')), body := '{}'::jsonb, timeout_milliseconds := 10000);$cmd$
    );
  end if;

  -- #4 visit-reminders-j1 : Bearer vide (GUC NULL) -> get_app_config
  if exists (select 1 from cron.job where jobname = 'visit-reminders-j1') then
    perform cron.alter_job(
      (select jobid from cron.job where jobname = 'visit-reminders-j1'),
      command := $cmd$
  SELECT
    net.http_post(
      url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/send-visit-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'reminder',
        'visit_id', v.id::text,
        'agency_id', v.agency_id::text
      )
    )
  FROM visits v
  WHERE v.status IN ('planned', 'confirmed')
    AND v.reminder_sent = false
    AND v.scheduled_at >= (now() + interval '12 hours')
    AND v.scheduled_at <= (now() + interval '36 hours')
    AND v.buyer_email IS NOT NULL;
  $cmd$
    );
  end if;
end $$;
