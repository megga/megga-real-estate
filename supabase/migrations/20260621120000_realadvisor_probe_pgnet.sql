-- realadvisor : le probe id_in tourne désormais depuis POSTGRES (pg_net), pas l'edge
-- function. Raison : l'IP de sortie de l'edge est flaggée par RA pour id_in (6 runs
-- 100% throttlés), alors que l'IP de la base (pg_net) passe (30/30, 10/10). On déplace
-- donc fire+collect côté DB. La logique métier (bookkeeping, removal, compteurs,
-- plafonds, dry-run) est INCHANGÉE — on réutilise les RPC realadvisor_probe_bookkeep /
-- realadvisor_probe_sweep. L'edge function garde 'fresh' (national, non throttlé).

-- 1) Staging : relie une requête pg_net (request_id) au lot d'ids sondés.
create table if not exists public.realadvisor_probe_inflight (
  request_id bigint primary key,
  source_ids text[] not null,
  offer_type text not null default 'buy',
  fired_at timestamptz not null default now()
);
alter table public.realadvisor_probe_inflight enable row level security;

-- 2) FIRE : sélectionne les biens dus (last_probe_at NULL/>20h, absents prioritaires),
--    tire 1 requête id_in par lot de 36 via pg_net, stage le mapping request_id→ids.
create or replace function public.realadvisor_probe_fire(p_offer_type text default 'buy', p_batches int default 40)
returns int language plpgsql security definer set search_path = public as $$
declare v_ua text; v_fired int := 0; r record;
begin
  if public.get_app_config('realadvisor_probe_enabled') = 'false' then return 0; end if;
  v_ua := coalesce(nullif(public.get_app_config('realadvisor_user_agent'), ''),
                   'MeggaRealEstateBot/1.0 (+https://megga.ch; contact: tech@megga.ch)');
  for r in
    with due as (
      select source_id
      from market_listings
      where source_portal = 'realadvisor' and transaction_type = p_offer_type
        and status in ('active', 'price_reduced')
        and (last_probe_at is null or last_probe_at < now() - interval '20 hours')
      order by absent_probe_count desc, last_probe_at asc nulls first
      limit p_batches * 36
    ),
    ranked as (select source_id, ((row_number() over () - 1) / 36)::int as batch_no from due)
    select array_agg(source_id) as ids, string_agg(source_id, ',') as ids_csv
    from ranked group by batch_no
  loop
    insert into realadvisor_probe_inflight(request_id, source_ids, offer_type)
    values (
      net.http_get(
        'https://realadvisor.ch/api/listings?offerType_eq=' || p_offer_type || '&id_in=' || r.ids_csv,
        headers := jsonb_build_object('Accept', 'application/json', 'User-Agent', v_ua),
        timeout_milliseconds := 15000
      ),
      r.ids, p_offer_type
    );
    v_fired := v_fired + 1;
  end loop;
  return v_fired;
end $$;
revoke all on function public.realadvisor_probe_fire(text, int) from public;
grant execute on function public.realadvisor_probe_fire(text, int) to service_role;

-- 3) COLLECT : lit les réponses pg_net, calcule présent/absent, bookkeep. Garde dure :
--    HTTP≠200 / non-JSON / total_count>lot / array≠count = AMBIGU → aucune écriture.
create or replace function public.realadvisor_probe_collect()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_present text[]; v_absent text[]; v_tc int;
        v_ok int := 0; v_amb int := 0; v_present_n int := 0; v_absent_n int := 0;
