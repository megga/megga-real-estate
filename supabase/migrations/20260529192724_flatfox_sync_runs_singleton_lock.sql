-- Bulletproof concurrency lock: at most ONE flatfox_sync_runs row can be
-- status='running' at any time. A second concurrent INSERT (cron firing while
-- a manual run is active, double-fire, etc.) fails with 23505 unique_violation,
-- which the edge function treats as "another run active → abort".
--
-- This is the DB-level guarantee that prevents the parallel fan-out that
-- repeatedly exhausted the 60-connection pool and took the database down.
-- Already applied on production via Supabase MCP on 2026-05-29; this file
-- mirrors that DDL so migration history stays in sync. Idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS flatfox_sync_runs_one_running
  ON public.flatfox_sync_runs ((true))
  WHERE status = 'running';
