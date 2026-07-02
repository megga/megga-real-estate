-- RealAdvisor autonomous health alert: deterministic anomaly detection + email on failure only.
-- Makes the buy ingestion/detection/sweep loop "zero-surveillance": pings tech only when the loop
-- pauses or behaves abnormally. Everything fails SAFE (stops, never corrupts); this just surfaces it.
-- Applied to prod via MCP on 2026-06-25; this file tracks it in-repo to avoid drift.
--
-- NOTE (CI safety): the local `supabase start` stack used by backend.yml has pg_net but NOT
-- pg_cron (schema "cron" absent). The function body references `cron.job` (anomaly D), so we
-- disable body checking for this file to let CREATE FUNCTION succeed in CI (on prod the cron
-- schema exists; in CI the function is created but never called). The standalone cron.schedule
-- at the bottom is additionally guarded by a pg_cron presence check (house idiom). Idempotent
-- everywhere (CREATE OR REPLACE / WHERE NOT EXISTS / cron.schedule upsert).
set check_function_bodies = off;

-- 1) config: kill-switch + recipient (idempotent)
insert into app_config(key, value)
select 'realadvisor_alert_enabled', 'true'
where not exists (select 1 from app_config where key = 'realadvisor_alert_enabled');

insert into app_config(key, value)
select 'realadvisor_alert_email', 'tech@megga.ch'
where not exists (select 1 from app_config where key = 'realadvisor_alert_email');

-- 2) the deterministic health check (0 LLM)
create or replace function public.realadvisor_health_check()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_alerts  text[] := array[]::text[];
  v_lines   text[] := array[]::text[];
  v_missing text[] := array[]::text[];
  v_n int;
  v_removed int;
  v_email text;
  v_subject text;
  v_body text;
  r record;
