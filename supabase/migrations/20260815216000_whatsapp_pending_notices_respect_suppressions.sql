-- Sans ça, MEGGA répond au STOP par l'avis LPD dans l'heure (cron chaque minute).
-- On n'exclut QUE stop_keyword/meta_block : un opt-out 'agent_manual' est une décision
-- de l'AGENT, pas de la personne — l'obligation d'information (art. 19 nLPD) subsiste.
--
-- `set search_path` passe de `= public` (20260602110000:23) à `to 'public','pg_temp'`,
-- la forme retenue depuis 20260807101534 : sans pg_temp explicite, une table temporaire
-- homonyme se glisse devant les tables réelles dans une fonction SECURITY DEFINER.
create or replace function public.whatsapp_pending_notices(p_limit int default 10)
returns table(agency_id uuid, wa_phone text)
language sql security definer set search_path to 'public','pg_temp' as $$
  select distinct m.agency_id, m.wa_from
  from public.whatsapp_messages m
  where m.direction = 'inbound'
    and m.agency_id is not null
    and m.created_at > now() - interval '24 hours'
    and not exists (select 1 from public.whatsapp_notices n
                    where n.agency_id = m.agency_id and n.wa_phone = m.wa_from)
    and not exists (select 1 from public.contact_suppressions s
                    where public.normalize_phone(s.wa_phone) = public.normalize_phone(m.wa_from)
                      and s.channel in ('whatsapp','all') and s.lifted_at is null
                      and s.reason in ('stop_keyword','meta_block'))
  limit greatest(p_limit, 1);
$$;
revoke all on function public.whatsapp_pending_notices(int) from public, anon, authenticated;
-- Explicite : `create or replace` préserve les ACL existantes, mais sur une base fraîche
-- (CI) seul le défaut Supabase les pose — et `revoke … from public` retire la voie
-- générale. Son unique appelant, whatsapp-process, tourne en service_role.
grant execute on function public.whatsapp_pending_notices(int) to service_role;
