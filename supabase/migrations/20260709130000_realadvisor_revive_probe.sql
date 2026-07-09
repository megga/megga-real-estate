-- Sonde de RÉSURRECTION RealAdvisor : re-vérifier les biens 'removed' et
-- ré-activer ceux revenus en ligne. Ferme la dernière boucle du système :
-- détection des disparitions (probe) ✓, drainage borné (sweep tronqué) ✓,
-- retours en ligne ✗→✓.
--
-- Pourquoi : la porte était à sens unique — le probe ne sonde que les
-- active/price_reduced, donc un bien 'removed' n'était plus jamais re-vérifié.
-- Or ~1 % des absents confirmés reviennent en ligne (mesuré 2× sur les gates
-- empiriques : 2/72 le 25/06, 1/80 le 09/07) — re-publication, mandat
-- suspendu/repris, blip RA. Sur ~15k removed, ~150-200 biens réellement en
-- vente devenaient invisibles au matching, définitivement.
--
-- Architecture (miroir exact du probe pg_net fire/collect, IP base jamais flaggée) :
--   · realadvisor_revive_fire (cron 02:30) : sélectionne les removed dus
--     (fenêtre = absent_first_at > now()-60j — PAS updated_at, que le trigger
--     trg_market_listings_updated_at écrase à chaque update, re-check ≥14j
--     via last_probe_at, réutilisé : le probe ne touche plus ces lignes),
--     lots de 36 → net.http_get id_in → stage dans realadvisor_probe_inflight
--     avec kind='revive'.
--   · realadvisor_revive_collect (cron 02:45) : parse les réponses (mêmes
--     gardes d'ambiguïté que le probe : total_count vs array, jamais d'écriture
--     sur batch douteux). Présent → status='active' + compteurs remis à zéro
--     (le trigger ra_price_status re-dérive price_reduced si le bien avait
--     baissé avant sa disparition — continuité du signal). Absent →
--     last_probe_at=now() (pas re-vérifié avant 14j). Plafond p_max_revive
--     (300/run) : au-delà, les batchs restants sont défaussés sans écriture
--     (re-tentés la nuit suivante) — une vague de faux « présents » reste bornée.
--   · realadvisor_probe_collect : filtre kind='probe' (sinon il consommerait
--     les batchs revive : son bookkeep ne touche que les lignes actives → les
--     removed resteraient removed ET les stats cron-probe seraient polluées).
--   · realadvisor_health_check : les 2 nouveaux crons rejoignent l'anomalie D
--     (cron inactif/absent).
--
-- Charge : régime permanent ≈ churn(~500/j) × (60j/14j) ≈ 60 lots/nuit, un
-- seul créneau 02:30 loin des :00/:10 du probe. Cohortes initiales (25-27/06,
-- ~7.9k) dues dès maintenant → drainées en ~4 nuits à 60 lots.
-- NB : les re-checks « toujours absent » bumpent updated_at (trigger global) —
-- le comptage « retirés cette nuit » doit se lire dans realadvisor_sync_runs
-- (total_removed du cron-probe-sweep), pas via updated_at.
--
-- Kill-switch : app_config.realadvisor_revive_enabled='false'.
-- Réversibilité : un bien ré-activé à tort re-parcourt le cycle normal
-- (probe → 3× absent ≥48h → sweep) et se re-retire seul.

set check_function_bodies = off;

-- ── 1. Discriminant de staging (probe vs revive) ────────────────────────────
alter table public.realadvisor_probe_inflight
  add column if not exists kind text not null default 'probe';

-- ── 2. Kill-switch ──────────────────────────────────────────────────────────
insert into public.app_config(key, value)
values ('realadvisor_revive_enabled', 'true')
on conflict (key) do nothing;

-- ── 3. probe_collect : ne consomme QUE ses batchs (kind='probe') ────────────
-- Corps verbatim de la version prod, seul ajout : filtre f.kind.
create or replace function public.realadvisor_probe_collect()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r record; v_present text[]; v_absent text[]; v_tc int;
        v_ok int := 0; v_amb int := 0; v_present_n int := 0; v_absent_n int := 0;
