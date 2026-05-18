-- ============================================================================
-- pg_cron : reminder J-1 automatique pour les visites planifiées
-- Spec: supabase/functions/send-visit-email/index.ts type='reminder'
-- Created: 2026-05-18 (Tier 2 mail/calendar)
--
-- Toutes les heures, scanne les visites planifiées dans les 23-25h prochaines
-- qui n'ont pas encore reçu de reminder, et envoie un email + marque
-- reminder_sent=true.
--
-- Fenêtre 23-25h : large pour ne pas rater une visite si le cron a un retard
-- (le UNIQUE sur reminder_sent évite les doublons).
--
-- Idempotent : safe à réexécuter.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Supprime l'ancien job s'il existe (idempotence)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'visit-reminder-hourly') THEN
    PERFORM cron.unschedule('visit-reminder-hourly');
  END IF;
END $$;

-- Schedule : toutes les heures à xx:15 (décalé pour ne pas concurrencer
-- platform-metrics-hourly qui tourne à xx:00)
SELECT cron.schedule(
  'visit-reminder-hourly',
  '15 * * * *',
  $$
  WITH visits_to_remind AS (
    SELECT id, agency_id
    FROM visits
    WHERE status = 'planned'
      AND reminder_sent = false
      AND scheduled_at >= now() + interval '23 hours'
      AND scheduled_at <= now() + interval '25 hours'
      AND (buyer_email IS NOT NULL OR EXISTS (
        SELECT 1 FROM contacts WHERE contacts.id = visits.contact_id AND email IS NOT NULL
      ))
    LIMIT 100  -- safeguard : pas plus de 100 reminders par tour
  )
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-visit-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'type', 'reminder',
      'visit_id', vtr.id,
      'agency_id', vtr.agency_id
    )
  )
  FROM visits_to_remind vtr;
  $$
);

COMMIT;

-- ─── Activation manuelle requise ────────────────────────────────────────────
-- Avant que le cron fonctionne, exécuter UNE FOIS dans le SQL editor :
--   ALTER DATABASE postgres SET app.settings.supabase_url = 'https://eayczugyrvmtqnnmvjod.supabase.co';
--   ALTER DATABASE postgres SET app.settings.service_role_key = '<service_role_jwt>';
-- (déjà fait pour flatfox-sync — vérifier via SELECT current_setting('app.settings.supabase_url'))
