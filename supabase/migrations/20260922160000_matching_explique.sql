-- ══════════════════════════════════════════════════════════════════════════════
-- Matching · lot C : un matching qui explique et qui s'inverse (22.09.2026)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4.1, §4.2 et §13.
-- Plan : docs/superpowers/plans/2026-09-22-matching-lot-c-explique-inverse.md.
--
-- ⚠ REJOUABLE : le date-guard de deploy.yml rejoue chaque migration du jour à chaque push.
-- ⛔ AUCUNE FONCTION D'UNE MIGRATION ANTÉRIEURE DU MÊME JOUR N'Y CHANGE DE TYPE DE RETOUR : le rejeu de
--    `…_matching_fil_marche.sql` (lot 2) recréerait `matching_fil_marche()` par CREATE OR REPLACE, et
--    échouerait sur `cannot change return type` si on l'avait élargie ici. D'où une RPC NEUVE (4), et
--    l'ancienne retirée APRÈS elle dans l'ordre des fichiers : son rejeu la recrée, celui-ci la retire.

begin;

-- L'ALTER de `properties` prend un verrou exclusif à CHAQUE rejeu du jour : échouer vite (précédent 20260921140000).
set local lock_timeout = '5s';

-- ── 1. L'off-market d'un mandat : un interrupteur de l'agent (décision de Julien, 22.09.2026) ──
-- Aucune donnée ne le disait : tout mandat actif porte `published_at` (posé à sa mise en service), et la
-- diffusion vers les portails n'est pas en service. Le moteur le note pour un acheteur qui le demande
-- (`off_market_only`) ; une annonce du marché est publique par définition.
alter table public.properties add column if not exists off_market boolean not null default false;

comment on column public.properties.off_market is
  'Mandat off-market : proposé aux seuls acheteurs de l''agence, jamais diffusé. Posé par l''agent (fiche du bien, « Nouveau bien »). Noté par matching-engine pour une recherche `off_market_only` (lot C).';

-- ── 2. Un mandat qui passe off-market, ou redevient public : le moteur le renote ──
-- Même mécanique que `trigger_matching_on_price_change` (lot B) : les matchs à proposer JAMAIS proposés sont
-- supprimés et le moteur les recrée au nouvel état ; un match qui a une histoire (`sent_at`) reste. ⚠ Et ceux-là
-- seulement d'une recherche qui DEMANDE l'off-market (`off_market_only`) : pour les autres acheteurs l'axe est
-- inactif et leur note ne bouge pas ; les supprimer perdrait leur report (`snoozed_until`) et leur date de
-- création, et réécrirait un `match_suggested` au journal pour chacun.
-- ⚠ `OLD.status = 'active'` : un brouillon publié off-market d'une seule écriture passe déjà par
-- `on_property_active`, qui lance le moteur ; déclencher les deux le ferait tourner deux fois.
create or replace function public.trigger_matching_on_off_market_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  base_url text;
  svc_key text;
begin
  base_url := public.get_app_config('supabase_url');
  svc_key := public.get_app_config('service_role_key');
  -- Sans configuration, ni suppression ni appel : on ne supprime pas ce que personne ne recréera.
  if base_url is null or base_url = '' or svc_key is null or svc_key = '' then
    return NEW;
  end if;
  delete from public.matches m
   where m.property_id = NEW.id
     and m.status = 'suggested'
     and m.sent_at is null
     and exists (
       select 1 from public.client_searches cs
        where cs.id = m.client_search_id
          and cs.criteria->>'off_market_only' = 'true'
     );
  perform net.http_post(
    url := base_url || '/functions/v1/matching-engine',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || svc_key),
    body := jsonb_build_object('mode', 'match-property', 'property_id', NEW.id, 'agency_id', NEW.agency_id)
  );
  return NEW;
end;
$function$;

revoke all on function public.trigger_matching_on_off_market_change() from public, anon, authenticated;

drop trigger if exists trg_property_off_market on public.properties;
create trigger trg_property_off_market
  after update of off_market on public.properties
  for each row
  when (OLD.status = 'active' and NEW.status = 'active' and NEW.off_market is distinct from OLD.off_market)
  execute function public.trigger_matching_on_off_market_change();

-- ── 3. Le pré-filtre du moteur rend aussi les chambres et les années (état) ──
-- Corps et WHERE identiques à 20260709140000 ; trois colonnes de plus. DROP requis : un RETURNS TABLE ne change
-- pas par CREATE OR REPLACE. Deux consommateurs, le moteur et les statistiques de vente du copilote (l'écran
-- Recherche lit `search_market_listings` depuis 20260720150000) : une colonne de plus ne casse ni l'un ni l'autre.
drop function if exists public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text);

