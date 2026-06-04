-- Hygiène backend : santé des crons pour le super-admin. Lit directement pg_cron
-- (cron.job + dernier cron.job_run_details par job). SECURITY DEFINER (proprio postgres
-- → peut lire le schéma cron sur Supabase). Gardée is_super_admin (données plateforme).
-- Dégrade proprement : si le schéma cron est absent (local/CI), renvoie un set vide.
CREATE OR REPLACE FUNCTION public.get_cron_health()
RETURNS TABLE (jobname text, schedule text, active boolean, last_start timestamptz, last_status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
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
      WHERE r.jobid = j.jobid
      ORDER BY r.start_time DESC
      LIMIT 1
    ) d ON true
    ORDER BY j.jobname;
END;
$$;

REVOKE ALL ON FUNCTION public.get_cron_health() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_cron_health() TO authenticated;
COMMENT ON FUNCTION public.get_cron_health() IS
  'Hygiène backend — santé des jobs pg_cron (dernier run + statut) pour le super-admin. Garde is_super_admin (42501). Lit cron.job/cron.job_run_details ; renvoie vide si pg_cron absent (local/CI).';

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    GRANT USAGE ON SCHEMA cron TO postgres;
    GRANT SELECT ON cron.job TO postgres;
    GRANT SELECT ON cron.job_run_details TO postgres;
  END IF;
END
$do$;
