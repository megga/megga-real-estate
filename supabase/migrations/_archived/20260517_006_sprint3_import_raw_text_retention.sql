-- ============================================================================
-- Migration: Sprint 3 — Rétention rawText 90j (audit §A.7 / red-team A.2)
-- Date: 2026-05-17
--
-- Problème : un lead importé via MEGGA AI part d'un message libre (email,
-- SMS, WhatsApp). Ce message est PII (nom, contact, parfois plus). On veut :
--   1. en garder la trace pour audit / debug d'extraction (l'agent peut
--      revenir vérifier pourquoi l'IA a interprété 'tenant' au lieu de 'buyer')
--   2. mais PAS le conserver indéfiniment — nLPD art. 6 (minimisation) +
--      art. 8 (rétention proportionnée). 90 jours = compromis raisonnable :
--      au-delà, la donnée n'est plus utile au métier mais reste un risque.
--
-- Solution :
--   1. Colonne `contacts.import_raw_text` (TEXT, nullable) — stocke le message
--      original, PII redactée déjà appliquée côté Edge Function
--   2. Colonne `contacts.import_raw_text_received_at` — date de réception,
--      pour décompter les 90j
--   3. pg_cron job quotidien (05:00 UTC) qui passe import_raw_text à NULL
--      pour les rows reçues > 90 jours. L'event audit existant
--      ('Lead validé & créé') reste, lui, en rétention 10 ans LBA.
--
-- Audit alignment : la purge logge un AuditEvent agrégé par jour
-- (severity=info, action='Rétention rawText appliquée') avec metadata
-- = { rows_purged: N }.
--
-- Spec : RED_TEAM_SPRINT_3.md §A.2, AUDIT_SPRINT_3A.md §A.7.
-- ============================================================================

-- 1. Colonnes
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS import_raw_text TEXT,
  ADD COLUMN IF NOT EXISTS import_raw_text_received_at TIMESTAMPTZ;

COMMENT ON COLUMN contacts.import_raw_text IS
  'Sprint 3 (A.7) : message brut reçu lors de l''import lead IA (PII redactée côté serveur). Purgé à 90j par cron daily-import-raw-text-purge.';
COMMENT ON COLUMN contacts.import_raw_text_received_at IS
  'Sprint 3 (A.7) : date de réception du rawText. Sert au décompte des 90j de rétention.';

-- Index partiel pour scan efficace par le cron (seules les rows à purger nous intéressent).
CREATE INDEX IF NOT EXISTS idx_contacts_import_raw_text_expiry
  ON contacts (import_raw_text_received_at)
  WHERE import_raw_text IS NOT NULL;

-- 2. Fonction de purge — peut être appelée manuellement OU par le cron.
CREATE OR REPLACE FUNCTION purge_expired_import_raw_text()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_purged_count INTEGER;
BEGIN
  UPDATE contacts
  SET import_raw_text = NULL,
      import_raw_text_received_at = NULL
  WHERE import_raw_text IS NOT NULL
    AND import_raw_text_received_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_purged_count = ROW_COUNT;

  -- AuditEvent agrégé (uniquement si du travail réel a été fait)
  IF v_purged_count > 0 THEN
    INSERT INTO activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      NULL,
      NULL,
      'system',
      'Rétention rawText appliquée',
      'contact',
      NULL,
      'settings',
      'info',
      'Purge automatique 90j',
      jsonb_build_object('rows_purged', v_purged_count, 'cutoff_days', 90)
    );
  END IF;

  RETURN v_purged_count;
END;
$$;

COMMENT ON FUNCTION purge_expired_import_raw_text() IS
  'Sprint 3 (A.7) : purge le rawText (import lead IA) après 90 jours. Retourne le nombre de rows touchées. Loggue un AuditEvent agrégé si > 0.';

-- 3. pg_cron job — quotidien 05:00 UTC (post-flatfox 04:00 + cantonal-medians 04:30)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'import-raw-text-purge-daily')
  THEN
    PERFORM cron.schedule(
      'import-raw-text-purge-daily',
      '0 5 * * *',
      'SELECT purge_expired_import_raw_text()'
    );
  END IF;
END;
$$;
