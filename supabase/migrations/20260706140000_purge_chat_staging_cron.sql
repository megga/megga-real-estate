-- Purge quotidienne des photos de CHAT orphelines (copilote web, feat #811).
--
-- Le composer stage chaque photo jointe dans property-photos/{agencyId}/chat-staging/ au
-- moment de la jointure. execWebAttachPropertyPhotos les consomme (remove) sur succès ET
-- sur ses sorties d'échec (lookup none/many/error). MAIS si l'outil n'est jamais appelé
-- (écritures OFF, ou le LLM ne l'appelle pas), l'objet resterait dans un bucket PUBLIC.
-- Ce cron supprime les objets chat-staging de plus de 24 h : la métadonnée storage.objects
-- part → l'URL publique renvoie 404 (fin de l'exposition). Filet de sécurité catch-all.
--
-- Idempotent : unschedule avant schedule ; DELETE strictement borné (préfixe + âge + bucket).

do $$ begin perform cron.unschedule('purge-chat-staging-daily'); exception when others then null; end $$;

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('purge-chat-staging-daily', '30 3 * * *', $cron$
      delete from storage.objects
      where bucket_id = 'property-photos'
        and position('/chat-staging/' in name) > 0
        and created_at < now() - interval '24 hours'
    $cron$);
  end if;
end $$;
