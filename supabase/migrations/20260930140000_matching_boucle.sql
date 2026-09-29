-- ══════════════════════════════════════════════════════════════════════════════
-- Matching · lot B : la boucle chez l'agent (21.09.2026)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4.3 à §4.6 et §12.
-- Plan : docs/superpowers/plans/2026-09-21-matching-lot-b-boucle.md.
--
-- Mesuré en production le 21.09.2026 : 1 754 matchs, tous `suggested` ; aucune réponse consignée
-- (`reaction_motif` nul partout) ; aucune relance de proposition. Rien à reprendre.
--
-- 1. `matches.prix_propose` — le prix du bien quand l'agent l'a proposé. Posé par TRIGGER au passage à
--    `sent`, pas par les exécuteurs : une sélection propose N biens en UNE écriture, à N prix différents,
--    et quatre écrivains proposent (atelier, mobile, « Aujourd'hui », fil). La même transition efface la
--    réponse d'avant, SA DATE COMPRISE : un bien revenu par une baisse et reproposé repart sans motif, et
--    `set_match_response_at` (qui ne date qu'une réponse sans date) datera la nouvelle. Un prix nul
--    (« prix sur demande ») n'est pas un prix proposé : `prix_propose` reste nul.
-- 2. `matches.apprentissage_at` — ce refus a nourri une correction de recherche (« Apprendre »), validée
--    ou ignorée. Il ne compte plus : deux NOUVEAUX refus pour ce motif en proposeront une autre.
-- 3. `matches.reaction_motif` — vocabulaire FERMÉ : les huit motifs de la conception, plus
--    `recherche_ajustee` (écarté par la réévaluation d'une recherche, pas par l'acheteur). NOT VALID :
--    les lignes existantes, toutes nulles (mesuré), ne sont pas relues.
-- 4. `reminders.match_ids` — les biens que couvre une relance de proposition. Une sélection de N biens
--    n'a qu'UNE relance ; `match_id` n'en porte que le meilleur (lecteurs d'aujourd'hui inchangés). Posée
--    pour une proposition de PLUSIEURS biens seulement : les écrivains d'un bien (atelier, mobile,
--    « Aujourd'hui ») n'écrivent que `match_id`, et l'écran qui part avant cette migration n'écrit donc
--    pas une colonne qu'elle n'a pas encore créée.
-- 5. `idx_matches_boucle` — ce que le fil lit pour « En attente », « À conclure » et « Apprendre ».
-- 6. `fermer_relance_proposition` — un match qui QUITTE `sent` clôt la relance qui le couvre si plus
--    aucun de ses biens n'est `sent`. Quel que soit l'écrivain, comme les triggers de réaction ; une
--    relance repoussée depuis « Aujourd'hui » (`snoozed`) comprise. La relance est VERROUILLÉE puis relue
--    dans l'instruction suivante : deux réponses simultanées aux deux derniers biens voyaient chacune
--    l'autre encore `sent`, et aucune ne fermait.
-- 7. `log_match_reaction` inscrit aussi le MOTIF d'un refus.
-- 8. `match_retour_prix_*` — un bien refusé pour le PRIX revient à proposer quand son prix passe sous
--    `prix_propose`. Seules les BAISSES déclenchent (clause WHEN), et chacune ne lit que les matchs de son
--    bien : sur 96 511 annonces actives, le coût est celui des baisses du jour, pas celui du catalogue. Un
--    prix nul (« prix sur demande ») n'est pas une baisse ; un prix qui RÉAPPARAÎT après lui se compare au
--    prix proposé comme une baisse, sans quoi « 0 → 1'400'000 » sous un refus à 1'500'000 passait.
-- 9. `matching_appliquer_notes` — les notes d'une recherche renotée, écrites en lot par l'edge
--    `matching-engine` (le score est du TypeScript) : sous le seuil, un match à proposer est écarté
--    (`recherche_ajustee`) ; retenu à nouveau, un match que le moteur avait écarté revient à proposer. Jamais
--    un match que l'agent a écarté. service_role seul.
-- 10. `trigger_matching_on_price_change` — ne supprime plus que les matchs à proposer JAMAIS proposés
--    (`sent_at` nul) : à la baisse suivante, il effaçait un bien revenu par une baisse, son motif et son
--    prix proposé avec lui, que le moteur recréait nu. Et, sans configuration pour rappeler le moteur, il
--    ne supprime plus rien (même garde que `trigger_matching_on_property_active`, 20260526180000).
-- 11. `purge_stale_market_matches` — même règle pour la purge nocturne des annonces retirées.
-- 12. `matching_ajuster_recherche` — la fin d'« Apprendre », d'UN BLOC : la SEULE clé corrigée fusionnée
--    dans les critères d'aujourd'hui (jamais l'instantané de l'écran, qui écraserait ce qu'un collègue a
--    changé entre-temps), la fiche si elle portait les mêmes, les refus pris en compte, la ligne au
--    journal. Écrites une à une par l'edge, une panne au milieu laissait une recherche corrigée sans
--    journal, ou une fiche que le rejeu ne rattrapait plus. service_role seul.
--
-- ⚠ VERROUS. `lock_timeout` de 5 s (précédent : 20260910200728) : un verrou qui attend en file fait
-- attendre derrière lui chaque requête suivante sur sa table ; mieux vaut échouer vite, et être rejouée au
-- push suivant du jour. Les triggers de `market_listings` et de `properties` — les tables où écrivent les
-- collectes et les agents — sont posés EN PREMIER : s'ils attendent, la migration ne retient encore aucun
-- verrou sur `matches`, que le CRM lit à chaque écran.
--
-- ⚠ DATE-GUARD (`deploy.yml`) : appliquée seulement si son horodatage est ≥ au jour UTC de la fusion.
-- Renommer au jour de la fusion si elle a lieu après le 21.09.2026 — après la migration du lot A
-- (…130000), avant celles de la pige (…145000, …150000, …151000), dont elle ne dépend pas.

begin;

set local lock_timeout = '5s';

-- ── 8. Le retour d'un bien refusé pour le prix, sur une BAISSE ───────────────
-- Deux fonctions, une par table : chacune lit la colonne de prix de la sienne.
create or replace function public.match_retour_prix_annonce()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_prix numeric := coalesce(NEW.current_price, NEW.price);
begin
  -- Doublé de la clause WHEN : un prix nul n'est jamais « sous » un prix proposé qui compte.
  if v_prix is null or v_prix <= 0 then
    return null;
  end if;
  with revenus as (
    update public.matches m
       set status = 'suggested', snoozed_until = null
     where m.market_listing_id = NEW.id
       and m.status = 'rejected'
       and m.reaction_motif = 'prix'
       and m.prix_propose is not null
       and v_prix < m.prix_propose
    returning m.id, m.agency_id, m.contact_id, m.prix_propose
  )
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label, category, severity, metadata)
  select r.agency_id, null, 'system', 'match_retour_prix', 'contact', r.contact_id, null, 'deal', 'info',
         jsonb_build_object('match_id', r.id, 'market_listing_id', NEW.id, 'prix_propose', r.prix_propose, 'prix', v_prix)
    from revenus r;
  return null;
end;
$function$;

create or replace function public.match_retour_prix_mandat()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if NEW.price is null or NEW.price <= 0 then
    return null;
  end if;
  with revenus as (
    update public.matches m
       set status = 'suggested', snoozed_until = null
     where m.property_id = NEW.id
       and m.status = 'rejected'
       and m.reaction_motif = 'prix'
       and m.prix_propose is not null
       and NEW.price < m.prix_propose
    returning m.id, m.agency_id, m.contact_id, m.prix_propose
  )
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label, category, severity, metadata)
  select r.agency_id, null, 'system', 'match_retour_prix', 'contact', r.contact_id, null, 'deal', 'info',
         jsonb_build_object('match_id', r.id, 'property_id', NEW.id, 'prix_propose', r.prix_propose, 'prix', NEW.price)
    from revenus r;
  return null;
