-- Activation des agences (calcul + cron) et historique des crons — étapes 8 et 12.
-- Spec §4.2, §5.1, §5.3, §5.8, §7.
--
-- ÉTAPE 8. La table `agency_activation` a été posée à l'étape 5 ; ici on la remplit. Le
-- calcul absorbe `get_onboarding_milestones()` au lieu de la doubler : mêmes sources, mais
-- rendues en TIMESTAMPS (la maquette affiche « il y a 5 h », pas un booléen) et complétées
-- du jalon `signed_up`, du score et du statut, que la RPC ne porte pas.
--
-- ÉTAPE 12. §4.2 annonce une table `cron_runs`. Elle n'est pas créée : `cron.job_run_details`
-- porte déjà plus de 200 000 lignes depuis mars, sans purge. Ce qui manquait n'était pas un
-- stockage mais un CHEMIN DE LECTURE — le schéma `cron` n'est pas exposé à PostgREST, et
-- `get_cron_health()` ne rend que le DERNIER run de chaque job. D'où une RPC d'historique,
-- et rien de plus.
--
-- ⚠ POURQUOI CETTE MIGRATION N'ACCORDE PAS `recompute_agency_activation` À `authenticated` :
-- c'est une fonction de cron, sa garde doit admettre `session_user = postgres` (pg_cron
-- n'a pas de JWT). Or le balayage de gardes du Lot 0 doit écarter les fonctions portant
-- cette branche, et son seuil interdit que cet ensemble s'élargisse. En la réservant à
-- `service_role`, elle sort du balayage sans en consommer le budget — et la console n'a
-- de toute façon aucune raison de la déclencher.

-- ── 1. Calcul de l'activation (étape 8) ──────────────────────────────────────────────

drop function if exists public.recompute_agency_activation(uuid);
create or replace function public.recompute_agency_activation(p_agency_id uuid default null)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_rows integer := 0;
begin
  if not (public.is_super_admin() or public.is_service_role()
          or session_user in ('postgres', 'supabase_admin')) then
    raise exception 'forbidden: super_admin or service only' using errcode = '42501';
  end if;

  with cible as (
    select a.id, a.created_at
      from public.agencies a
     where p_agency_id is null or a.id = p_agency_id
  ),
  jalons as (
    select c.id as agency_id,
           c.created_at as signed_up_at,
           (select min(x.created_at) from public.contacts     x where x.agency_id = c.id) as first_contact_at,
           (select min(x.created_at) from public.properties   x where x.agency_id = c.id) as first_property_at,
           (select min(x.created_at) from public.kyc_cases    x where x.agency_id = c.id) as first_kyc_at,
           (select min(x.created_at) from public.transactions x where x.agency_id = c.id) as first_deal_at,
           (select min(x.created_at) from public.matches      x where x.agency_id = c.id) as first_match_at,
           (select max(x.created_at) from public.activity_events x where x.agency_id = c.id) as last_activity_at
      from cible c
  ),
  calcul as (
    select j.*,
           -- Score : six jalons de poids égal. Formule volontairement plate et lisible —
           -- une pondération fine se justifierait par des données d'usage qu'on n'a pas
           -- encore (9 agences en production). §7 ne fixe aucun barème ; celui-ci est donc
           -- un point de départ documenté, pas une vérité.
           (case when j.signed_up_at      is not null then 1 else 0 end
          + case when j.first_contact_at  is not null then 1 else 0 end
          + case when j.first_property_at is not null then 1 else 0 end
          + case when j.first_kyc_at      is not null then 1 else 0 end
          + case when j.first_deal_at     is not null then 1 else 0 end
          + case when j.first_match_at    is not null then 1 else 0 end) as jalons_faits
      from jalons j
  )
  insert into public.agency_activation as t (
    agency_id, signed_up_at, first_contact_at, first_property_at,
    first_kyc_at, first_deal_at, first_match_at,
    score, status, last_activity_at, computed_at
  )
  select k.agency_id, k.signed_up_at, k.first_contact_at, k.first_property_at,
         k.first_kyc_at, k.first_deal_at, k.first_match_at,
         round(100.0 * k.jalons_faits / 6)::smallint,
         -- §7 : dormant au-delà de 30 jours sans activité. « atRisk » couvre l'entre-deux,
         -- pour que l'écran distingue une agence qui ralentit d'une agence partie.
         case
           when k.last_activity_at is null then 'dormant'
           when k.last_activity_at >= now() - interval '7 days'  then 'active'
           when k.last_activity_at >= now() - interval '30 days' then 'atRisk'
           else 'dormant'
         end,
         k.last_activity_at,
         now()
    from calcul k
  on conflict (agency_id) do update set
    signed_up_at      = excluded.signed_up_at,
    first_contact_at  = excluded.first_contact_at,
    first_property_at = excluded.first_property_at,
    first_kyc_at      = excluded.first_kyc_at,
    first_deal_at     = excluded.first_deal_at,
    first_match_at    = excluded.first_match_at,
    score             = excluded.score,
    status            = excluded.status,
    last_activity_at  = excluded.last_activity_at,
    computed_at       = excluded.computed_at;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

