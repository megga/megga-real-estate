-- realadvisor : RE-CRÉATION du crawl rolling quotidien (22:00 UTC).
--
-- POURQUOI CETTE MIGRATION EXISTE
-- ------------------------------------------------------------------------------
-- 20260619140000 avait posé `realadvisor-rolling-daily` : re-crawl scopé d'un bucket
-- de cantons par nuit (rotation 7 j via `realadvisor_shard_map`, index = dow UTC).
-- C'est le SEUL mécanisme planifié qui re-touche la longue traîne du catalogue :
-- `cron-fresh` est une requête nationale que RA plafonne à ~720 résultats et qui
-- s'arrête dès qu'une page est déjà connue (nuits observées à `total_seen=36`, soit
-- UNE page).
--
-- 20260621140000 l'a retiré (`cron.unschedule`) en même temps que le sweep_enum, au
-- motif « rolling+sweep-enum, throttlé+inerte » : RA throttlait alors l'IP des edge
-- functions, le crawl ne ramenait rien, et la détection a basculé sur pg_net (probe
-- `id_in`). Le probe a bien repris le rôle de DÉTECTION du rolling — mais personne
-- n'a repris son rôle d'INGESTION. Conséquence mesurée entre le 21 et le 25/07 2026 :
-- 3 973 retraits par le sweep contre 635 insertions par `fresh`, vivier `buy` en
-- baisse de 42 621 à 39 377 alors que RA en déclarait ~43 500.
--
-- Le motif de 2026-06-21 ne tient plus : l'énumération manuelle des 26 cantons du
-- 25/07/2026 (6 runs scopés, ~52 000 biens vus, 1 seule slice en échec, 0 throttle)
-- a ramené le vivier à 43 937 (+11,6 %). L'UA est désormais un UA identifié whitelisté
-- par RA (`app_config.realadvisor_user_agent`), et non plus le fallback Chrome.
--
-- ⚠ Cette migration DOIT porter un timestamp postérieur à 20260621140000, sinon le
--   `unschedule` de cette dernière la ré-annulerait à chaque rejeu complet de la
--   séquence de migrations (environnement neuf / CI from scratch).
--
-- ⚠ Ne ressuscite PAS `realadvisor-sweep-enum-daily` : le sweep destructif en service
--   est `realadvisor-probe-sweep` (01:30, oracle `id_in`). `realadvisor_sweep_enabled`
--   reste à `false` ⇒ le sweep_enum resterait de toute façon en dry-run. Le rolling
--   n'écrit que des reçus d'énumération et rafraîchit `last_seen_at`.

-- 1) Le crawl rolling est gaté par son kill-switch côté edge function
--    (trigger_source='cron-rolling' + realadvisor_rolling_enabled != 'false').
--    20260621140000 l'avait laissé à 'false' ; on le ré-arme.
insert into app_config (key, value)
values ('realadvisor_rolling_enabled', 'true')
on conflict (key) do update set value = 'true';

-- 2) Le cron lui-même. Idempotent : unschedule tolérant puis schedule.
--    22:00 UTC = hors du cluster 01:30-05:00 (probe-sweep, revive, fresh, flatfox) ;
--    un run rolling tient le verrou singleton ~15-40 min selon le bucket, il doit être
--    terminé bien avant `realadvisor-fresh-daily` (03:30), sinon fresh abandonne en
--    silence sur le verrou.
do $$ begin perform cron.unschedule('realadvisor-rolling-daily'); exception when others then null; end $$;
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('realadvisor-rolling-daily', '0 22 * * *', $cron$
  select net.http_post(
    url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/realadvisor-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_app_config('service_role_key')),
    body := jsonb_build_object('mode', 'chunk', 'offer_type', 'buy', 'trigger_source', 'cron-rolling',
      'cantons', (public.get_app_config('realadvisor_shard_map')::jsonb)
                   -> (extract(dow from (now() at time zone 'UTC'))::int))
  ) $cron$);
  end if;
end $$;
