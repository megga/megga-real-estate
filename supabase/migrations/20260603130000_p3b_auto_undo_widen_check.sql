-- Palier 3b. (1) Élargit le CHECK tool de whatsapp_recent_auto_actions aux 4 outils auto
-- désormais annulables (en plus de update_pipeline ; add_note exclu — activity_events est
-- append-only LBA art.7). DROP IF EXISTS + ADD = idempotent.
-- (2) Index couvrant INCLUDE(outcome) sur whatsapp_confirmation_log pour la RPC de suggestion.
-- (3) Purge cron quotidien (>7 j) de la table d'undo (dette P3 ; pas de FK).

BEGIN;

ALTER TABLE public.whatsapp_recent_auto_actions
  DROP CONSTRAINT IF EXISTS whatsapp_recent_auto_actions_tool_check;
ALTER TABLE public.whatsapp_recent_auto_actions
  ADD CONSTRAINT whatsapp_recent_auto_actions_tool_check
  CHECK (tool IN ('update_pipeline','create_contact','schedule_visit','create_reminder','qualify_lead'));

CREATE INDEX IF NOT EXISTS idx_wa_confirmation_log_profile_tool_outcome
  ON public.whatsapp_confirmation_log (profile_id, tool)
  INCLUDE (outcome, created_at);

COMMIT;

-- Purge cron 7 j (mirror du pattern whatsapp-async-jobs-purge-daily ; cron.schedule = upsert par nom).
BEGIN;
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'whatsapp-recent-auto-actions-purge', '30 4 * * *',
      $cron$ DELETE FROM public.whatsapp_recent_auto_actions WHERE created_at < now() - interval '7 days'; $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — whatsapp-recent-auto-actions-purge non planifié';
  END IF;
END
$do$;
COMMIT;
