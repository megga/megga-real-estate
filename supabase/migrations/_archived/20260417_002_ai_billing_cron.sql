-- ============================================================================
-- pg_cron : ai-billing-hourly
--
-- Calls ai-billing-monitor Edge Function every hour at :30 (offset from
-- platform-metrics-hourly which runs at :15) to snapshot the DeepSeek
-- account balance into ai_balance_snapshots.
--
-- Prerequisites:
--   - pg_cron + pg_net extensions enabled
--   - app.settings.supabase_url and app.settings.service_role_key set
--     (see 20260415_004_flatfox_sync_cron.sql for setup instructions)
--   - ai-billing-monitor Edge Function deployed
--   - DEEPSEEK_API_KEY secret set in Supabase Edge Functions
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai-billing-hourly') THEN
    PERFORM cron.unschedule('ai-billing-hourly');
    RAISE NOTICE 'ai-billing-hourly: previous schedule removed';
  END IF;
END $$;

-- Every hour at minute 30 (offset from platform-metrics-hourly at :15)
SELECT cron.schedule(
  'ai-billing-hourly',
  '30 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ai-billing-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);

COMMIT;