create function public.match_candidate_listings(
  p_tx text,
  p_budget_min numeric default null,
  p_budget_max numeric default null,
  p_margin numeric default 0.15,
  p_cantons text[] default null,
  p_types text[] default null,
  p_min_quality integer default 50,
  p_limit integer default 400,
  p_city text default null
)
returns table(
  id uuid,
  price numeric,
  current_price numeric,
  type text,
  canton text,
  city text,
  rooms numeric,
  surface_m2 numeric,
  features jsonb,
  lat double precision,
  lng double precision,
  transaction_type text,
  status text,
  price_at_first_seen numeric,
  bedrooms integer,
  year_built integer,
  year_renovated integer
)
language sql
stable security definer
set search_path to 'public'
set statement_timeout to '15s'
as $$
  select ml.id, ml.price, ml.current_price, ml.type, ml.canton, ml.city,
         ml.rooms, ml.surface_m2, ml.features, ml.lat, ml.lng, ml.transaction_type,
         ml.status, ml.price_at_first_seen, ml.bedrooms, ml.year_built, ml.year_renovated
  from public.market_listings ml
  where ml.status in ('active', 'price_reduced')
    and ml.transaction_type = p_tx
    and ml.quality_score >= p_min_quality
    and coalesce(ml.current_price, ml.price) > 0
    and (p_budget_max is null or coalesce(ml.current_price, ml.price) <= p_budget_max * (1 + p_margin))
    and (p_budget_min is null or coalesce(ml.current_price, ml.price) >= p_budget_min * (1 - p_margin))
    and (p_cantons is null or ml.canton = any (p_cantons))
    and (p_types is null or ml.type = any (p_types))
    and (p_city is null or public.unaccent(lower(ml.city)) = public.unaccent(lower(p_city)))
  order by ml.quality_score desc nulls last, coalesce(ml.current_price, ml.price) asc
  limit greatest(coalesce(p_limit, 400), 1);
$$;

revoke all on function public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text) from public, anon;
grant execute on function public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text) to authenticated, service_role;

