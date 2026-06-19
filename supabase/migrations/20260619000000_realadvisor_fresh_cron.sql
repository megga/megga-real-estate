-- realadvisor-sync mode 'fresh' : mise à jour quotidienne légère + kill-switch.
-- Accès RealAdvisor accordé (décision Gregory). Le mode 'fresh' (cf
-- supabase/functions/realadvisor-sync/index.ts) = UNE requête nationale triée
-- created_at_desc, ~4-22 requêtes/jour, une seule invocation, PAS de sweep.

-- Kill-switch : couper le cron en 1 UPDATE, sans redéploiement.
--   update app_config set value='false' where key='realadvisor_fresh_enabled';
insert into public.app_config (key, value)
values ('realadvisor_fresh_enabled', 'true')
on conflict (key) do nothing;

-- Cron quotidien 03:30 UTC (heure creuse, séparé de flatfox-sync 04:00).
do $$ begin perform cron.unschedule('realadvisor-fresh-daily'); exception when others then null; end $$;

select cron.schedule(
  'realadvisor-fresh-daily',
  '30 3 * * *',
  $cron$ select net.http_post(
    url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/realadvisor-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
    ),
    body := jsonb_build_object('mode', 'fresh', 'offer_type', 'buy', 'trigger_source', 'cron-fresh')
  ) $cron$
);