end;
$function$;

revoke all on function public.match_retour_prix_annonce() from public, anon, authenticated;
revoke all on function public.match_retour_prix_mandat() from public, anon, authenticated;

-- Une baisse vers un prix réel, ou un prix réel qui réapparaît (nul ou inconnu avant) : jamais une
-- hausse, jamais un passage à « prix sur demande ».
drop trigger if exists trg_market_listing_retour_prix on public.market_listings;
create trigger trg_market_listing_retour_prix
  after update of price, current_price on public.market_listings
  for each row
  when (coalesce(NEW.current_price, NEW.price) > 0
        and (coalesce(OLD.current_price, OLD.price) is null
             or coalesce(OLD.current_price, OLD.price) <= 0
             or coalesce(NEW.current_price, NEW.price) < coalesce(OLD.current_price, OLD.price)))
  execute function public.match_retour_prix_annonce();

-- ── 10. Le prix d'un mandat change : le moteur le renote, sans effacer l'historique ──
-- Corps EN SERVICE (trigger `on_property_price_change`, inchangé), plus deux gardes — pas celui de la
-- baseline, qui n'a pas l'épingle de région de 20260914080000.
create or replace function public.trigger_matching_on_price_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  base_url text;
  svc_key text;
begin
  if NEW.status = 'active' and NEW.price is distinct from OLD.price then
    base_url := public.get_app_config('supabase_url');
    svc_key := public.get_app_config('service_role_key');
    -- Sans configuration, ni suppression ni appel : on ne supprime pas ce que personne ne recréera, et un
    -- `net.http_post` sans adresse lève (NOT NULL de `http_request_queue.url`), ce qui faisait échouer la
    -- mise à jour du prix elle-même.
    if base_url is null or base_url = '' or svc_key is null or svc_key = '' then
      return NEW;
    end if;
    -- Les matchs à proposer JAMAIS proposés seulement : le moteur les recrée au nouveau prix. Un bien refusé
    -- pour le prix et revenu par une baisse est `suggested` AVEC son historique (motif, prix proposé), que le
    -- moteur ne recréerait pas.
    delete from public.matches m
     where m.property_id = NEW.id
       and m.status = 'suggested'
       and m.sent_at is null;
    perform net.http_post(
      url := base_url || '/functions/v1/matching-engine?forceFunctionRegion=eu-west-1',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || svc_key),
      body := jsonb_build_object('mode', 'match-property', 'property_id', NEW.id, 'agency_id', NEW.agency_id)
    );
  end if;
  return NEW;
