-- Fix realadvisor_health_check: it built the alert array with `v_alerts := v_alerts || 'literal'`.
-- In plpgsql `text[] || <unknown literal>` resolves to array||array and Postgres tries to parse the
-- literal as an array → "ERROR: malformed array literal". The bug only executes on the ALERT path,
-- which the 2026-06-25 healthy test never reached — so the alert crashed the first time a real
-- anomaly fired (sweep safety_skipped, ~26 Jun) and sent NO email for ~2 days. Switched every append
-- to array_append(). Already corrected live in prod via MCP; this migration tracks it in-repo and
-- supersedes the buggy body shipped in 20260625160000.
--
-- CI-safe: the function body references cron.job (pg_cron / schema "cron" absent in `supabase start`)
-- and net.http_post; disable body checking for this file so CREATE FUNCTION succeeds in CI (on prod
-- the objects exist; the function is never called in CI). Idempotent (CREATE OR REPLACE).
set check_function_bodies = off;

create or replace function public.realadvisor_health_check()
returns jsonb language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_alerts  text[] := array[]::text[];
  v_lines   text[] := array[]::text[];
  v_missing text[] := array[]::text[];
  v_n int; v_removed int; v_email text; v_subject text; v_body text; r record;
begin
  if public.get_app_config('realadvisor_alert_enabled') = 'false' then
    return jsonb_build_object('status', 'disabled');
  end if;

  select count(*) into v_n from realadvisor_sync_runs
  where trigger_source='cron-probe-sweep' and status='safety_skipped' and ended_at > now()-interval '50 hours';
  if v_n >= 2 then
    v_alerts := array_append(v_alerts, 'sweep_safety_skipped');
    v_lines := array_append(v_lines, '🛑 Sweep bloqué (safety_skipped) ' || v_n || '× sur 50h : le plafond se déclenche en série. Cause probable = backlog d''absents qui dépasse le plafond nocturne (refaire une purge bornée manuelle, gate empirique d''abord) OU vague de faux absents (IP pg_net re-flaggée).');
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

  select coalesce(max(total_removed),0) into v_removed from realadvisor_sync_runs
  where trigger_source='cron-probe-sweep' and status='completed' and ended_at > now()-interval '26 hours';
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
end $fn$;

reset check_function_bodies;
