-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Cycle de vie du capability token de visite : péremption, non-rejouabilité, journal.
-- ═══════════════════════════════════════════════════════════════════════════════════════
--
-- La surface publique « gérer ma visite » (VisitManagePage, VisitFeedbackPage) repose sur
-- `visits.manage_token` — un uuid non devinable porté par le lien envoyé à l'acheteur, servi
-- par quatre RPC SECURITY DEFINER posées en 20260711190000. Cette migration ferme quatre
-- défauts de ce dispositif, sans toucher à sa forme (aucune signature ne bouge, aucune
-- colonne n'est ajoutée, `src/types/database.ts` ne dérive pas).
--
-- 1. UNE POLICY MORTE QUI FUYAIT LE TOKEN. `visits_select_by_buyer_email` (20260526140000)
--    laissait n'importe quel utilisateur authentifié LIRE une ligne `visits` entière — donc
--    son `manage_token`, donc la capability elle-même — au seul motif que la revendication
--    `email` de son JWT égalait `buyer_email`. Son unique consommateur,
--    `src/components/account/profile/VisitsRow.tsx`, a disparu avec le pivot CRM-first, et
--    `/account` redirige désormais vers `/dashboard` : la policy ne servait plus personne et
--    ne portait plus que son risque. L'index fonctionnel qui l'accompagnait n'existait que
--    pour son prédicat.
--
-- 2. AUCUNE PÉREMPTION, D'AUCUNE SORTE. Un `manage_token` émis en janvier restait valable en
--    décembre. Il est désormais borné par la visite qu'il gère (voir plus bas).
--
-- 3. AUCUN GARDE-FOU D'ÉTAT. Les trois gestes mutants s'appliquaient sans regarder le statut :
--    une visite annulée ou terminée pouvait être ressuscitée et antidatée, une annulation
--    rejouée, un feedback réécrit autant de fois que voulu.
--
-- 4. AUCUNE TRACE. Ces trois gestes publics ne produisaient ZÉRO ligne d'`activity_events`,
--    en contradiction avec la règle « audit trail pour toute action » : l'agent voyait l'état
--    changer sans savoir ni qui, ni quand, ni combien de fois. Intenable pour un produit
--    compliance-first.
--
-- ── Choix : péremption DÉRIVÉE, pas colonne ───────────────────────────────────────────
-- Le token est vivant tant que `now() < scheduled_at + interval '30 days'`. Dériver la borne
-- évite une colonne, un backfill et une régénération de `database.ts` — et c'est la bonne
-- borne au fond : un lien de gestion qui survit un mois à la visite qu'il gère n'a plus
-- d'usage légitime. Effet de bord assumé : replanifier repousse la visite, donc prolonge le
-- lien. C'est le comportement voulu — le lien accompagne la visite, il ne la précède pas.
--
-- ── Choix : duplication en ligne plutôt qu'une fonction d'aide ────────────────────────
-- Le prédicat de péremption tient en une expression. Une fonction `public.*` l'aurait rendue
-- unique, mais au prix de deux effets non désirés : elle apparaîtrait dans les types générés
-- (dérive de `database.ts` sans contrepartie fonctionnelle) et, prenant une ligne `visits` en
-- argument, PostgREST l'exposerait comme colonne calculée de la table. Quatre occurrences
-- d'une expression d'une ligne coûtent moins que ça.

-- ── (1) La policy morte et son index tombent ──────────────────────────────────────────
drop policy if exists "visits_select_by_buyer_email" on public.visits;
drop index if exists public.idx_visits_buyer_email_lower;

-- ── (2) Lecture publique ───────────────────────────────────────────────────────────────
-- VOLATILE, et ce n'est pas un détail : PostgREST sert les fonctions STABLE en GET, ce qui
-- ferait passer le capability token dans une query string — donc dans les journaux d'accès
-- du CDN et de la plateforme. VOLATILE impose le POST. `supabase.rpc()` poste déjà : aucun
-- changement client n'est requis.
--
-- Le `manage_token` n'est plus renvoyé : aucun composant ne le lit (il ne survit que dans les
-- déclarations de types de `src/hooks/useVisits.ts`), et réémettre une capability dans le
-- corps de réponse qu'elle a servi à obtenir est une exposition gratuite.
--
-- Un token périmé rend NULL, exactement comme un token inconnu : distinguer les deux
-- n'aiderait que celui qui sonde.
create or replace function public.get_visit_by_token(p_token uuid)
returns jsonb
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', v.id,
    'scheduled_at', v.scheduled_at,
    'status', v.status,
    'buyer_name', v.buyer_name,
    'buyer_email', v.buyer_email,
    'property', case when p.id is null then null else jsonb_build_object(
      'title', p.title, 'address', p.address, 'city', p.city,
      'photos', coalesce(to_jsonb(p.photos), '[]'::jsonb)) end)
  from public.visits v
  left join public.properties p on p.id = v.property_id
  where p_token is not null
    and v.manage_token = p_token
    and now() < v.scheduled_at + interval '30 days'
