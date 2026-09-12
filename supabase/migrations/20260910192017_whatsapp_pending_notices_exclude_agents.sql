-- L'avis LPD (art. 19 nLPD) est écrit pour un PROSPECT. whatsapp_pending_notices l'adressait
-- aussi aux AGENTS.
--
-- Mesuré en production le 10.09.2026. Le lien WhatsApp de Julien passe `verified` à
-- 15:19:41.818 UTC ; le message d'appairage, que le webhook insère 82 ms plus tôt avec
-- l'agence du lien, rend son numéro éligible, et le tick suivant de whatsapp-process lui
-- envoie l'avis prospect à 15:20:05, avant même sa première question au copilote. Ce n'est
-- pas le premier : whatsapp_notices porte un autre avis au même numéro, pour une autre
-- agence, parti le 02.06.2026 à 02:36, au premier passage du cron (20260602110000). La clé
-- de whatsapp_notices étant (agence, numéro), chaque agent le recevait une fois par agence,
-- et de nouveau quand son lien change d'agence.
--
-- La fonction lisait tout l'entrant récent qui porte un agency_id, or la branche agent du
-- webhook insère ses entrants AVEC l'agence du lien. Le webhook le dit lui-même à propos de
-- l'opt-out d'un agent : « l'avis LPD, écrit pour un PROSPECT démarché. Un agent est un
-- utilisateur du service, sous base contractuelle ; le lui envoyer serait faux ». Et
-- whatsapp_send_allowed ne rattrapait rien : son étape 5 accepte `lpd_notice` avant de
-- regarder si le sujet est un profil.
--
-- Pourquoi exclure le numéro ne fait perdre l'avis à aucun prospect : avec le numéro MEGGA
-- partagé, le webhook route un numéro d'agent vérifié vers la branche agent AVANT la branche
-- client (sans lire `wa_to`). Un numéro d'agent vérifié n'écrit donc jamais comme prospect
-- à ce numéro. Seul un lien VÉRIFIÉ exclut : pendant un appairage en cours, le numéro n'est
-- pas encore routé vers la branche agent et écrit comme n'importe qui.
--
-- normalize_phone des deux côtés, et non l'égalité brute du webhook : c'est l'identité de
-- numéro du domaine (même prédicat que le back-link des orphelins, 20260710170000, et que la
-- suppression juste au-dessus). Elle ne suppose rien du format enregistré au lien :
-- start_whatsapp_number_verification garde les chiffres qu'il reçoit, sans les normaliser.
--
-- ⚠ La clause lit l'état COURANT du lien, pas celui du moment du message. Deux restes, donc :
-- un agent qui délie son numéro (unlink = DELETE) redevient éligible sur ses entrants des
-- 24 dernières heures ; et un tick qui tomberait entre l'insertion du message d'appairage et
-- la vérification du lien (82 ms le 10.09) enverrait encore l'avis.
--
-- Coût, mesuré par EXPLAIN ANALYZE en production le 10.09.2026 (CLAUDE.md §7) : le chemin sur
-- whatsapp_messages ne bouge pas (Index Scan sur idx_wa_messages_inbound_created, Index Only
-- Scan sur la clé unique de whatsapp_notices). La condition ajoutée devient un Hash Anti Join
-- dont le hash se construit UNE fois sur les liens vérifiés — au plus un par agent,
-- profile_id étant UNIQUE — et non une fois par message. 0,227 → 0,254 ms, 21 buffers avant
-- comme après.
--
-- Corps repris de pg_get_functiondef en production (10.09.2026), identique à 20260815216000 ;
-- seule la troisième clause `not exists` est nouvelle. SECURITY DEFINER, search_path et
-- droits conservés (propriétaire postgres, EXECUTE à service_role seul — l'ACL vivante).
begin;

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
    and not exists (select 1 from public.whatsapp_agent_links l
                    where l.verified
                      and public.normalize_phone(l.wa_number) = public.normalize_phone(m.wa_from))
  limit greatest(p_limit, 1);
$$;

revoke all on function public.whatsapp_pending_notices(int) from public, anon, authenticated;
-- Explicite pour la même raison qu'en 20260815216000 : sur une base fraîche (CI), seul le
-- défaut Supabase poserait l'ACL. Unique appelant : whatsapp-process, en service_role.
grant execute on function public.whatsapp_pending_notices(int) to service_role;

commit;
