-- La santé des crons se lit dans un INSTANTANÉ, plus dans un parcours de l'historique.
--
-- ⛔ CONSTAT DE L'AUDIT DU 13.09.2026. `get_cron_health()` expirait ENCORE 22 fois par 24 h
-- (statement_timeout 8 s de PostgREST), alors que la migration 20260903210500 annonçait que
-- la rétention à 30 jours « corrige ». Mesuré ce jour-là : `cron.job_run_details` compte
-- 111 090 lignes depuis le 14.08 — la rétention tourne (DELETE 3 462/nuit) mais l'arrivée
-- (~3 700/jour, deux jobs à la minute) fait un régime de croisière à ~110 000 lignes, et la
-- fonction parcourt cette table UNE FOIS PAR JOB (52 parcours, `OR r.command = j.command`
-- interdisant tout index). À froid, ça dépasse 8 s ; et l'appelant horaire
-- (`platform-metrics-hourly` → admin-monitoring → `_shared/admin-alerts.ts`) rend alors
-- « Santé des crons illisible » à chaque tour : AUCUN retard ni échec de job n'était détecté.
--
-- La même migration disait : « la réécriture de get_cron_health a été essayée et
-- abandonnée — ne pas la refaire ». Elle avait raison SUR CE QU'ELLE MESURAIT : réécrire la
-- requête dans la même fonction, exécutée sous le même timeout, ne gagne que 14 %. Ce qui
-- change ici n'est pas la requête, c'est QUI l'exécute et QUAND :
--
--   · `cron_health_snapshot_refresh()` calcule le dernier run de chaque job (par jobid ET par
--     empreinte de commande, pour survivre aux recréations — le motif de 20260816000000) et
--     l'écrit dans `cron_health_snapshot`. Elle tourne sous pg_cron, en `postgres`, rôle SANS
--     statement_timeout : deux secondes toutes les cinq minutes ne dérangent personne.
--     Le tri se fait sur `md5(command)` (32 octets) et non sur `command` (329 octets/ligne
--     mesurés) : c'est le tri par commande qui débordait sur disque.
--   · `get_cron_health()` garde sa signature (le front `useCronHealth` et l'alerting la
--     lisent) et ne fait plus qu'une jointure de 52 lignes : `cron.job` pour la cadence et
--     l'état COURANTS, l'instantané pour la dernière exécution.
--
-- ⚠ MODE DE PANNE, ASSUMÉ ET BRUYANT. Si le rafraîchissement cesse, `last_start` se fige
-- pour tous les jobs — le premier à passer « en retard » aux yeux de l'alerting est le
-- rafraîchisseur lui-même (`*/5`, seuil court), puis les autres. Un chien de garde qui
-- meurt doit se voir ; il ne doit pas paraître sain. On ne lève donc PAS d'exception sur un
-- instantané périmé : l'exception rendrait « illisible » (l'état d'avant), le gel rend
-- « en retard », qui NOMME le job à réparer.
--
-- ⚠ Un job créé depuis le dernier rafraîchissement apparaît avec `last_start` NULL pendant
-- au plus cinq minutes : l'alerting le traite déjà (« jamais vu », registre
-- `admin_cron_first_seen`).

-- ═══════════════════════════════════════════════════════════════════════════
-- L'INSTANTANÉ
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.cron_health_snapshot (
  jobname      text primary key,
  schedule     text,
  active       boolean not null default true,
  last_start   timestamptz,
  last_status  text,
  refreshed_at timestamptz not null default now()
);

alter table public.cron_health_snapshot enable row level security;
-- Aucune policy : lu par get_cron_health (SECURITY DEFINER), écrit par le rafraîchisseur.
revoke all on table public.cron_health_snapshot from public, anon, authenticated;

comment on table public.cron_health_snapshot is
  'Dernière exécution connue de chaque job pg_cron, rafraîchie toutes les 5 min par '
  'cron_health_snapshot_refresh(). get_cron_health() lit ici au lieu de parcourir '
  'cron.job_run_details (20260913120100).';