-- ── 4. Le résumé « Marché » du fil compte aussi les annonces NOUVELLES et EN BAISSE ──
-- Mêmes lignes, même ordre et mêmes vignettes que `matching_fil_marche()` (lot 2) ; deux comptes de plus, aux
-- seuils de `src/components/matching-fil/filSignaux.ts` (JOURS_NOUVEAU, JOURS_BAISSE), confrontés par
-- `matching-fil-signaux.spec.ts`. Une annonce en baisse ne compte pas aussi comme nouvelle : le fil ne lui
-- montre qu'un signal, la baisse d'abord. Une date FUTURE est une saisie fautive, jamais un signal (`recente()`
-- de `filSignaux.ts` l'écarte aussi) : sans la borne, elle resterait « nouvelle » ou « en baisse » jusqu'à ce
-- qu'elle soit passée.
create or replace function public.matching_fil_marche_resume()
returns table (
  contact_id uuid,
  nombre integer,
  meilleur_score integer,
  vignettes text[],
  nouveaux integer,
  baisses integer
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  with retenus as (
    select m.contact_id,
           m.score,
           coalesce(
             nullif(case when jsonb_typeof(ml.photos_cf -> 0) = 'string' then ml.photos_cf ->> 0 end, ''),
             nullif(ml.photos_cf -> 0 ->> 'thumb', ''),
             nullif(ml.photos[1], '')
           ) as vignette,
           coalesce(ml.price_reduced_at > now() - interval '14 days'
             and ml.price_reduced_at <= now()
             and ml.price_at_first_seen > coalesce(ml.current_price, ml.price)
             and coalesce(ml.current_price, ml.price) > 0, false) as en_baisse,
           coalesce(ml.first_seen_at > now() - interval '3 days'
             and ml.first_seen_at <= now(), false) as nouveau,
           row_number() over (
             partition by m.contact_id order by m.score desc, m.created_at desc nulls last, m.id
           ) as rang
      from public.matches m
      join public.market_listings ml on ml.id = m.market_listing_id
     where m.agency_id = public.get_user_agency_id()
       and m.status = 'suggested'
       and m.market_listing_id is not null
       and (m.snoozed_until is null or m.snoozed_until <= now())
       and ml.status is distinct from 'removed'
  )
  select r.contact_id,
         count(*)::integer,
         max(r.score)::integer,
         coalesce((array_agg(r.vignette order by r.rang) filter (where r.vignette is not null))[1:3], '{}'::text[]),
         (count(*) filter (where r.nouveau and not r.en_baisse))::integer,
         (count(*) filter (where r.en_baisse))::integer
    from retenus r
   group by r.contact_id
   order by max(r.score) desc, count(*) desc;
$$;

comment on function public.matching_fil_marche_resume() is
  'Fil de matchs (lots 2 et C) : une ligne « Marché » par acheteur — nombre de matchs du marché à traiter, meilleur score, trois vignettes, annonces nouvelles (3 jours) et en baisse (14 jours).';

revoke all on function public.matching_fil_marche_resume() from public, anon;
grant execute on function public.matching_fil_marche_resume() to authenticated;

-- L'ancienne, sans lecteur depuis ce lot. Son rejeu du jour la recrée AVANT ce fichier ; celui-ci la retire.
drop function if exists public.matching_fil_marche();

-- ── 5. Réactiver un ancien prospect, d'un bloc (« Qui pour ce bien ? ») ──
-- Appelée par l'edge `matching-engine` (mode `reactiver-prospect`) APRÈS la note, que seul le TypeScript calcule.
-- Écrits un à un par l'edge, le match, la réouverture de la recherche et la ligne au journal laissaient, sur une
-- panne au milieu, un match né d'une recherche restée close, ou sans journal (précédent : lot B,
-- `matching_ajuster_recherche`). Service_role seul : le cloisonnement vient des filtres EXPLICITES sur l'agence
-- tirée du JWT de l'agent. ⚠ La recherche ET son contact doivent en être : la RLS de `client_searches` ne lit que
-- son `agency_id`, une recherche peut donc désigner le contact d'une autre agence — le match naîtrait sur lui.
-- Rend l'id du match ; NULL, sans rien écrire, si la recherche ou son contact n'est pas de l'agence, ou si
-- l'acheteur a déjà un match sur ce bien (`ON CONFLICT`).
-- ⚠ Rouvrir la recherche ne relance pas le moteur (`on_search_criteria_updated` ne part que sur un changement de
-- critères) : ses autres biens viennent au scan de la nuit.
create or replace function public.matching_reactiver_prospect(
  p_agency_id uuid,
  p_acteur_id uuid,
  p_client_search_id uuid,
  p_property_id uuid,
  p_market_listing_id uuid,
  p_score integer,
  p_reasons jsonb,
  p_score_version integer,
  p_origine text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_contact uuid;
  v_match   uuid;
begin
  if (p_property_id is null) = (p_market_listing_id is null) then
    raise exception 'matching_reactiver_prospect : un mandat OU une annonce, jamais les deux' using errcode = '22023';
  end if;

  select cs.contact_id into v_contact
    from public.client_searches cs
    join public.contacts c on c.id = cs.contact_id
   where cs.id = p_client_search_id
     and cs.agency_id = p_agency_id
     and c.agency_id = p_agency_id;
  if v_contact is null then
    return null;
  end if;

  -- Le même index unique partiel que les RPC d'insertion du moteur (`insert_*_matches`) : le prédicat est
  -- obligatoire dans la cible du conflit.
  if p_property_id is not null then
    insert into public.matches
      (agency_id, contact_id, property_id, client_search_id, score, reasons, status, source, score_version)
    values
      (p_agency_id, v_contact, p_property_id, p_client_search_id, p_score, coalesce(p_reasons, '{}'::jsonb),
       'suggested', 'internal', p_score_version)
    on conflict (contact_id, property_id) where property_id is not null do nothing
    returning id into v_match;
  else
    insert into public.matches
      (agency_id, contact_id, market_listing_id, client_search_id, score, reasons, status, source, score_version)
    values
      (p_agency_id, v_contact, p_market_listing_id, p_client_search_id, p_score, coalesce(p_reasons, '{}'::jsonb),
       'suggested', 'market', p_score_version)
    on conflict (contact_id, market_listing_id) where market_listing_id is not null do nothing
    returning id into v_match;
  end if;
  if v_match is null then
    return null;
  end if;

  update public.client_searches
     set is_active = true, updated_at = now()
   where id = p_client_search_id and agency_id = p_agency_id;

  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label, category, severity, metadata)
  values
    (p_agency_id, p_acteur_id, 'user', 'prospect_reactive', 'contact', v_contact, null, 'contact', 'info',
     jsonb_build_object(
       'client_search_id', p_client_search_id, 'property_id', p_property_id, 'market_listing_id', p_market_listing_id,
       'match_id', v_match, 'score', p_score, 'score_version', p_score_version, 'origine', p_origine
     ));

  return v_match;
end;
$function$;

comment on function public.matching_reactiver_prospect(uuid, uuid, uuid, uuid, uuid, integer, jsonb, integer, text) is
  'Lot C « Qui pour ce bien ? » : un ancien prospect réactivé, d''un bloc — le match suggested noté par le moteur, la recherche rouverte, prospect_reactive au journal. NULL si la recherche ou son contact n''est pas de l''agence, ou si le match existe déjà. Edge matching-engine (reactiver-prospect), service_role seul.';

revoke all on function public.matching_reactiver_prospect(uuid, uuid, uuid, uuid, uuid, integer, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.matching_reactiver_prospect(uuid, uuid, uuid, uuid, uuid, integer, jsonb, integer, text) to service_role;

commit;
