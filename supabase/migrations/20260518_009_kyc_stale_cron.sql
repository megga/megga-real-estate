-- ============================================================================
-- Migration: KYC pg_cron — Stale Detection Daily (Sprint 3)
-- Date: 2026-05-18
--
-- Fix red-team Marc #5 : pas de re-screening automatique.
--
-- La migration sprint1 (20260516_002) faisait un UPDATE one-shot pour
-- passer les dossiers verified > 12 mois en stale. Mais aucun job récurrent
-- → les dossiers verified aujourd'hui ne deviennent jamais stale demain.
--
-- Cette migration installe un pg_cron daily qui :
--   1. Passe les dossiers verified avec expires_at < NOW() en stale
--   2. Log un AuditEvent severity='warn' pour chaque passage
--
-- Le re-screening Dilisense complet (appel HTTP) reste manuel pour l'instant
-- — l'agent voit "stale" dans l'UI et clique sur "Re-screener" (déjà branché
-- au Sprint 1). Une étape future serait un job HTTP batch qui appelle
-- l'Edge function kyc-screening en boucle.
--
-- Horaire choisi : 02:30 UTC (avant flatfox-sync à 04:00 et cantonal-medians
-- à 04:30 — ne crée pas de pic charge cumulé).
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_stale_kyc_dossiers()
RETURNS TABLE (id UUID)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT k.id, k.agency_id, k.expires_at
    FROM kyc_cases k
    WHERE k.dossier_status = 'verified'
      AND k.expires_at IS NOT NULL
      AND k.expires_at < NOW()
  LOOP
    UPDATE kyc_cases
    SET dossier_status = 'stale'
    WHERE id = v_rec.id;

    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata, actor_kind)
    VALUES (
      v_rec.agency_id,
      NULL,
      'Dossier KYC passé en stale (re-screening requis)',
      'kyc_case',
      v_rec.id,
      'kyc',
      'warn',
      'Dossier ' || v_rec.id::TEXT,
      jsonb_build_object(
        'expired_at', v_rec.expires_at::TEXT,
        'lba_article', 'art. 7a (mise à jour des informations)',
        'next_action', 'Re-screener Dilisense manuellement'
      ),
      'system'
    );

    id := v_rec.id;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION mark_stale_kyc_dossiers() IS
  'Sprint 3 (Marc #5) : passe les dossiers verified expirés en stale et logge l''event. Appelé daily par pg_cron kyc-stale-daily.';

-- ─── pg_cron daily 02:30 UTC ───────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Drop l'éventuel job existant pour idempotence
    PERFORM cron.unschedule('kyc-stale-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kyc-stale-daily');

    PERFORM cron.schedule(
      'kyc-stale-daily',
      '30 2 * * *',
      $cron$SELECT mark_stale_kyc_dossiers();$cron$
    );
  END IF;
END;
$$;