begin
  for r in
    select f.request_id, f.source_ids, resp.status_code, resp.content
    from realadvisor_probe_inflight f
    join net._http_response resp on resp.id = f.request_id
  loop
    v_tc := -1;
    if r.status_code = 200 and r.content ~ '"total_count"' then
      begin
        v_tc := (r.content::jsonb ->> 'total_count')::int;
        select coalesce(array_agg(elem ->> 'id'), array[]::text[]) into v_present
        from jsonb_array_elements(coalesce(r.content::jsonb -> 'listings', '[]'::jsonb)) elem;
      exception when others then v_tc := -1; end;
    end if;

    if v_tc < 0 or v_tc > coalesce(array_length(r.source_ids, 1), 0) then
      v_amb := v_amb + 1;  -- ambigu : on ne touche pas (la ligne reste due)
    else
      v_present := array(select unnest(r.source_ids) intersect select unnest(coalesce(v_present, array[]::text[])));
      v_absent  := array(select unnest(r.source_ids) except select unnest(coalesce(v_present, array[]::text[])));
      if coalesce(array_length(v_absent, 1), 0) is distinct from (coalesce(array_length(r.source_ids, 1), 0) - v_tc) then
        v_amb := v_amb + 1;  -- array vs total_count divergent (troncature)
      else
        perform realadvisor_probe_bookkeep(v_present, v_absent, 20);
        v_ok := v_ok + 1;
        v_present_n := v_present_n + coalesce(array_length(v_present, 1), 0);
        v_absent_n := v_absent_n + coalesce(array_length(v_absent, 1), 0);
      end if;
    end if;
    delete from realadvisor_probe_inflight where request_id = r.request_id;
  end loop;
  -- inflight orphelins (>15 min sans réponse pg_net) = timeout → on purge.
  delete from realadvisor_probe_inflight where fired_at < now() - interval '15 minutes';

  -- ligne de run pour l'observabilité (le rapport quotidien lit cron-probe).
  if v_ok + v_amb > 0 then
    insert into realadvisor_sync_runs(offer_type, trigger_source, status, ended_at,
      total_seen, total_updated, total_errors, pages_fetched, error_message)
    values ('buy', 'cron-probe', case when v_ok = 0 and v_amb > 0 then 'throttled' else 'completed' end,
      now(), v_present_n + v_absent_n, v_present_n, v_amb, v_ok + v_amb,
      'probe(pgnet) ok=' || v_ok || ' ambiguous=' || v_amb || ' present=' || v_present_n || ' absent=' || v_absent_n);
  end if;
  return jsonb_build_object('ok', v_ok, 'ambiguous', v_amb, 'present', v_present_n, 'absent', v_absent_n);
end $$;
revoke all on function public.realadvisor_probe_collect() from public;
grant execute on function public.realadvisor_probe_collect() to service_role;

-- 4) Crons. On retire le probe edge (throttlé) ; fire/collect/sweep tournent en pur SQL.
do $$ begin perform cron.unschedule('realadvisor-probe-hourly'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('realadvisor-probe-sweep-daily'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('realadvisor-probe-fire'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('realadvisor-probe-collect'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('realadvisor-probe-sweep'); exception when others then null; end $$;

select cron.schedule('realadvisor-probe-fire',   '0 * * * *',  $cron$ select public.realadvisor_probe_fire('buy', 40); $cron$);
select cron.schedule('realadvisor-probe-collect', '10 * * * *', $cron$ select public.realadvisor_probe_collect(); $cron$);
-- probe-sweep : appelle la RPC en direct ET logge une ligne de run (observabilité).
select cron.schedule('realadvisor-probe-sweep', '30 1 * * *', $cron$
  insert into realadvisor_sync_runs(offer_type, trigger_source, status, ended_at, total_removed, total_seen, error_message)
  select 'buy', 'cron-probe-sweep', coalesce(r->>'status','?'), now(),
         coalesce((r->>'removed')::int,0), coalesce((r->>'live')::int,0),
         'probe_sweep candidates='||coalesce(r->>'candidates','?')||' removed='||coalesce(r->>'removed','?')||' status='||coalesce(r->>'status','?')
  from (select public.realadvisor_probe_sweep('buy',3,48,1200,0.03,
          public.get_app_config('realadvisor_probe_apply') = 'true') as r) x;
$cron$);
