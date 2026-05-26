-- ============================================================================
-- Migration: KYC Validation Guards — Block auto-verify on sanctions/PEP match
-- Date: 2026-05-18
--
-- Fix critique compliance LBA (red-team finding V3-1) :
--
-- Le trigger `auto_verify_kyc_dossier` (migration 20260516_002) passe
-- automatiquement un dossier à `verified` dès que tous les checks
-- `is_required` sont cochés — SANS aucune vérification de
-- `sanctions_status` ni `pep_status`. Conséquence :
--
--   1. Un agent coche les 5 checks → dossier verified
--   2. Même si le screening Dilisense a retourné `sanctions_status='match'`
--      ou `pep_status='match'`, le dossier passe verified
--   3. La transaction est autorisée → violation LBA art. 9 (communication MROS)
--
-- Cette migration durcit le trigger pour :
--   (1) Refuser le passage à `verified` si match sanctions OU PEP
--   (2) Forcer `dossier_status='failed'` dans ce cas
--   (3) Logger un AuditEvent severity='critical' pour traçabilité FINMA
--   (4) Idem si `sanctions_status` ou `pep_status` est encore `pending`
--       (screening non terminé)
--
-- Article LBA : art. 7 al. 1 lit. b (vigilance documentée), art. 9
-- (communication MROS si soupçon de blanchiment).
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_verify_kyc_dossier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_remaining_required INTEGER;
  v_agency_id UUID;
  v_current_status TEXT;
  v_sanctions_status TEXT;
  v_pep_status TEXT;
  v_block_reason TEXT;
BEGIN
  -- Ne trigger QUE quand un check passe FALSE → TRUE
  IF NEW.is_completed IS NOT TRUE OR OLD.is_completed IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Récupère le contexte du dossier (agency + statut + screening)
  SELECT
    agency_id,
    dossier_status,
    sanctions_status,
    pep_status
  INTO
    v_agency_id,
    v_current_status,
    v_sanctions_status,
    v_pep_status
  FROM kyc_cases
  WHERE id = NEW.kyc_case_id;

  -- (a) AuditEvent : contrôle individuel validé
  INSERT INTO activity_events
    (agency_id, actor_id, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    v_agency_id,
    COALESCE(NEW.completed_by, auth.uid()),
    'Contrôle validé',
    'kyc_check',
    NEW.id,
    'kyc',
    'info',
    NEW.label,
    jsonb_build_object('category', NEW.category, 'kyc_case_id', NEW.kyc_case_id)
  );

  -- Reste-t-il des items REQUIRED non complétés ?
  SELECT COUNT(*) INTO v_remaining_required
  FROM kyc_checklist_items
  WHERE kyc_case_id = NEW.kyc_case_id
    AND is_required = TRUE
    AND is_completed = FALSE;

  IF v_remaining_required = 0 THEN
    -- GARDE-FOU CRITIQUE : refuser la validation auto si match
    -- sanctions/PEP ou si le screening n'est pas finalisé.
    v_block_reason := NULL;

    IF v_sanctions_status = 'match' THEN
      v_block_reason := 'sanctions_match';
    ELSIF v_pep_status = 'match' THEN
      v_block_reason := 'pep_match';
    ELSIF v_sanctions_status = 'pending' OR v_pep_status = 'pending' THEN
      v_block_reason := 'screening_pending';
    ELSIF v_sanctions_status IS NULL OR v_sanctions_status = 'not_checked'
       OR v_pep_status IS NULL OR v_pep_status = 'not_checked' THEN
      v_block_reason := 'screening_missing';
    END IF;

    IF v_block_reason IS NOT NULL THEN
      -- Bloquer : passer le dossier à 'failed' au lieu de 'verified',
      -- sauf s'il est déjà verified (cas legacy : on ne dégrade pas).
      UPDATE kyc_cases
      SET dossier_status = CASE
        WHEN v_block_reason IN ('sanctions_match', 'pep_match') THEN 'failed'
        ELSE 'pending'  -- screening en attente ou manquant : reste pending
      END
      WHERE id = NEW.kyc_case_id
        AND dossier_status NOT IN ('verified', 'failed');

      INSERT INTO activity_events
        (agency_id, actor_id, action, entity_type, entity_id,
         category, severity, object_label, metadata)
      VALUES (
        v_agency_id,
        COALESCE(NEW.completed_by, auth.uid()),
        'Validation KYC bloquée',
        'kyc_case',
        NEW.kyc_case_id,
        'kyc',
        'critical',
        'Dossier ' || NEW.kyc_case_id::TEXT,
        jsonb_build_object(
          'block_reason', v_block_reason,
          'sanctions_status', v_sanctions_status,
          'pep_status', v_pep_status,
          'checks_count', 5,
          'lba_article', CASE
            WHEN v_block_reason IN ('sanctions_match', 'pep_match') THEN 'art. 9 (MROS)'
            ELSE 'art. 7 (vigilance documentée)'
          END
        )
      );

      RETURN NEW;
    END IF;

    -- (c) Dossier complet ET screening clear → verified
    UPDATE kyc_cases
    SET dossier_status = 'verified',
        validated_at = NOW(),
        expires_at = NOW() + INTERVAL '12 months'
    WHERE id = NEW.kyc_case_id
      AND dossier_status <> 'verified';

    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      v_agency_id,
      COALESCE(NEW.completed_by, auth.uid()),
      'Dossier KYC validé',
      'kyc_case',
      NEW.kyc_case_id,
      'kyc',
      'info',
      'Dossier ' || NEW.kyc_case_id::TEXT,
      jsonb_build_object(
        'checks_count', 5,
        'sanctions_status', v_sanctions_status,
        'pep_status', v_pep_status,
        'expires_at', (NOW() + INTERVAL '12 months')::TEXT
      )
    );
  ELSIF v_current_status = 'none' THEN
    -- (b) Premier check coché → passe à pending
    UPDATE kyc_cases
    SET dossier_status = 'pending'
    WHERE id = NEW.kyc_case_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_verify_kyc_dossier() IS
  'Trigger AFTER UPDATE kyc_checklist_items. Passe le dossier à verified UNIQUEMENT si tous les checks requis sont cochés ET le screening sanctions/PEP est clear. Si match : passe à failed + AuditEvent critical (LBA art. 9). Si screening en attente : reste pending.';
