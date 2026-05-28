-- Tracking table for daily Flatfox sync runs.
--
-- Context: until now the sync ran fire-and-forget via pg_cron and had no
-- persistent observability. Audit of the last 14 days revealed that the sync
-- was effectively broken — averaging 1.7% of the inventory refreshed per run,
-- with 96% of UPSERTs returning 504 (Cloudflare gateway timeout) and the
-- sweep phase never completing. The only signal was in the API/edge logs,
-- which are kept ~24h and require manual querying.
--
-- This table records one row per sync run (started_at + final stats) so the
-- admin dashboard / cron tooling can detect dead or degraded runs and alert.
CREATE TABLE IF NOT EXISTS public.flatfox_sync_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  status           text NOT NULL DEFAULT 'running'
                   CHECK (status IN ('running', 'completed', 'failed', 'safety_skipped')),
  total_expected   integer,
  total_seen       integer DEFAULT 0,
  total_upserted   integer DEFAULT 0,
  total_errors     integer DEFAULT 0,
  total_removed    integer DEFAULT 0,
  chunks_completed integer DEFAULT 0,
  pages_fetched    integer DEFAULT 0,
  last_chunk_at    timestamptz,
  error_message    text,
  trigger_source   text DEFAULT 'cron'
);

-- Quick lookup of the most recent run + open ('running') runs
CREATE INDEX IF NOT EXISTS idx_flatfox_sync_runs_started_at
  ON public.flatfox_sync_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_flatfox_sync_runs_running
  ON public.flatfox_sync_runs (started_at DESC) WHERE status = 'running';

ALTER TABLE public.flatfox_sync_runs ENABLE ROW LEVEL SECURITY;

-- service_role only — admin/debug surface, no public reads.
CREATE POLICY "Service role full access on flatfox_sync_runs"
  ON public.flatfox_sync_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.flatfox_sync_runs IS
  'One row per Flatfox sync run. Written by the flatfox-sync edge function.';