end;
$function$;

revoke all on function public.trigger_matching_on_price_change() from public, anon, authenticated;

drop trigger if exists trg_property_retour_prix on public.properties;
create trigger trg_property_retour_prix
  after update of price on public.properties
  for each row
  when (NEW.price > 0 and (OLD.price is null or OLD.price <= 0 or NEW.price < OLD.price))
  execute function public.match_retour_prix_mandat();

-- ── 1 à 4. Les colonnes et le vocabulaire ────────────────────────────────────
alter table public.matches add column if not exists prix_propose numeric;
alter table public.matches add column if not exists apprentissage_at timestamptz;

comment on column public.matches.prix_propose is
  'Prix du bien (COALESCE(current_price, price) d''une annonce, price d''un mandat) quand l''agent l''a proposé ; nul pour un prix nul (« prix sur demande »). Posé par trg_match_prix_propose au passage à sent. Sert le signal « prix baissé de … » et le retour d''un bien refusé pour le prix.';
comment on column public.matches.apprentissage_at is
  'Ce refus a nourri une correction de recherche (« Apprendre », lot B), validée ou ignorée : il ne compte plus.';

alter table public.matches drop constraint if exists matches_reaction_motif_check;
alter table public.matches add constraint matches_reaction_motif_check
  check (reaction_motif is null or reaction_motif = any (array[
    'prix', 'quartier', 'surface', 'pieces', 'type', 'equipements', 'etat', 'autre', 'recherche_ajustee'
  ])) not valid;

alter table public.reminders add column if not exists match_ids uuid[];

comment on column public.reminders.match_ids is
  'Relance d''une proposition de PLUSIEURS biens (follow_up_sent_property) : tous les biens qu''elle couvre ; match_id n''en porte que le meilleur. Nulle pour un seul bien : match_id le couvre. Close par trg_match_fermer_relance quand plus aucun n''est sent.';

-- ── 5. L'index de la boucle ──────────────────────────────────────────────────
-- ⚠ Même liste de statuts que la lecture du fil (`useMatchingFil`) : un `in` identique à celui du
-- prédicat partiel le laisse s'appliquer.
create index if not exists idx_matches_boucle on public.matches (agency_id, status)
  where status in ('sent', 'interested', 'rejected', 'visit_planned');

-- ── 1 (trigger). Le prix proposé, et la réponse d'avant effacée ──────────────
create or replace function public.set_match_prix_propose()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if NEW.status = 'sent' and OLD.status is distinct from 'sent' then
    -- `nullif(…, 0)` : un bien « prix sur demande » n'a pas été proposé à CHF 0.
    if NEW.market_listing_id is not null then
      NEW.prix_propose := (select nullif(coalesce(ml.current_price, ml.price), 0) from public.market_listings ml where ml.id = NEW.market_listing_id);
    elsif NEW.property_id is not null then
      NEW.prix_propose := (select nullif(p.price, 0) from public.properties p where p.id = NEW.property_id);
    end if;
    NEW.reaction_motif := null;
    NEW.reaction_note := null;
    NEW.apprentissage_at := null;
    -- `set_match_response_at` ne date qu'une réponse SANS date : gardée, celle du refus d'avant passerait
    -- pour la réponse à la nouvelle proposition (« À conclure » la trie dessus).
    NEW.response_at := null;
  end if;
  return NEW;