-- ═══════════════════════════════════════════════════════════════════════════
-- LE RAFRAÎCHISSEUR
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.cron_health_snapshot_refresh()
returns integer
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_n integer := 0;
begin
  -- `session_user`, jamais `current_user` : dans une SECURITY DEFINER détenue par postgres,
  -- current_user VAUT postgres et la garde serait toujours vraie (même piège qu'admin_log_write).
  if not (public.is_service_role() or session_user in ('postgres', 'supabase_admin')) then
    raise exception 'forbidden: service or postgres only' using errcode = '42501';
  end if;

  -- Base fraîche (CI) : pg_cron peut manquer, ou le schéma exister sans sa table
  -- d'historique. Rien à rafraîchir, et surtout rien à faire échouer.
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or to_regclass('cron.job_run_details') is null
     or to_regclass('cron.job') is null then
    return 0;
  end if;

  -- SQL dynamique : la fonction doit se CRÉER sur une base sans pg_cron, où `cron.job`
  -- n'existe pas (plpgsql ne résout les noms qu'à l'exécution, mais on ne dépend pas de
  -- ce détail — même choix que get_admin_cron_runs).
  execute $q$
    with by_job as (
      select distinct on (r.jobid) r.jobid, r.start_time, r.status::text as status
        from cron.job_run_details r
       order by r.jobid, r.start_time desc
    ), by_cmd as (
      select distinct on (md5(r.command)) md5(r.command) as cmd_md5, r.start_time, r.status::text as status
        from cron.job_run_details r
       order by md5(r.command), r.start_time desc
    ), latest as (
      select j.jobname::text as jobname, j.schedule::text as schedule, j.active,
             case when coalesce(bj.start_time, '-infinity'::timestamptz)
                       >= coalesce(bc.start_time, '-infinity'::timestamptz)
                  then bj.start_time else bc.start_time end as last_start,
             case when coalesce(bj.start_time, '-infinity'::timestamptz)
                       >= coalesce(bc.start_time, '-infinity'::timestamptz)
                  then bj.status else bc.status end as last_status
        from cron.job j
        left join by_job bj on bj.jobid = j.jobid
        left join by_cmd bc on bc.cmd_md5 = md5(j.command)
       where j.jobname is not null
    )
    insert into public.cron_health_snapshot (jobname, schedule, active, last_start, last_status, refreshed_at)
    select jobname, schedule, active, last_start, last_status, now() from latest
    on conflict (jobname) do update
      set schedule = excluded.schedule, active = excluded.active,
          last_start = excluded.last_start, last_status = excluded.last_status,
          refreshed_at = excluded.refreshed_at
  $q$;
  get diagnostics v_n = row_count;

  -- Un job supprimé de cron.job n'est plus rafraîchi : sa ligne s'efface au bout d'un jour.
  delete from public.cron_health_snapshot where refreshed_at < now() - interval '1 day';

  return v_n;
end $$;

comment on function public.cron_health_snapshot_refresh() is
  'Recalcule cron_health_snapshot (dernier run par jobid OU par empreinte de commande). '
  'Tourne sous pg_cron toutes les 5 min (rôle postgres, sans statement_timeout). '
  'Service_role ou postgres seuls.';

revoke all on function public.cron_health_snapshot_refresh() from public, anon, authenticated;
grant execute on function public.cron_health_snapshot_refresh() to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- LA LECTURE — même signature, une jointure de 52 lignes
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.get_cron_health()
returns table(jobname text, schedule text, active boolean, last_start timestamp with time zone, last_status text)
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  -- Élargi (20260705160000) : l'alerting cron d'admin-monitoring lit la santé
  -- des jobs avec la service key.
  IF NOT (public.is_super_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron')
     OR to_regclass('cron.job') IS NULL THEN
    RETURN;
  END IF;

  -- Cadence et état COURANTS depuis cron.job ; dernier run depuis l'instantané
  -- (cf. l'en-tête : plus aucun parcours de cron.job_run_details ici).
  RETURN QUERY EXECUTE $q$
    SELECT j.jobname::text, j.schedule::text, j.active, s.last_start, s.last_status
      FROM cron.job j
      LEFT JOIN public.cron_health_snapshot s ON s.jobname = j.jobname::text
     WHERE j.jobname IS NOT NULL
       AND j.jobname !~ '^adhoc-\d+-'   -- passages ponctuels : éphémères, jamais « en retard »
     ORDER BY j.jobname
  $q$;
END;
$function$;

comment on function public.get_cron_health() is
  'Santé des jobs pg_cron : cadence et état depuis cron.job, dernier run depuis '
  'cron_health_snapshot (rafraîchi toutes les 5 min). Ne parcourt plus cron.job_run_details '
  '— la fonction expirait 22 fois par jour sous le statement_timeout de 8 s (20260913120100).';

-- ═══════════════════════════════════════════════════════════════════════════
-- PREMIER INSTANTANÉ, ET LA CADENCE
-- ═══════════════════════════════════════════════════════════════════════════
-- Peuplé tout de suite : sans ça, get_cron_health rendrait NULL partout jusqu'au premier
-- passage du job, et l'alerting horaire pourrait tomber dans cette fenêtre.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform public.cron_health_snapshot_refresh();
  end if;
end $$;

-- Même montage que les autres crons du dépôt (unschedule avalé, schedule gardé par
-- l'existence du schéma cron pour une base de CI sans pg_cron).
do $$ begin perform cron.unschedule('cron-health-snapshot-5min'); exception when others then null; end $$;
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('cron-health-snapshot-5min', '*/5 * * * *',
      'select public.cron_health_snapshot_refresh();');
  end if;
end $$;