begin
  for r in
    select f.request_id, f.source_ids, resp.status_code, resp.content
    from realadvisor_probe_inflight f
    join net._http_response resp on resp.id = f.request_id
    where coalesce(f.kind, 'probe') = 'probe'
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
      v_amb := v_amb + 1;
    else
      v_present := array(select unnest(r.source_ids) intersect select unnest(coalesce(v_present, array[]::text[])));
      v_absent  := array(select unnest(r.source_ids) except select unnest(coalesce(v_present, array[]::text[])));
      if coalesce(array_length(v_absent, 1), 0) is distinct from (coalesce(array_length(r.source_ids, 1), 0) - v_tc) then
        v_amb := v_amb + 1;
      else
        perform realadvisor_probe_bookkeep(v_present, v_absent, 20);
        v_ok := v_ok + 1;
        v_present_n := v_present_n + coalesce(array_length(v_present, 1), 0);
        v_absent_n := v_absent_n + coalesce(array_length(v_absent, 1), 0);
      end if;
    end if;
    delete from realadvisor_probe_inflight where request_id = r.request_id;
  end loop;
  delete from realadvisor_probe_inflight where fired_at < now() - interval '15 minutes';

  if v_ok + v_amb > 0 then
    insert into realadvisor_sync_runs(offer_type, trigger_source, status, ended_at,
      total_seen, total_updated, total_errors, pages_fetched, error_message)
    values ('buy', 'cron-probe', case when v_ok = 0 and v_amb > 0 then 'throttled' else 'completed' end,
      now(), v_present_n + v_absent_n, v_present_n, v_amb, v_ok + v_amb,
      'probe(pgnet) ok=' || v_ok || ' ambiguous=' || v_amb || ' present=' || v_present_n || ' absent=' || v_absent_n);
  end if;
  return jsonb_build_object('ok', v_ok, 'ambiguous', v_amb, 'present', v_present_n, 'absent', v_absent_n);
end $function$;