end;
$function$;

revoke all on function public.set_match_prix_propose() from public, anon, authenticated;

drop trigger if exists trg_match_prix_propose on public.matches;
create trigger trg_match_prix_propose
  before update of status on public.matches
  for each row
  execute function public.set_match_prix_propose();

-- ── 6. La relance d'une proposition, close quand plus aucun de ses biens n'attend ──
create or replace function public.fermer_relance_proposition()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- 1. Les relances ouvertes qui couvrent ce bien, VERROUILLÉES (dans l'ordre des ids : deux réponses qui en
  --    partagent plusieurs ne s'interbloquent pas). Sous READ COMMITTED, deux réponses simultanées aux deux
  --    derniers biens d'une proposition voyaient chacune l'autre encore `sent`, et la relance restait
  --    ouverte sans plus rien couvrir. La seconde attend ici que la première ait validé.
  perform 1
     from public.reminders r
    where r.contact_id = NEW.contact_id
      and r.agency_id = NEW.agency_id
      and r.type = 'follow_up_sent_property'
      and r.status in ('pending', 'triggered', 'snoozed')
      and NEW.id = any (coalesce(r.match_ids, array[r.match_id]))
    order by r.id
    for update;
  -- 2. Relues dans une AUTRE instruction : c'est elle qui prend un instantané postérieur au verrou, donc
  --    qui voit la réponse que l'autre transaction vient de valider.
  update public.reminders r
     set status = 'done', completed_at = now()
   where r.contact_id = NEW.contact_id
     and r.agency_id = NEW.agency_id
     and r.type = 'follow_up_sent_property'
     and r.status in ('pending', 'triggered', 'snoozed')
     and NEW.id = any (coalesce(r.match_ids, array[r.match_id]))
     and not exists (
       select 1 from public.matches m
        where m.id = any (coalesce(r.match_ids, array[r.match_id]))
          and m.status = 'sent'
     );
  return null;
end;
$function$;

revoke all on function public.fermer_relance_proposition() from public, anon, authenticated;

drop trigger if exists trg_match_fermer_relance on public.matches;
create trigger trg_match_fermer_relance
  after update of status on public.matches
  for each row
  when (OLD.status = 'sent' and NEW.status is distinct from 'sent')
  execute function public.fermer_relance_proposition();

-- ── 7. Le journal d'une réponse porte son motif ──────────────────────────────
-- Corps de 20260617120000, À L'IDENTIQUE, plus la clé `motif`.
create or replace function public.log_match_reaction()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_guc_kind text := nullif(current_setting('app.actor_kind', true), '');
  v_via      text := nullif(current_setting('app.actor_via', true), '');
  v_profile  text := nullif(current_setting('app.actor_profile_id', true), '');
  v_uid      uuid := auth.uid();
  v_kind     text;
  v_actor    uuid;
  v_meta     jsonb;
begin
  v_kind := case
    when v_guc_kind in ('ai', 'system', 'user') then v_guc_kind
    when v_uid is null then 'system'
    else 'user'
  end;
  v_actor := case when v_kind = 'user' then v_uid else null end;

  v_meta := jsonb_build_object(
    'match_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status, 'contact_id', NEW.contact_id);
  if v_via is not null then v_meta := v_meta || jsonb_build_object('via', v_via); end if;
  if v_profile is not null then v_meta := v_meta || jsonb_build_object('profile_id', v_profile); end if;
  if NEW.reaction_motif is not null then v_meta := v_meta || jsonb_build_object('motif', NEW.reaction_motif); end if;

  insert into activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label, category, severity, metadata)
  values
    (NEW.agency_id, v_actor, v_kind, 'match_reaction', 'contact', NEW.contact_id,
     OLD.status::text || ' → ' || NEW.status::text, 'deal', 'info', v_meta);
  return NEW;
end;
$function$;

revoke all on function public.log_match_reaction() from public, anon, authenticated;

-- ── 11. La purge nocturne des annonces retirées, sans effacer l'historique ───
-- Corps de 20260717232500, plus `sent_at is null` : un bien revenu par une baisse est `suggested` avec son
-- motif et son prix proposé ; retiré du marché, il reste lu (le fil écarte déjà une annonce `removed`).
create or replace function public.purge_stale_market_matches()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_deleted integer;
begin
  with del as (
    delete from public.matches m
     using public.market_listings ml
     where ml.id = m.market_listing_id
       and m.status = 'suggested'      -- à proposer…
       and m.sent_at is null           -- …et jamais proposé : pas d'historique, pas de relance
       and ml.status = 'removed'       -- annonce disparue du marché
    returning m.id
  )
  select count(*) into v_deleted from del;
  return v_deleted;
end;
$function$;

comment on function public.purge_stale_market_matches() is
  'Supprime les matchs SUGGESTED JAMAIS PROPOSÉS (sent_at nul) dont la market_listing est removed. Self-healing via daily_matching_scan. Cron purge-stale-matches 04:50. Ne touche jamais un match proposé ou revenu par une baisse (lot B, 20260930140000). Voir 20260717232500.';

revoke execute on function public.purge_stale_market_matches() from public, anon, authenticated;
grant execute on function public.purge_stale_market_matches() to service_role;

-- ── 9. Les notes d'une recherche renotée ─────────────────────────────────────
-- SECURITY INVOKER, appelée par l'edge en service_role (RLS contournée) : le cloisonnement vient des
-- filtres EXPLICITES — l'agence tirée du JWT de l'agent, la recherche visée, et un match encore à proposer
-- (`suggested`) ou écarté par le moteur (`ignored` ET `recherche_ajustee`) : un match proposé, répondu, ou
-- écarté par l'agent entre-temps n'est jamais réécrit.
-- L'écart du moteur se défait, celui de l'agent jamais (décision de Julien, 29.09.2026) : les critères
-- changent aussi sans l'agent (extraction WhatsApp, `qualify_lead`, import), et le moteur ne recrée jamais une
-- paire existante — sans retour, une fiche changée par erreur puis rétablie perdrait ses biens pour toujours.
-- « Écarter » écrit `ignored` et efface le motif (`execDismiss`), « Pas intéressé » écrit `rejected` : aucun
-- n'entre dans le `where`.
-- Dans `set`, `m.status` et `m.reaction_motif` sont ceux d'AVANT l'écriture ; la seule ligne `ignored` que le
-- `where` laisse passer est un écart du moteur.
create or replace function public.matching_appliquer_notes(p_agency_id uuid, p_client_search_id uuid, p_notes jsonb)
returns table (id uuid, status text)
language sql
security invoker
set search_path to 'public', 'pg_temp'
as $$
  update public.matches m
     set score          = (n->>'score')::int,
         reasons        = coalesce(n->'reasons', '{}'::jsonb),
         score_version  = nullif(n->>'score_version', '')::int,
         status         = case when (n->>'ecarte')::boolean then 'ignored'
                               when m.status = 'ignored' then 'suggested'
                               else m.status end,
         reaction_motif = case when (n->>'ecarte')::boolean then 'recherche_ajustee'
                               when m.status = 'ignored' then null
                               else m.reaction_motif end
    from jsonb_array_elements(p_notes) as n
   where m.id = (n->>'id')::uuid
     and m.agency_id = p_agency_id
     and m.client_search_id = p_client_search_id
     and (m.status = 'suggested' or (m.status = 'ignored' and m.reaction_motif = 'recherche_ajustee'))
  returning m.id, m.status;
$$;

comment on function public.matching_appliquer_notes(uuid, uuid, jsonb) is
  'Notes d''une recherche renotée (edge matching-engine : rescore-search, match-contact, scan-all). Réécrit un match suggested, ou écarté par le moteur (ignored + recherche_ajustee) — jamais un écart de l''agent. Sous le seuil : ignored, motif recherche_ajustee ; un écarté retenu à nouveau revient à suggested, motif effacé.';

revoke all on function public.matching_appliquer_notes(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.matching_appliquer_notes(uuid, uuid, jsonb) to service_role;

-- ── 12. La correction d'une recherche, écrite d'un bloc ──────────────────────
-- Appelée par l'edge APRÈS les notes (`matching_appliquer_notes`) : une panne entre les deux laisse la
-- correction à l'écran, et la même validation renote puis écrit tout. SECURITY INVOKER, service_role seul,
-- cloisonnée par l'agence tirée du JWT (mêmes filtres explicites que ci-dessus). `p_cle` nul : aucune
-- correction, seulement les refus pris en compte et `matchs_reevalues` au journal. `p_bilan` : ce que la
-- renotation a produit (réévalués, écartés, revenus), recopié au journal. Rend `{ apres }`, ou NULL si la recherche
-- n'est pas de cette agence.
create or replace function public.matching_ajuster_recherche(
  p_agency_id uuid,
  p_client_search_id uuid,
  p_acteur_id uuid,
  p_cle text,
  p_valeur jsonb,
  p_motif text,
  p_refus_ids uuid[],
  p_bilan jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_contact uuid;
  v_avant   jsonb;
  v_apres   jsonb;
begin
  -- Les seules clés que la fiche sait écrire, chacune dans sa forme (le pont `sync_contact_client_search`
  -- effacerait une clé qu'elle ignore). `case` et non `and` : l'ordre d'évaluation n'est garanti qu'ainsi, et
  -- une chaîne ne doit jamais atteindre le cast numérique. `coalesce(…, false)` : une valeur NULL rend le test
  -- NULL, que `if` ne prend pas — la clé partait alors à `null` dans les critères.
  if p_cle is not null and not coalesce(case
       when p_cle in ('budget_max', 'surface_min', 'rooms_min') then
         case when jsonb_typeof(p_valeur) = 'number' then (p_valeur #>> '{}')::numeric > 0 end
       when p_cle = 'type' then
         case when jsonb_typeof(p_valeur) = 'string' then btrim(p_valeur #>> '{}') <> '' end
       when p_cle in ('zones', 'features') then
         case when jsonb_typeof(p_valeur) = 'array' then jsonb_array_length(p_valeur) > 0 end
     end, false) then
    raise exception 'matching_ajuster_recherche : correction illisible (%)', p_cle using errcode = '22023';
  end if;

  -- Verrouillée : deux validations simultanées fusionnent chacune SA clé dans les critères de l'autre.
  select cs.contact_id, cs.criteria into v_contact, v_avant
    from public.client_searches cs
   where cs.id = p_client_search_id and cs.agency_id = p_agency_id
     for update;
  if not found then
    return null;
  end if;

  v_apres := case when p_cle is null then v_avant
                  else coalesce(v_avant, '{}'::jsonb) || jsonb_build_object(p_cle, p_valeur) end;

  if p_cle is not null then
    update public.client_searches set criteria = v_apres where id = p_client_search_id;
    -- La fiche, seulement si elle portait EXACTEMENT les critères d'avant (égalité jsonb : l'ordre des clés
    -- ne compte pas, celui des listes si) — sinon elle en sait plus, ou autre chose. Sans elle, le pont
    -- `sync_contact_client_search` remettrait l'ancienne recherche au prochain enregistrement de la fiche.
    update public.contacts c set search_criteria = v_apres
     where c.id = v_contact and c.agency_id = p_agency_id
       and c.search_criteria is not distinct from v_avant;
  end if;

  update public.matches m set apprentissage_at = now()
   where m.id = any (coalesce(p_refus_ids, '{}'::uuid[]))
     and m.agency_id = p_agency_id
     and m.client_search_id = p_client_search_id
     and m.status = 'rejected';

  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label, category, severity, metadata)
  values
    (p_agency_id, p_acteur_id, case when p_acteur_id is null then 'system' else 'user' end,
     case when p_cle is null then 'matchs_reevalues' else 'recherche_ajustee' end,
     'contact', v_contact, null, 'contact', 'info',
     jsonb_build_object(
       'client_search_id', p_client_search_id, 'motif', p_motif, 'cle', p_cle, 'avant', v_avant, 'apres', v_apres,
       'refus_ids', to_jsonb(coalesce(p_refus_ids, '{}'::uuid[]))
     ) || coalesce(p_bilan, '{}'::jsonb));

  return jsonb_build_object('apres', v_apres);
end;
$function$;

comment on function public.matching_ajuster_recherche(uuid, uuid, uuid, text, jsonb, text, uuid[], jsonb) is
  'Lot B « Apprendre » : la correction validée, d''un bloc — la seule clé corrigée fusionnée dans les critères, la fiche si identique, les refus pris en compte, recherche_ajustee au journal. Edge matching-engine (rescore-search), service_role seul.';

revoke all on function public.matching_ajuster_recherche(uuid, uuid, uuid, text, jsonb, text, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.matching_ajuster_recherche(uuid, uuid, uuid, text, jsonb, text, uuid[], jsonb) to service_role;

commit;
