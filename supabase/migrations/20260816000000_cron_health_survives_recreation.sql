-- `get_cron_health` déclarait « jamais exécuté » des jobs qui tournaient très bien.
--
-- CE QUI CLOCHAIT. La latérale joignait l'historique sur `r.jobid = j.jobid`. Or le
-- `jobid` d'un job pg_cron CHANGE À CHAQUE RECRÉATION — CLAUDE.md §7 le dit déjà pour
-- l'identification (« identifier un job par son jobname, jamais par son jobid »), mais
-- cette fonction, elle, joignait dessus. Un job recréé perd donc TOUT son historique aux
-- yeux de l'alerting : il paraît n'avoir jamais tourné, et l'alerte part.
--
-- MESURÉ le 16.08.2026 sur `whatsapp-consent-cache-reconcile` (quotidien, 03:20) :
--   • joint par jobid (498, le plus récent de la base) → 0 exécution, « en retard » ;
--   • joint par COMMANDE                              → 1 exécution le 15.08 à 03:20,
--                                                       statut `succeeded`.
-- L'alerte du 15.08 à 01:15 portait donc sur un job sain. La base compte 68 jobid
-- orphelins pour 14 541 lignes d'historique : ce n'est pas un cas isolé, c'est la règle.
--
-- LA COMMANDE, ELLE, SURVIT à la recréation : c'est ce que le job FAIT, et `cron.recreate`
-- la reconduit à l'identique. On retient donc l'exécution la plus récente qui corresponde
-- au jobid actuel OU à la commande.
--
-- ⚠ LIMITE ASSUMÉE : deux jobs qui porteraient exactement la même commande partageraient
-- leur dernière exécution. C'est un moindre mal devant un faux « jamais exécuté » — et le
-- cas ne se présente pas aujourd'hui (chaque job appelle une RPC ou une URL distincte).
-- Le jour où il se présentera, la sortie sera optimiste sur l'un des deux, jamais fausse
-- sur les deux.

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

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT j.jobname::text, j.schedule::text, j.active,
           d.start_time, d.status::text
    FROM cron.job j
    LEFT JOIN LATERAL (
      SELECT r.start_time, r.status
      FROM cron.job_run_details r
      -- ⚠ PAS `r.jobid = j.jobid` SEUL : le jobid change à chaque recréation, et
      -- l'historique bascule alors sous un jobid orphelin (cf. l'en-tête).
      WHERE r.jobid = j.jobid OR r.command = j.command
      ORDER BY r.start_time DESC
      LIMIT 1
    ) d ON true
    WHERE j.jobname !~ '^adhoc-\d+-'   -- passages ponctuels : éphémères, jamais « en retard »
    ORDER BY j.jobname;
END;
$function$;

comment on function public.get_cron_health() is
  'Santé des jobs pg_cron. L''historique est retrouvé par jobid OU par commande : le jobid change à chaque recréation et faisait passer des jobs sains pour jamais exécutés (20260816000000).';