comment on function public.recompute_agency_activation(uuid) is
  'Remplit agency_activation depuis les sources métier. Absorbe get_onboarding_milestones() '
  '(mêmes sources) en rendant des TIMESTAMPS au lieu de booléens, plus le score et le statut. '
  'Réservée à service_role et au cron : la console LIT la table, elle ne déclenche pas le '
  'calcul. Sans argument, recalcule toutes les agences — c''est le mode du cron et du '
  'backfill.';

revoke all on function public.recompute_agency_activation(uuid) from public, anon, authenticated;
grant execute on function public.recompute_agency_activation(uuid) to service_role;

-- Backfill : la table est vide, et neuf agences en production. Le coût est nul aujourd'hui ;
-- il ne le sera plus, d'où le paramètre par agence pour un recalcul ciblé.
do $$
begin
  perform public.recompute_agency_activation();
end $$;

do $$
begin
  perform cron.unschedule('agency-activation-nightly');
exception when others then null;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'agency-activation-nightly',
      '20 2 * * *',
      $cron$ select public.recompute_agency_activation(); $cron$
    );
  end if;
end $$;

-- ── 2. Historique des crons (étape 12) ───────────────────────────────────────────────

drop function if exists public.get_admin_cron_runs(text, integer);
create or replace function public.get_admin_cron_runs(
  p_jobname text default null,
  p_limit   integer default 50
)
returns table (
  jobname    text,
  schedule   text,
  active     boolean,
  start_time timestamptz,
  end_time   timestamptz,
  status     text,
  duration_s numeric,
  message    text
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  -- En base fraîche (CI) le schéma `cron` existe parfois SANS la table job_run_details :
  -- la garde porte donc sur l'extension, pas sur le schéma, et le corps est dynamique pour
  -- que la fonction se CRÉE même là où la table n'existe pas.
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;

  return query execute format($q$
    select j.jobname::text, j.schedule::text, j.active,
           d.start_time, d.end_time, d.status::text,
           round(extract(epoch from (d.end_time - d.start_time))::numeric, 2),
           d.return_message::text
      from cron.job_run_details d
      join cron.job j using (jobid)
     where ($1 is null or j.jobname = $1)
     order by d.start_time desc
     limit %s
  $q$, v_limit) using p_jobname;
end;
$function$;

comment on function public.get_admin_cron_runs(text, integer) is
  'Historique d''exécution des crons (§5.8). Aucune table `cron_runs` n''est créée : '
  'cron.job_run_details porte déjà plus de 200 000 lignes depuis mars, sans purge — ce qui '
  'manquait était un chemin de lecture, le schéma `cron` n''étant pas exposé à PostgREST, et '
  'get_cron_health() ne rendant que le DERNIER run. Un job s''identifie par son jobname, '
  'jamais par son jobid, qui change à chaque recréation.';

revoke all on function public.get_admin_cron_runs(text, integer) from public, anon;
grant execute on function public.get_admin_cron_runs(text, integer) to authenticated, service_role;