$$;

-- ── (3) Replanifier ────────────────────────────────────────────────────────────────────
-- L'ancienne version posait `status = 'planned'` SANS CONDITION : une visite annulée ou
-- terminée redevenait planifiée, à la date que voulait le porteur du lien, y compris dans le
-- passé. Deux refus s'ajoutent donc — statut terminal, et date révolue.
--
-- `for update` : deux clics simultanés sur le même lien ne doivent pas produire deux
-- transitions ni deux lignes de journal.
create or replace function public.reschedule_visit_by_token(p_token uuid, p_new_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v public.visits%rowtype;
begin
  if p_token is null or p_new_at is null then return false; end if;
  if p_new_at <= now() then return false; end if;

  select * into v
    from public.visits
   where manage_token = p_token
     and now() < scheduled_at + interval '30 days'
     for update;
  if not found then return false; end if;
  if v.status in ('cancelled', 'done', 'no_show') then return false; end if;

  update public.visits
     set scheduled_at = p_new_at, status = 'planned'
   where id = v.id;

  -- actor_id NULL + actor_kind 'system' : l'acheteur n'a pas d'identité côté plateforme, et
  -- `activity_events_actor_kind_coherence` n'admet un actor_id que pour actor_kind 'user'.
  -- Les horodatages sont normalisés en UTC : un timestamptz nu dans un jsonb se rend selon le
  -- fuseau de la session, donc deux sessions journaliseraient la même donnée différemment.
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, object_label, metadata)
  values (
    v.agency_id, null, 'system', 'visit_rescheduled_by_token', 'visit', v.id,
    'deal', 'info', coalesce(nullif(v.buyer_name, ''), 'Visiteur'),
    jsonb_build_object(
      'previous_status', v.status,
      'previous_scheduled_at', to_char(v.scheduled_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'new_scheduled_at', to_char(p_new_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));

  return true;
end $$;

-- ── (4) Annuler ────────────────────────────────────────────────────────────────────────
-- Refuser un statut déjà terminal rend l'annulation à usage unique et coupe le rejeu (sans
-- ce refus, chaque appel réémettait un événement de journal pour un état inchangé).
--
-- Le `manage_token` n'est délibérément PAS effacé : la page doit encore pouvoir afficher la
-- confirmation « annulée » via get_visit_by_token (VisitManagePage lit `visit.status`).
create or replace function public.cancel_visit_by_token(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v public.visits%rowtype;
begin
  if p_token is null then return false; end if;

  select * into v
    from public.visits
   where manage_token = p_token
     and now() < scheduled_at + interval '30 days'
     for update;
  if not found then return false; end if;
  if v.status in ('cancelled', 'done', 'no_show') then return false; end if;

  update public.visits set status = 'cancelled' where id = v.id;

  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, object_label, metadata)
  values (
    v.agency_id, null, 'system', 'visit_cancelled_by_token', 'visit', v.id,
    'deal', 'info', coalesce(nullif(v.buyer_name, ''), 'Visiteur'),
    jsonb_build_object(
      'previous_status', v.status,
      'scheduled_at', to_char(v.scheduled_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));

  return true;
end $$;

-- ── (5) Feedback post-visite ───────────────────────────────────────────────────────────
-- Deux corrections. D'abord le rejeu : rating / feedback_buyer / ai_objections se réécrivaient
-- indéfiniment. La marque d'unicité retenue est l'AVIS DÉJÀ DÉPOSÉ, surtout pas le statut
-- `done` — voir l'avertissement dans le corps, c'est le piège de ce garde-fou. Ensuite la
-- note : hors 1..5 elle heurtait `visits_rating_check`, qui remontait un SQLSTATE 23514 brut à
-- un appelant anonyme au lieu d'un booléen. Elle est validée avant l'écriture. NULL reste
-- accepté : la colonne est nullable et donner une note est facultatif (l'acheteur peut
-- n'écrire qu'un commentaire).
create or replace function public.submit_visit_feedback_by_token(
  p_token uuid, p_rating integer, p_comment text, p_ai jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v public.visits%rowtype;
begin
  if p_token is null then return false; end if;
  if p_rating is not null and (p_rating < 1 or p_rating > 5) then return false; end if;

  select * into v
    from public.visits
   where manage_token = p_token
     and now() < scheduled_at + interval '30 days'
     for update;
  if not found then return false; end if;

  -- ⚠ NE PAS refuser sur `status = 'done'`. C'est le statut NORMAL au moment du
  -- dépôt : l'agent clôt la visite, puis `automation-engine` ne relance pour un
  -- avis QUE les visites déjà `done` et sans `feedback_buyer`
  -- (supabase/functions/automation-engine/index.ts). Refuser sur `done`
  -- fermerait donc le seul chemin par lequel un avis arrive.
  -- Ce qu'on veut empêcher, c'est le REJEU : la marque d'unicité est l'avis
  -- lui-même, pas le statut de la visite.
  if v.rating is not null or v.feedback_buyer is not null then return false; end if;
  if v.status = 'cancelled' then return false; end if;
  -- Un avis sur une visite qui n'a pas encore eu lieu n'a pas de sens, et sans ce
  -- garde-fou le porteur du jeton pourrait clore d'avance une visite à venir.
  if now() < v.scheduled_at then return false; end if;

  update public.visits
     set rating = p_rating,
         feedback_buyer = nullif(coalesce(p_comment, ''), ''),
         ai_objections = coalesce(p_ai, '{}'::jsonb),
         status = 'done',
         completed_at = now(),
         feedback_sent = true
   where id = v.id;

  -- Le commentaire libre n'est pas recopié dans le journal : il vit déjà dans
  -- `visits.feedback_buyer`, le dupliquer n'ajoute qu'une seconde copie à purger.
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, object_label, metadata)
  values (
    v.agency_id, null, 'system', 'visit_feedback_by_token', 'visit', v.id,
    'deal', 'info', coalesce(nullif(v.buyer_name, ''), 'Visiteur'),
    jsonb_build_object(
      'previous_status', v.status,
      'rating', p_rating,
      'has_comment', nullif(coalesce(p_comment, ''), '') is not null));

  return true;
end $$;

-- Aucun GRANT à réémettre : CREATE OR REPLACE FUNCTION conserve les privilèges de la fonction
-- remplacée. Les quatre RPC gardent donc `execute` pour anon + authenticated, posé en
-- 20260711190000. Ne pas « corriger » une absence de grant ici — elle est normale.

-- ── (6) Privilèges de table : défense en profondeur ────────────────────────────────────
-- Relevé en production : `anon` ET `authenticated` détiennent DELETE, INSERT, REFERENCES,
-- SELECT, TRIGGER, TRUNCATE, UPDATE sur les quatre tables du parcours par lien. Ces droits ne
-- viennent d'aucune migration — c'est le footgun des privilèges par défaut de Supabase, déjà
-- traité pour les tables de console en 20260801410000.
--
-- Retrait total pour `anon` : aujourd'hui inerte (plus une seule policy anon ne survit sur ces
-- tables — `anon_select_visit_by_token` et `anon_update_visit_by_token` sont tombées en
-- 20260711190000, `anon_insert_visit` en 20260712090438 — et tout chemin public passe soit par
-- une fonction SECURITY DEFINER, soit par une edge function en service_role). Ce qui reste est
-- le TRUNCATE, et il compte : TRUNCATE ÉCHAPPE À LA RLS. Aucune policy, si stricte soit-elle,
-- ne peut rattraper ce grant — la seule fermeture possible est de le révoquer.
--
-- Pour `authenticated`, on ne retire QUE les trois droits que la RLS ne couvre pas
-- (TRUNCATE, REFERENCES, TRIGGER). SELECT/INSERT/UPDATE/DELETE restent : ils sont gouvernés
-- par les policies d'agence et les parcours agent s'en servent réellement
-- (`src/hooks/useVisits.ts` insère, modifie et supprime). Casser un parcours agent coûterait
-- plus que le risque résiduel.
revoke all on table public.visits                 from anon;
revoke all on table public.kyc_magic_links        from anon;
revoke all on table public.kyc_magic_link_uploads from anon;
revoke all on table public.buyer_reception_links  from anon;

revoke truncate, references, trigger on table public.visits                 from authenticated;
revoke truncate, references, trigger on table public.kyc_magic_links        from authenticated;
revoke truncate, references, trigger on table public.kyc_magic_link_uploads from authenticated;
revoke truncate, references, trigger on table public.buyer_reception_links  from authenticated;