begin
  if public.get_app_config('realadvisor_alert_enabled') = 'false' then
    return jsonb_build_object('status', 'disabled');
  end if;

  -- A) Sweep stuck: >=2 safety_skipped sweeps in last 50h (cap repeatedly tripped)
  select count(*) into v_n
  from realadvisor_sync_runs
  where trigger_source = 'cron-probe-sweep' and status = 'safety_skipped'
    and ended_at > now() - interval '50 hours';
  if v_n >= 2 then
    v_alerts := v_alerts || 'sweep_safety_skipped';
    v_lines := v_lines || ('🛑 Sweep bloqué (safety_skipped) ' || v_n || '× sur 50h : le plafond se déclenche en série. '
      || 'Cause probable = backlog d''absents qui dépasse le plafond nocturne (faire une purge bornée manuelle, gate empirique d''abord) '
      || 'OU vague de faux absents (IP pg_net re-flaggée). À investiguer avant de laisser tourner.');
  end if;

  -- B) Fresh ingestion didn't complete in last 28h (new-listing intake stopped)
  select count(*) into v_n
  from realadvisor_sync_runs
  where trigger_source = 'cron-fresh' and status = 'completed'
    and ended_at > now() - interval '28 hours';
  if v_n = 0 then
    v_alerts := v_alerts || 'fresh_stalled';
    v_lines := v_lines || '🛑 Ingestion « fresh » : aucun run complété depuis >28h — l''ajout des nouveaux biens achat est à l''arrêt (cron realadvisor-fresh-daily 03:30 UTC).';
  end if;

  -- C1) Probe pipeline stopped: no probe-collect cycle in last 3h
  select count(*) into v_n
  from realadvisor_sync_runs
  where trigger_source = 'cron-probe' and ended_at > now() - interval '3 hours';
  if v_n = 0 then
    v_alerts := v_alerts || 'probe_stopped';
    v_lines := v_lines || '🛑 Probe (détection de disparition) : aucun cycle depuis >3h — le pipeline probe-fire/probe-collect ne tourne plus.';
  end if;

  -- C2) IP throttled: last 6 probe-collect cycles all 'throttled' (ok=0 each → detection dead, but no false writes)
  select count(*) into v_n from (
    select status from realadvisor_sync_runs
    where trigger_source = 'cron-probe'
    order by ended_at desc nulls last
    limit 6
  ) t where status = 'throttled';
  if v_n >= 6 then
    v_alerts := v_alerts || 'probe_throttled';
    v_lines := v_lines || '⚠️ Probe throttlé : les 6 derniers cycles sont 100% ambigus (ok=0). L''IP pg_net est probablement flaggée par RealAdvisor → détection en pause (aucune fausse écriture, échec safe). Laisser l''IP reposer ou envisager un repli.';
  end if;

  -- D) A RealAdvisor cron is inactive or missing
  for r in
    select v.jobname from (values
      ('realadvisor-fresh-daily'), ('realadvisor-probe-fire'),
      ('realadvisor-probe-collect'), ('realadvisor-probe-sweep')
    ) as v(jobname)
    where not exists (select 1 from cron.job j where j.jobname = v.jobname and j.active)
  loop
    v_missing := v_missing || r.jobname;
  end loop;
  if coalesce(array_length(v_missing, 1), 0) > 0 then
    v_alerts := v_alerts || 'cron_inactive';
    v_lines := v_lines || ('🛑 Cron(s) RealAdvisor désactivé(s) ou absent(s) : ' || array_to_string(v_missing, ', ') || '.');
  end if;

  -- E) Abnormal mass removal in last 26h (>=1000, near cap) — heads-up even if under cap
  select coalesce(max(total_removed), 0) into v_removed
  from realadvisor_sync_runs
  where trigger_source = 'cron-probe-sweep' and status = 'completed'
    and ended_at > now() - interval '26 hours';
  if v_removed >= 1000 then
    v_alerts := v_alerts || 'mass_removal';
    v_lines := v_lines || ('⚠️ Retrait massif : ' || v_removed || ' biens passés en removed sur la dernière nuit (proche du plafond). '
      || 'Plausible pendant le drainage initial, mais vérifier que ce ne sont pas des faux absents (IP douteuse).');
  end if;

  -- audit trail: always log a health row
  insert into realadvisor_sync_runs(offer_type, trigger_source, status, ended_at, error_message)
  values ('buy', 'cron-health',
          case when coalesce(array_length(v_alerts, 1), 0) > 0 then 'alert' else 'completed' end,
          now(),
          'health: ' || case when coalesce(array_length(v_alerts, 1), 0) > 0
                             then 'ALERT [' || array_to_string(v_alerts, ',') || ']'
                             else 'OK' end);

  -- healthy → silent
  if coalesce(array_length(v_alerts, 1), 0) = 0 then
    return jsonb_build_object('status', 'ok', 'alerts', 0);
  end if;

  -- send a single email, only on anomaly
  v_email := coalesce(nullif(public.get_app_config('realadvisor_alert_email'), ''),
                      nullif(public.get_app_config('realadvisor_contact_email'), ''),
                      'tech@megga.ch');
  v_subject := '🚨 RealAdvisor — ' || array_length(v_alerts, 1) || ' anomalie(s) : ' || array_to_string(v_alerts, ', ');
  v_body := '<strong>Surveillance RealAdvisor — ingestion achat</strong><br/><br/>'
            || array_to_string(v_lines, '<br/><br/>')
            || '<br/><br/>— Détecté le ' || to_char(now(), 'DD.MM.YYYY HH24:MI') || ' UTC.'
            || '<br/>Le système échoue en sécurité (il s''arrête, il ne corrompt rien).'
            || '<br/>Kill-switch de cette alerte : app_config.realadvisor_alert_enabled = ''false''.';

  perform net.http_post(
    url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
    ),
    body := jsonb_build_object(
      'to', v_email,
      'subject', v_subject,
      'template', 'realadvisor_health_alert',
      'data', jsonb_build_object('body', v_body)
    )
  );

  return jsonb_build_object('status', 'alert', 'alerts', array_length(v_alerts, 1),
                            'codes', to_jsonb(v_alerts), 'email', v_email);
end
$fn$;

-- 3) daily cron at 09:00 UTC (after overnight sweep 01:30 + morning probe cycles).
-- Guarded by pg_cron presence: scheduled in prod, skipped in local/CI (schema "cron" absent)
-- so the migration applies cleanly under `supabase start`.
do $do$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule(
      'realadvisor-health-daily',
      '0 9 * * *',
      $cron$ select public.realadvisor_health_check(); $cron$
    );
  else
    raise notice 'pg_cron absent (local/CI) — realadvisor-health-daily non planifié';
  end if;
end
$do$;

reset check_function_bodies;
