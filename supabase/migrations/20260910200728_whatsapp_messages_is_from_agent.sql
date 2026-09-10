-- Ferme le cas de la DÉLIAISON que 20260910192017 laissait ouvert.
--
-- 20260910192017 écarte de l'avis LPD tout numéro qui porte un lien d'agent VÉRIFIÉ, mais elle
-- lit l'état COURANT du lien. Or `unlink_whatsapp_number` efface la vérification ET le numéro
-- du lien (`verified = false`, `wa_number = NULL`) : un agent qui délie son numéro redevenait
-- éligible sur ses entrants des 24 dernières heures, et recevait dans la minute l'avis écrit
-- pour les prospects.
-- ⚠ 20260910192017 écrivait « unlink = DELETE » : FAUX, relevé en prod le 10.09.2026 par
-- pg_get_functiondef. C'était vrai en 20260817133200 ; 20260817143430 en a fait un UPDATE, pour
-- que les compteurs d'OTP survivent. La ligne reste, et le trou est le même.
-- Même trou par l'autre bout : un tick de
-- whatsapp-process tombant entre l'insertion du message d'appairage et la vérification du lien
-- (82 ms le 10.09.2026) envoyait encore l'avis.
--
-- Le webhook, lui, sait AU MOMENT de la réception qu'il route un message côté agent : branche
-- agent, opt-out bouton d'un agent, message d'appairage. Il le note désormais sur la ligne
-- (`is_from_agent`), et la fonction écarte ces lignes. L'exclusion ne dépend plus de ce que le
-- lien devient ensuite. La clause sur le lien vérifié reste : elle couvre ce que le webhook n'a
-- pas marqué (lignes antérieures à cette colonne, numéro d'agent entré par un autre chemin).
--
-- Rattrapage : on marque les entrants que la fonction excluait DÉJÀ par le lien. Aucune ligne
-- existante ne change donc d'éligibilité au moment de la migration ; une déliaison ne pourra
-- simplement plus la défaire.
--
-- ⚠ ORDRE DE DÉPLOIEMENT : cette migration AVANT le webhook qui écrit la colonne. L'upsert
-- d'appairage avale ses erreurs et la branche agent ne lit pas celle de `insertInboundOnce` :
-- un webhook écrivant une colonne absente perdrait ces lignes sans bruit. L'ordre inverse est
-- sans risque (défaut false, la clause du lien couvre comme avant).
--
-- Corps de la fonction repris de pg_get_functiondef en production (10.09.2026, identique à
-- 20260910192017) ; seule la clause `not m.is_from_agent` est nouvelle. SECURITY DEFINER,
-- search_path et droits (EXECUTE à service_role seul) conservés.
begin;

-- L'ALTER prend un verrou exclusif sur une table où le webhook écrit à chaque message : mieux
-- vaut échouer vite que faire patienter les entrants derrière une requête longue.
set local lock_timeout = '5s';

alter table public.whatsapp_messages
  add column if not exists is_from_agent boolean not null default false;

comment on column public.whatsapp_messages.is_from_agent is
  'Entrant routé côté AGENT par le webhook (branche agent, opt-out bouton d''un agent, message '
  'd''appairage). Posé à la réception : une déliaison ultérieure ne le défait pas. Lu par '
  'whatsapp_pending_notices, qui en écarte l''avis LPD des prospects.';

update public.whatsapp_messages m
   set is_from_agent = true
 where m.direction = 'inbound'
   and not m.is_from_agent
   and exists (select 1 from public.whatsapp_agent_links l
                where l.verified
                  and public.normalize_phone(l.wa_number) = public.normalize_phone(m.wa_from));

create or replace function public.whatsapp_pending_notices(p_limit int default 10)
returns table(agency_id uuid, wa_phone text)
language sql security definer set search_path to 'public','pg_temp' as $$
  select distinct m.agency_id, m.wa_from
  from public.whatsapp_messages m
  where m.direction = 'inbound'
    and m.agency_id is not null
    and m.created_at > now() - interval '24 hours'
    and not m.is_from_agent
    and not exists (select 1 from public.whatsapp_notices n
                    where n.agency_id = m.agency_id and n.wa_phone = m.wa_from)
    and not exists (select 1 from public.contact_suppressions s
                    where public.normalize_phone(s.wa_phone) = public.normalize_phone(m.wa_from)
                      and s.channel in ('whatsapp','all') and s.lifted_at is null
                      and s.reason in ('stop_keyword','meta_block'))
    and not exists (select 1 from public.whatsapp_agent_links l
                    where l.verified
                      and public.normalize_phone(l.wa_number) = public.normalize_phone(m.wa_from))
  limit greatest(p_limit, 1);
$$;

revoke all on function public.whatsapp_pending_notices(int) from public, anon, authenticated;
grant execute on function public.whatsapp_pending_notices(int) to service_role;

commit;
