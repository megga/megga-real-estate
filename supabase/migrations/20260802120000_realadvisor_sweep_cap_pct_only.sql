-- RealAdvisor — le cap absolu du sweep (1200) est retiré : le 3 % du live gouverne seul.
--
-- Constat (02/08/2026) : depuis que le vivier dépasse ~40 000, le plafond effectif
-- min(1200, 3 % du live) mord toujours par sa branche ABSOLUE (3 % de 45 216 = 1 356).
-- Or l'inflow d'absences confirmées tourne à 1 100-1 800/jour (mesuré sur
-- absent_first_at, semaine du 26/07 au 02/08), c'est-à-dire au niveau du cap : le sweep
-- oscille en 'capped' chronique (candidats 1 296 puis 1 412 les nuits du 01 et 02/08)
-- avec un reliquat qui se reporte sans jamais se vider. Le 1200 avait été calibré à un
-- vivier de ~26 000, où 3 % ≈ 780 : il n'était alors qu'un filet jamais atteint. Le
-- vivier ayant grossi (refonte du 20-21/07), il est devenu la contrainte active sans
-- qu'on l'ait décidé — et il ne protège rien que le 3 % ne protège déjà : les candidats
-- sont des absents confirmés par 3 sondes espacées ≥20h ET vieux de ≥48h, la garde
-- last_seen_at (20260721090000) écartant tout bien re-vu vivant depuis.
--
-- p_cap_abs devient NULLABLE : null = pas de cap absolu, seul le cap relatif borne.
-- Le paramètre est conservé (même signature ⇒ remplacement en place, pas de surcharge —
-- piège PGRST203) pour garder un frein d'urgence actionnable à la main.

create or replace function public.realadvisor_probe_sweep(
  p_offer_type text default 'buy',
  p_threshold integer default 3,
  p_min_age_hours integer default 48,
  p_cap_abs integer default null,
  p_cap_pct numeric default 0.03,
  p_apply boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_live bigint := 0; v_candidates bigint := 0; v_removed bigint := 0;
  v_limit bigint; v_status text;
begin
  select count(*) into v_live from market_listings
   where source_portal = 'realadvisor' and transaction_type = p_offer_type
     and status in ('active', 'price_reduced');

  select count(*) into v_candidates from market_listings
   where source_portal = 'realadvisor' and transaction_type = p_offer_type
     and status in ('active', 'price_reduced')
     and absent_probe_count >= p_threshold
     and absent_first_at is not null
     and absent_first_at < now() - make_interval(hours => p_min_age_hours)
     -- Re-vu vivant depuis sa première absence ⇒ la preuve d'absence est périmée.
     -- L'égalité protège aussi : « vu » et « absent » au même instant est contradictoire.
     and (last_seen_at is null or last_seen_at < absent_first_at);

  -- Plafond effectif = cap relatif, borné par le cap absolu SI fourni.
  -- coalesce(p_cap_abs, v_live) : null ⇒ le least() se réduit au 3 %, et live=0 ⇒
  -- limit=0 ⇒ 0 retrait reste vrai dans les deux branches.
  v_limit := least(coalesce(p_cap_abs::bigint, v_live), floor(v_live * p_cap_pct)::bigint);

  if p_apply then
    update market_listings set status = 'removed', updated_at = now()
     where id in (
       select id from market_listings
        where source_portal = 'realadvisor' and transaction_type = p_offer_type
          and status in ('active', 'price_reduced')
          and absent_probe_count >= p_threshold
          and absent_first_at is not null
          and absent_first_at < now() - make_interval(hours => p_min_age_hours)
          and (last_seen_at is null or last_seen_at < absent_first_at)
        order by absent_first_at asc
        limit v_limit
     );
    get diagnostics v_removed = row_count;
    v_status := case when v_candidates > v_limit then 'capped' else 'completed' end;
  else
    v_status := 'dry_run';
  end if;

  return jsonb_build_object(
    'status', v_status, 'candidates', v_candidates, 'live', v_live,
    'removed', v_removed, 'limit', v_limit, 'capped', v_candidates > v_limit);
end $function$;

-- Le cron passait le 1200 EN DUR (appel positionnel) : changer le défaut de la fonction
-- ne suffit pas, il faut re-poser la commande. Même montage que 20260621140000
-- (unschedule avalé + schedule gardé par l'existence du schéma cron — base CI fraîche
-- sans pg_cron incluse).
do $$ begin perform cron.unschedule('realadvisor-probe-sweep'); exception when others then null; end $$;
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('realadvisor-probe-sweep', '30 1 * * *', $cron$
  insert into realadvisor_sync_runs(offer_type, trigger_source, status, ended_at, total_removed, total_seen, error_message)
  select 'buy', 'cron-probe-sweep', coalesce(r->>'status','?'), now(),
         coalesce((r->>'removed')::int,0), coalesce((r->>'live')::int,0),
         'probe_sweep candidates='||coalesce(r->>'candidates','?')||' removed='||coalesce(r->>'removed','?')||' status='||coalesce(r->>'status','?')
  from (select public.realadvisor_probe_sweep('buy',3,48,null,0.03,
          public.get_app_config('realadvisor_probe_apply') = 'true') as r) x;
$cron$);
  end if;
end $$;
