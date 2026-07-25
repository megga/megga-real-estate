-- Purge chat-staging : passage à l'API Storage (fix du cron cassé).
--
-- La plateforme Supabase a ajouté un trigger de protection sur storage.objects
-- (« Direct deletion from storage tables is not allowed. Use the Storage API
-- instead. ») → le DELETE SQL direct du cron `purge-chat-staging-daily`
-- (migration 20260706140000) échoue chaque nuit depuis.
--
-- Nouveau mécanisme, même filet de sécurité (photos de chat orphelines du
-- copilote web, bucket PUBLIC — cf. feat #811) :
--   1. SELECT des objets périmés (>24 h) dans storage.objects — la LECTURE
--      reste permise, seule la suppression directe est bloquée ;
--   2. suppression via l'endpoint BULK de l'API Storage
--      (DELETE /storage/v1/object/property-photos, body {"prefixes":[…]}),
--      exactement ce que fait supabase-js .remove() — les noms voyagent dans
--      le corps JSON (aucun besoin d'URL-encoder des noms arbitraires) ;
--   3. auth = service key via public.get_app_config('service_role_key')
--      (même source que les autres crons → couverte par le self-heal
--      sync-service-key en cas de rotation).
--
-- Vérifié en prod avant migration : net.http_delete(bulk remove) → HTTP 200.
-- Limites assumées : pg_net est asynchrone (fire-and-forget, comme les autres
-- crons net.http_*) — un échec HTTP ponctuel est rattrapé la nuit suivante
-- (le filtre >24 h est un TTL, pas un instantané). LIMIT 200/run : au-delà
-- (impossible en usage normal), le reliquat part les nuits suivantes.
--
-- Idempotent : unschedule avant schedule.

do $$ begin perform cron.unschedule('purge-chat-staging-daily'); exception when others then null; end $$;

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('purge-chat-staging-daily', '30 3 * * *', $cron$
      with stale as (
        select name
        from storage.objects
        where bucket_id = 'property-photos'
          and position('/chat-staging/' in name) > 0
          and created_at < now() - interval '24 hours'
        order by created_at
        limit 200
      )
      select net.http_delete(
        url := 'https://eayczugyrvmtqnnmvjod.supabase.co/storage/v1/object/property-photos',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', public.get_app_config('service_role_key'),
          'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
        ),
        body := jsonb_build_object('prefixes', (select jsonb_agg(name) from stale)),
        timeout_milliseconds := 30000
      )
      where exists (select 1 from stale)
    $cron$);
  end if;
end $$;
