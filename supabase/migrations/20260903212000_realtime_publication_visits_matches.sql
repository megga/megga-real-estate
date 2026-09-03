-- Realtime : `visits` et `matches` entrent dans la publication qu'elles supposaient déjà.
--
-- Constat du 03.09.2026 (audit de santé). Le dépôt porte quatre abonnements
-- `postgres_changes` ; la publication `supabase_realtime` n'en portait que DEUX tables :
--   · `activity_events` — publiée, OK (useAdminLiveFeed, useAgentNotifications)
--   · `crm_offers`      — publiée, OK
--   · `visits`  (useVisitDetail.ts:104)   — ABSENTE : abonnement inerte depuis son écriture
--   · `matches` (useContactBuyerLoop)     — ABSENTE : idem
-- Un abonnement à une table non publiée ne reçoit AUCUN événement et ne lève AUCUNE erreur :
-- le canal passe `SUBSCRIBED`, puis rien. C'est pourquoi le défaut a vécu sans être vu — et
-- pourquoi la sonde `useRealtimeHealth`, qui ne mesure que la poignée de main, ne pouvait pas
-- l'attraper (elle resterait verte avec une publication VIDE).
--
-- Effet : la synchronisation mobile→bureau d'une visite et le rafraîchissement live de la
-- boucle acheteur sur la fiche contact ne fonctionnaient pas.
--
-- SÛRETÉ, vérifiée avant d'ajouter — Realtime applique la RLS de l'abonné, donc publier une
-- table n'ouvre que ce que la RLS laisse déjà passer :
--   · `matches` : policies SELECT/UPDATE/DELETE toutes bornées par
--     `agency_id = get_user_agency_id()`. `anon` porte le privilège SELECT au niveau table,
--     mais `get_user_agency_id()` est NULL pour lui ⇒ zéro ligne.
--   · `visits`  : mêmes policies bornées par l'agence, et `anon` n'a MÊME PAS le privilège
--     SELECT (`has_table_privilege('anon','public.visits','SELECT')` = false). La lecture
--     publique par jeton passe par la RPC `get_visit_by_token`, pas par la table.
-- Aucune des deux n'expose donc quoi que ce soit d'inter-agence.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;   -- base de CI sans Realtime : rien à faire
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visits'
  ) then
    alter publication supabase_realtime add table public.visits;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;
