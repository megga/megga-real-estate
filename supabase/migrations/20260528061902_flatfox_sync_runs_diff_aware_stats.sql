-- Split the `total_upserted` bucket in flatfox_sync_runs into three so we
-- can tell from the dashboard how the diff-aware UPSERT path is working:
--
--   inserted = new rows (source_id never seen before)
--   updated  = existing rows whose significant fields changed (full UPSERT)
--   touched  = existing rows with no significant change (cheap UPDATE of
--              last_seen_at only — the optimization that makes the chain
--              actually complete)
--
-- `total_upserted` is kept and now means `inserted + updated` (real writes
-- of the full row). The dashboard / queries can compute a no-op ratio as
-- `touched / (touched + upserted)` to monitor the optimization's payoff.
ALTER TABLE public.flatfox_sync_runs
  ADD COLUMN IF NOT EXISTS total_inserted integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_updated  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_touched  integer DEFAULT 0;
