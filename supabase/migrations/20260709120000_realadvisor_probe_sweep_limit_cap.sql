-- Sweep RealAdvisor : le plafond TRONQUE (LIMIT) au lieu de tout sauter.
--
-- Contexte : l'ancienne sémantique « skip-all » (safety_skipped dès que
-- candidates > plafond) créait un CLIQUET — dès qu'UNE journée confirme plus
-- d'absents que le plafond nocturne (pics de churn RA mesurés à 700-1000/j),
-- le backlog cumule au réveil et le sweep ne retire plus jamais rien.
-- 3 purges manuelles pour cette seule cause (25/06, 27/06, 09/07).
--
-- Nouvelle sémantique : retirer les candidats les PLUS ANCIENS (absent_first_at
-- asc) à hauteur du plafond effectif min(p_cap_abs, floor(live × p_cap_pct)).
--   · un pic se draine seul en quelques nuits ;
--   · le plafond reste un limiteur de débit : une vague de FAUX absents
--     (IP pg_net re-flaggée) ne peut retirer que ~min(1200, 3%) par nuit,
--     rattrapable (status='removed' réversible + reset par le probe) ;
--   · status='capped' quand il reste du backlog (candidates > limit) — signal
--     journalisé par le cron 01:30, surveillé par realadvisor_health_check.
--
-- L'alerte santé suit : l'anomalie A (safety_skipped ≥2/50h, statut désormais
-- impossible) devient « capped ≥3 nuits sur 74h » = l'inflow dépasse DURABLEMENT
-- le plafond → churn anormal ou faux absents, à investiguer. L'anomalie E
-- (retrait massif) couvre aussi le nouveau statut 'capped'.

set check_function_bodies = off;

create or replace function public.realadvisor_probe_sweep(
  p_offer_type text default 'buy',
  p_threshold integer default 3,
  p_min_age_hours integer default 48,
  p_cap_abs integer default 1200,
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
     and absent_first_at < now() - make_interval(hours => p_min_age_hours);
  -- Plafond effectif = min(cap absolu, cap relatif). live=0 ⇒ limit=0 ⇒ 0 retrait.
  v_limit := least(p_cap_abs::bigint, floor(v_live * p_cap_pct)::bigint);
  if p_apply then
    update market_listings set status = 'removed', updated_at = now()
     where id in (
       select id from market_listings
        where source_portal = 'realadvisor' and transaction_type = p_offer_type
          and status in ('active', 'price_reduced')
          and absent_probe_count >= p_threshold
          and absent_first_at is not null
          and absent_first_at < now() - make_interval(hours => p_min_age_hours)
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

-- Alerte santé : remplace l'anomalie A (safety_skipped, statut disparu) par la
-- détection d'un capping PERSISTANT, et étend E au statut 'capped'.
-- Corps verbatim de la version prod 27/06 (fix array_append) hors ces 2 blocs.
-- check_function_bodies=off requis : le corps référence cron.job (absent en CI).

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

  -- A) Capping persistant : ≥3 sweeps 'capped' sur 74h = l'inflow d'absents
  -- dépasse durablement le plafond nocturne (vague de churn RA ou faux absents).
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
    select v.jobname from (values ('realadvisor-fresh-daily'),('realadvisor-probe-fire'),('realadvisor-probe-collect'),('realadvisor-probe-sweep')) as v(jobname)
    where not exists (select 1 from cron.job j where j.jobname = v.jobname and j.active)
  loop
    v_missing := array_append(v_missing, r.jobname);
  end loop;
  if coalesce(array_length(v_missing,1),0) > 0 then
    v_alerts := array_append(v_alerts, 'cron_inactive');
    v_lines := array_append(v_lines, '🛑 Cron(s) RealAdvisor désactivé(s)/absent(s) : ' || array_to_string(v_missing, ', ') || '.');
  end if;

  -- E) Retrait massif : couvre 'completed' ET 'capped' (le sweep tronqué retire aussi).
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
