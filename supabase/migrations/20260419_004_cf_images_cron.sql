-- ============================================================================
-- pg_cron : cf-images-backfill-every-10-min
--
-- Calls backfill-cf-images Edge Function every 10 minutes to process a batch
-- of 25 listings whose photos haven't been uploaded to Cloudflare Images yet.
--
-- Throughput: ~150 listings/hour → the 33K backlog clears in ~9 days.
-- New listings inserted by flatfox-sync (daily at 04:00) are picked up
-- within 10 minutes of insertion automatically — no need to couple the
-- sync to the photo processor.
--
-- Prerequisites:
--   - pg_cron + pg_net extensions enabled
--   - app.settings.supabase_url + app.settings.service_role_key configured
--     (see 20260415_004_flatfox_sync_cron.sql)
--   - backfill-cf-images Edge Function deployed
--   - CF_ACCOUNT_ID + CF_IMAGES_TOKEN secrets set on the EF runtime
--
-- Idempotent: safe to re-run. Existing schedule is unscheduled first.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cf-images-backfill-every-10-min') THEN
    PERFORM cron.unschedule('cf-images-backfill-every-10-min');
    RAISE NOTICE 'cf-images-backfill-every-10-min: previous schedule removed';
  END IF;
END $$;

-- Every 10 minutes (offset from platform-metrics :15 and ai-billing :30 —
-- no collision since this one runs at :00, :10, :20, :30, :40, :50).
SELECT cron.schedule(
  'cf-images-backfill-every-10-min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/backfill-cf-images',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"batch": 25}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

COMMIT;