-- ── 4. revive_fire : staging des removed dus ────────────────────────────────
create or replace function public.realadvisor_revive_fire(
  p_offer_type text default 'buy',
  p_batches integer default 60,
  p_window_days integer default 60,
  p_min_gap_days integer default 14
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_ua text; v_fired int := 0; r record;
begin
  if public.get_app_config('realadvisor_revive_enabled') = 'false' then return 0; end if;
  v_ua := coalesce(nullif(public.get_app_config('realadvisor_user_agent'), ''),
                   'MeggaRealEstateBot/1.0 (+https://megga.ch; contact: tech@megga.ch)');
  for r in
    with due as (
      select source_id
      from market_listings
      where source_portal = 'realadvisor' and transaction_type = p_offer_type
        and status = 'removed'
        -- Ancre STABLE : absent_first_at (figé) — updated_at est écrasé par
        -- trg_market_listings_updated_at à chaque re-check → fenêtre infinie.
        and absent_first_at is not null
        and absent_first_at > now() - make_interval(days => p_window_days)
        and (last_probe_at is null or last_probe_at < now() - make_interval(days => p_min_gap_days))
      order by absent_first_at desc
      limit p_batches * 36
    ),
    ranked as (select source_id, ((row_number() over () - 1) / 36)::int as batch_no from due)
    select array_agg(source_id) as ids, string_agg(source_id, ',') as ids_csv
    from ranked group by batch_no
  loop
    insert into realadvisor_probe_inflight(request_id, source_ids, offer_type, kind)
    values (
      net.http_get(
        'https://realadvisor.ch/api/listings?offerType_eq=' || p_offer_type || '&id_in=' || r.ids_csv,
        headers := jsonb_build_object('Accept', 'application/json', 'User-Agent', v_ua),
        timeout_milliseconds := 15000
      ),
      r.ids, p_offer_type, 'revive'
    );
    v_fired := v_fired + 1;
  end loop;
  return v_fired;
end $function$;

-- ── 5. revive_collect : ré-activation bornée ────────────────────────────────
create or replace function public.realadvisor_revive_collect(
  p_max_revive integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r record; v_present text[]; v_absent text[]; v_tc int; v_n int;
        v_ok int := 0; v_amb int := 0; v_revived int := 0; v_still int := 0;
        v_dropped int := 0;
begin
  for r in
    select f.request_id, f.source_ids, resp.status_code, resp.content
    from realadvisor_probe_inflight f
    join net._http_response resp on resp.id = f.request_id
    where f.kind = 'revive'
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
      v_amb := v_amb + 1;
    else
      v_present := array(select unnest(r.source_ids) intersect select unnest(coalesce(v_present, array[]::text[])));
      v_absent  := array(select unnest(r.source_ids) except select unnest(coalesce(v_present, array[]::text[])));
      if coalesce(array_length(v_absent, 1), 0) is distinct from (coalesce(array_length(r.source_ids, 1), 0) - v_tc) then
        v_amb := v_amb + 1;
      elsif v_revived >= p_max_revive then
        -- Plafond atteint : on défausse SANS écrire (last_probe_at intact
        -- → le lot redevient dû dès la prochaine nuit).
        v_dropped := v_dropped + 1;
      else
        -- Présent → résurrection. Le trigger ra_price_status re-dérive
        -- price_reduced si current_price < price_at_first_seen (préservé).
        if coalesce(array_length(v_present, 1), 0) > 0 then
          update market_listings set
            status = 'active', last_seen_at = now(), last_probe_at = now(),
            absent_probe_count = 0, absent_first_at = null
          where source_portal = 'realadvisor' and source_id = any(v_present)
            and status = 'removed';
          get diagnostics v_n = row_count;
          v_revived := v_revived + v_n;
        end if;
        -- Toujours absent → simple re-datage du check (re-vérifié dans ≥14j).
        if coalesce(array_length(v_absent, 1), 0) > 0 then
          update market_listings set last_probe_at = now()
          where source_portal = 'realadvisor' and source_id = any(v_absent)
            and status = 'removed';
          get diagnostics v_n = row_count;
          v_still := v_still + v_n;
        end if;
        v_ok := v_ok + 1;
      end if;
    end if;
    delete from realadvisor_probe_inflight where request_id = r.request_id;
  end loop;

  if v_ok + v_amb + v_dropped > 0 then
    insert into realadvisor_sync_runs(offer_type, trigger_source, status, ended_at,
      total_seen, total_updated, total_errors, pages_fetched, error_message)
    values ('buy', 'cron-revive',
      case when v_ok = 0 and v_amb > 0 then 'throttled'
           when v_dropped > 0 then 'capped' else 'completed' end,
      now(), v_revived + v_still, v_revived, v_amb, v_ok + v_amb + v_dropped,
      'revive(pgnet) ok=' || v_ok || ' ambiguous=' || v_amb || ' revived=' || v_revived
        || ' still_gone=' || v_still || ' dropped_batches=' || v_dropped);
  end if;
  return jsonb_build_object('ok', v_ok, 'ambiguous', v_amb, 'revived', v_revived,
                            'still_gone', v_still, 'dropped_batches', v_dropped);
end $function$;

-- ── 6. Alerte santé : les 2 crons revive rejoignent l'anomalie D ───────────
-- Corps verbatim de 20260709120000, seule la liste D change.
create or replace function public.realadvisor_health_check()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_alerts  text[] := array[]::text[];
  v_lines   text[] := array[]::text[];
  v_missing text[] := array[]::text[];
  v_n int; v_removed int; v_email text; v_subject text; v_body text; r record;
begin
  if public.get_app_config('realadvisor_alert_enabled') = 'false' then
    return jsonb_build_object('status', 'disabled');
  end if;

  -- A) Capping persistant : >=3 sweeps 'capped' sur 74h.
  select count(*) into v_n from realadvisor_sync_runs
  where trigger_source='cron-probe-sweep' and status='capped' and ended_at > now()-interval '74 hours';
  if v_n >= 3 then
    v_alerts := array_append(v_alerts, 'sweep_capped_persistent');
    v_lines := array_append(v_lines, '⚠️ Sweep plafonné (capped) ' || v_n || '× sur 74h : l''inflow d''absents confirmés dépasse durablement le plafond nocturne. Cause probable = vague de churn RealAdvisor OU faux absents (IP pg_net re-flaggée) — re-passer le gate empirique (id_in sur un échantillon) avant de laisser drainer.');
  end if;

  select count(*) into v_n from realadvisor_sync_runs
  where trigger_source='cron-fresh' and status='completed' and ended_at > now()-interval '28 hours';
  if v_n = 0 then
    v_alerts := array_append(v_alerts, 'fresh_stalled');
    v_lines := array_append(v_lines, '🛑 Ingestion « fresh » : aucun run complété depuis >28h — l''ajout des nouveaux biens achat est à l''arrêt.');
  end if;

  select count(*) into v_n from realadvisor_sync_runs
  where trigger_source='cron-probe' and ended_at > now()-interval '3 hours';
  if v_n = 0 then
    v_alerts := array_append(v_alerts, 'probe_stopped');
    v_lines := array_append(v_lines, '🛑 Probe : aucun cycle depuis >3h — le pipeline probe-fire/probe-collect ne tourne plus.');
  end if;

  select count(*) into v_n from (
    select status from realadvisor_sync_runs where trigger_source='cron-probe' order by ended_at desc nulls last limit 6
  ) t where status='throttled';
  if v_n >= 6 then
    v_alerts := array_append(v_alerts, 'probe_throttled');
    v_lines := array_append(v_lines, '⚠️ Probe throttlé : les 6 derniers cycles sont 100% ambigus (ok=0). IP pg_net probablement flaggée → détection en pause (aucune fausse écriture).');
  end if;

  for r in
    select v.jobname from (values ('realadvisor-fresh-daily'),('realadvisor-probe-fire'),('realadvisor-probe-collect'),('realadvisor-probe-sweep'),('realadvisor-revive-fire'),('realadvisor-revive-collect')) as v(jobname)
    where not exists (select 1 from cron.job j where j.jobname = v.jobname and j.active)
  loop
    v_missing := array_append(v_missing, r.jobname);
  end loop;
  if coalesce(array_length(v_missing,1),0) > 0 then
    v_alerts := array_append(v_alerts, 'cron_inactive');
    v_lines := array_append(v_lines, '🛑 Cron(s) RealAdvisor désactivé(s)/absent(s) : ' || array_to_string(v_missing, ', ') || '.');
  end if;

  -- E) Retrait massif : couvre 'completed' ET 'capped'.
  select coalesce(max(total_removed),0) into v_removed from realadvisor_sync_runs
  where trigger_source='cron-probe-sweep' and status in ('completed','capped') and ended_at > now()-interval '26 hours';
  if v_removed >= 1000 then
    v_alerts := array_append(v_alerts, 'mass_removal');
    v_lines := array_append(v_lines, '⚠️ Retrait massif : ' || v_removed || ' biens passés en removed sur la dernière nuit (proche du plafond) — vérifier que ce ne sont pas des faux absents.');
  end if;

  insert into realadvisor_sync_runs(offer_type, trigger_source, status, ended_at, error_message)
  values ('buy','cron-health', case when coalesce(array_length(v_alerts,1),0) > 0 then 'alert' else 'completed' end, now(),
    'health: ' || case when coalesce(array_length(v_alerts,1),0) > 0 then 'ALERT ['||array_to_string(v_alerts,',')||']' else 'OK' end);

  if coalesce(array_length(v_alerts,1),0) = 0 then
    return jsonb_build_object('status','ok','alerts',0);
  end if;

  v_email := coalesce(nullif(public.get_app_config('realadvisor_alert_email'),''), nullif(public.get_app_config('realadvisor_contact_email'),''), 'tech@megga.ch');
  v_subject := '🚨 RealAdvisor — ' || array_length(v_alerts,1) || ' anomalie(s) : ' || array_to_string(v_alerts, ', ');
  v_body := '<strong>Surveillance RealAdvisor — ingestion achat</strong><br/><br/>' || array_to_string(v_lines, '<br/><br/>')
    || '<br/><br/>— Détecté le ' || to_char(now(),'DD.MM.YYYY HH24:MI') || ' UTC.<br/>Kill-switch : app_config.realadvisor_alert_enabled = ''false''.';

  perform net.http_post(
    url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || public.get_app_config('service_role_key')),
    body := jsonb_build_object('to', v_email, 'subject', v_subject, 'template', 'realadvisor_health_alert', 'data', jsonb_build_object('body', v_body))
  );
  return jsonb_build_object('status','alert','alerts',array_length(v_alerts,1),'codes',to_jsonb(v_alerts),'email',v_email);
end $function$;

-- ── 7. Crons (02:30 fire / 02:45 collect — loin des :00/:10 du probe) ───────
-- Garde CI : pg_cron absent des bases fraîches supabase start.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('realadvisor-revive-fire', '30 2 * * *',
      $cmd$ select public.realadvisor_revive_fire('buy', 60); $cmd$);
    perform cron.schedule('realadvisor-revive-collect', '45 2 * * *',
      $cmd$ select public.realadvisor_revive_collect(300); $cmd$);
  end if;
end $$;
