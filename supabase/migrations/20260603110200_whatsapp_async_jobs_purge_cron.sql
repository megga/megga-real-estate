-- Purge quotidienne des jobs TERMINÉS (done/failed) de plus de 7 jours dans
-- whatsapp_async_jobs. Sans ça la table accumulerait des lignes indéfiniment (aucune FK,
-- aucun TTL appliqué — expires_at n'est PAS lu par le claim). Les index de claim/dédup sont
-- partiels (ne couvrent PAS les lignes terminées), donc c'est un nettoyage de STOCKAGE, pas
-- de perf : les réclamations restent rapides quelle que soit la taille. Le purge garde la
-- table petite (≈ 7 j de jobs), donc le DELETE balaie peu de lignes.
-- Gardé par la présence de pg_cron : planifié en prod, sauté en local/CI (schema "cron"
-- absent) pour ne pas casser l'application des migrations. Idempotent (cron.schedule upsert
-- par nom). 03:20 UTC (hors créneaux flatfox-sync 04:00 / metrics :15).

BEGIN;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'whatsapp-async-jobs-purge-daily',
      '20 3 * * *',
      $cron$
      DELETE FROM public.whatsapp_async_jobs
      WHERE status IN ('done','failed') AND created_at < now() - interval '7 days';
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — whatsapp-async-jobs-purge-daily non planifié';
  END IF;
END
$do$;

COMMIT;
