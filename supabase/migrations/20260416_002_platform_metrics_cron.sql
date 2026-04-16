-- ============================================================================
-- pg_cron : platform-metrics-hourly
--
-- Calls admin-monitoring Edge Function every hour to collect fresh metrics
-- (agency count, user count, DB size, storage, errors, etc.) and store them
-- in platform_metrics. Without this cron, AdminMonitoringPage only updates
-- when a super_admin manually visits it.
--
-- Also creates two helper RPC functions used by admin-monitoring:
--   - pg_database_size_mb() → integer (real DB size in MB)
--   - storage_size_mb() → integer (total storage usage in MB)
--
-- Prerequisites:
--   - pg_cron + pg_net extensions enabled
--   - app.settings.supabase_url and app.settings.service_role_key set
--     (see 20260415_004_flatfox_sync_cron.sql for setup instructions)
--   - admin-monitoring Edge Function deployed
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── RPC: pg_database_size_mb ────────────────────────────────────────────────
-- Returns the total DB size in megabytes. Used by admin-monitoring to replace
-- the hardcoded 160 MB fallback.

CREATE OR REPLACE FUNCTION pg_database_size_mb()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (pg_database_size(current_database()) / (1024 * 1024))::integer;
$$;

-- ── RPC: storage_size_mb ────────────────────────────────────────────────────
-- Returns the total size of all files in Supabase Storage (storage.objects)
-- in megabytes. Replaces the old bucket-count × 10 MB heuristic.

CREATE OR REPLACE FUNCTION storage_size_mb()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT (SUM(COALESCE((metadata->>'size')::bigint, 0)) / (1024 * 1024))::integer
     FROM storage.objects),
    0
  );
$$;

-- ── pg_cron job ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'platform-metrics-hourly') THEN
    PERFORM cron.unschedule('platform-metrics-hourly');
    RAISE NOTICE 'platform-metrics-hourly: previous schedule removed';
  END IF;
END $$;

-- Every hour at minute 15 (avoids :00 congestion with other crons)
SELECT cron.schedule(
  'platform-metrics-hourly',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/admin-monitoring',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

COMMIT;
