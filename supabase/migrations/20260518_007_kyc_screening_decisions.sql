-- ============================================================================
-- Migration: KYC Screening Decisions — Workflow décision compliance
-- Date: 2026-05-18
--
-- Fix critique compliance LBA (red-team finding Marc #2, Roger #6, Léa #11).
--
-- Aujourd'hui, quand Dilisense renvoie un match sanctions/PEP, aucun moyen
-- pour le compliance officer de documenter sa décision :
--   - "Faux positif" → on devrait pouvoir débloquer après examen
--   - "Vrai match" → SAR / MROS obligatoire
--   - "À investiguer" → en attente d'éléments
--
-- Sans cette table, le système est binaire (clear/match) et le verrou auto
-- du trigger `auto_verify_kyc_dossier` (migration 20260518_005) bloque
-- définitivement les faux positifs. La FINMA exige aussi de documenter la
-- diligence (LBA art. 7 al. 1 lit. b — "conclusions de la vigilance").
--
-- Cette migration :
--   1. Crée la table `kyc_screening_decisions` (append-only, immutable)
--   2. Snapshot du screening au moment de la décision (preuve gelée)
--   3. RLS strict : agency-scoped, INSERT only (pas d'UPDATE ni DELETE)
--   4. Trigger AuditEvent severity=critical à chaque insertion
--   5. Modifie `auto_verify_kyc_dossier` : autorise verified si une
--      décision 'false_positive' couvre le match courant
-- ============================================================================

-- ============================================================================
-- 1. TABLE kyc_screening_decisions
-- ============================================================================

CREATE TABLE IF NOT EXISTS kyc_screening_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  kyc_case_id UUID NOT NULL REFERENCES kyc_cases(id) ON DELETE CASCADE,

  -- Cible de la décision : sur quel statut le compliance officer s'est prononcé
  decision_target TEXT NOT NULL
    CHECK (decision_target IN ('sanctions', 'pep')),

  -- Verdict de l'examen humain
  decision TEXT NOT NULL
    CHECK (decision IN ('false_positive', 'true_match', 'escalated', 'awaiting_evidence')),

  -- Justification écrite OBLIGATOIRE (LBA art. 7 — documentation diligence)
  justification TEXT NOT NULL CHECK (length(justification) >= 30),

  -- Qui a décidé (humain authentifié, jamais service_role)
  decided_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Snapshot gelé du screening au moment de la décision (preuve immuable)
  -- Doit inclure : pep_status, pep_details, sanctions_status, sanctions_details,
  -- risk_score, risk_factors, last_screening_at au moment T de la décision.
  screening_snapshot JSONB NOT NULL,

  -- Si une re-décision écrase une précédente (rare, à justifier)
  supersedes_id UUID REFERENCES kyc_screening_decisions(id) ON DELETE SET NULL
);

COMMENT ON TABLE kyc_screening_decisions IS
  'Workflow décision compliance LBA : documente les conclusions humaines sur chaque match Dilisense. Append-only, immuable, conservation 10 ans (alignement art. 7 al. 3).';
COMMENT ON COLUMN kyc_screening_decisions.decision_target IS
  'sanctions OU pep — un dossier peut avoir 2 décisions (une par cible).';
COMMENT ON COLUMN kyc_screening_decisions.decision IS
  'false_positive = débloque verified · true_match = SAR/MROS · escalated = direction · awaiting_evidence = pause.';
COMMENT ON COLUMN kyc_screening_decisions.justification IS
  'LBA art. 7 al. 1 lit. b — texte libre minimum 30 caractères. Conservé 10 ans.';
COMMENT ON COLUMN kyc_screening_decisions.screening_snapshot IS
  'Copie immuable de pep_details + sanctions_details + risk_factors au moment T. Permet de prouver à FINMA sur quoi reposait la décision même si Dilisense répond différemment plus tard.';

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_kyc_screening_decisions_case
  ON kyc_screening_decisions (kyc_case_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_kyc_screening_decisions_agency
  ON kyc_screening_decisions (agency_id, decided_at DESC);

-- ============================================================================
-- 3. RLS — agency-scoped, append-only
-- ============================================================================

ALTER TABLE kyc_screening_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_screening_decisions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kyc_screening_decisions_select ON kyc_screening_decisions;
CREATE POLICY kyc_screening_decisions_select
  ON kyc_screening_decisions FOR SELECT
  TO authenticated
  USING (agency_id = get_my_agency_id());

DROP POLICY IF EXISTS kyc_screening_decisions_insert ON kyc_screening_decisions;
CREATE POLICY kyc_screening_decisions_insert
  ON kyc_screening_decisions FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id = get_my_agency_id()
    AND decided_by = auth.uid()
  );

-- PAS de policy UPDATE / DELETE : table append-only.
-- Seul super_admin (via service_role) peut corriger en cas d'erreur.

-- ============================================================================
-- 4. TRIGGER — AuditEvent severity=critical à chaque décision
-- ============================================================================

CREATE OR REPLACE FUNCTION log_kyc_screening_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO activity_events
    (agency_id, actor_id, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    NEW.agency_id,
    NEW.decided_by,
    'Décision compliance ' || NEW.decision_target || ' : ' || NEW.decision,
    'kyc_case',
    NEW.kyc_case_id,
    'kyc',
    'critical',
    'Dossier ' || NEW.kyc_case_id::TEXT,
    jsonb_build_object(
      'decision_id', NEW.id,
      'decision', NEW.decision,
      'decision_target', NEW.decision_target,
      'justification_length', length(NEW.justification),
      'supersedes_id', NEW.supersedes_id,
      'lba_article', 'art. 7 al. 1 lit. b'
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_kyc_screening_decision ON kyc_screening_decisions;
CREATE TRIGGER trg_log_kyc_screening_decision
  AFTER INSERT ON kyc_screening_decisions
  FOR EACH ROW
  EXECUTE FUNCTION log_kyc_screening_decision();

-- ============================================================================
-- 5. RPC — récupérer la dernière décision effective par target
-- ============================================================================
-- Une dossier peut avoir N décisions historiques. La "courante" est la plus
-- récente par decision_target qui n'a pas été supersedée.

CREATE OR REPLACE FUNCTION kyc_latest_screening_decision(
  p_kyc_case_id UUID,
  p_target TEXT  -- 'sanctions' ou 'pep'
)
RETURNS TABLE (
  id UUID,
  decision TEXT,
  justification TEXT,
  decided_by UUID,
  decided_at TIMESTAMPTZ
)
LANGUAGE sql STABLE
SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT d.id, d.decision, d.justification, d.decided_by, d.decided_at
  FROM kyc_screening_decisions d
  WHERE d.kyc_case_id = p_kyc_case_id
    AND d.decision_target = p_target
    AND d.agency_id = get_my_agency_id()
    AND NOT EXISTS (
      SELECT 1 FROM kyc_screening_decisions d2
      WHERE d2.supersedes_id = d.id
        AND d2.agency_id = get_my_agency_id()
    )
  ORDER BY d.decided_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION kyc_latest_screening_decision(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION kyc_latest_screening_decision(UUID, TEXT) IS
  'Retourne la décision compliance la plus récente pour un dossier/cible donné, en excluant les décisions supersedées. Utilisé par le hook useKycScreeningDecisions.';

-- ============================================================================
-- 6. MAJ auto_verify_kyc_dossier — autorise verified si false_positive enregistré
-- ============================================================================
-- Si le compliance officer a documenté une décision 'false_positive' sur le
-- target qui matche, le trigger n'est plus bloquant. Tout autre verdict
-- (true_match, escalated, awaiting_evidence) maintient le blocage.

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
  v_sanctions_decision TEXT;
  v_pep_decision TEXT;
BEGIN
  -- Ne trigger QUE quand un check passe FALSE → TRUE
  IF NEW.is_completed IS NOT TRUE OR OLD.is_completed IS TRUE THEN
    RETURN NEW;
  END IF;

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

  SELECT COUNT(*) INTO v_remaining_required
  FROM kyc_checklist_items
  WHERE kyc_case_id = NEW.kyc_case_id
    AND is_required = TRUE
    AND is_completed = FALSE;

  IF v_remaining_required = 0 THEN
    -- Récupère les décisions compliance les plus récentes (non supersedées)
    SELECT decision INTO v_sanctions_decision
    FROM kyc_screening_decisions d
    WHERE d.kyc_case_id = NEW.kyc_case_id
      AND d.decision_target = 'sanctions'
      AND NOT EXISTS (
        SELECT 1 FROM kyc_screening_decisions d2
        WHERE d2.supersedes_id = d.id
      )
    ORDER BY d.decided_at DESC LIMIT 1;

    SELECT decision INTO v_pep_decision
    FROM kyc_screening_decisions d
    WHERE d.kyc_case_id = NEW.kyc_case_id
      AND d.decision_target = 'pep'
      AND NOT EXISTS (
        SELECT 1 FROM kyc_screening_decisions d2
        WHERE d2.supersedes_id = d.id
      )
    ORDER BY d.decided_at DESC LIMIT 1;

    v_block_reason := NULL;

    -- Match sanctions : bloqué SAUF si décision false_positive documentée
    IF v_sanctions_status = 'match' AND COALESCE(v_sanctions_decision, '') <> 'false_positive' THEN
      v_block_reason := CASE
        WHEN v_sanctions_decision IS NULL THEN 'sanctions_match_undecided'
        ELSE 'sanctions_match_' || v_sanctions_decision
      END;
    -- Match PEP : idem
    ELSIF v_pep_status = 'match' AND COALESCE(v_pep_decision, '') <> 'false_positive' THEN
      v_block_reason := CASE
        WHEN v_pep_decision IS NULL THEN 'pep_match_undecided'
        ELSE 'pep_match_' || v_pep_decision
      END;
    ELSIF v_sanctions_status = 'pending' OR v_pep_status = 'pending' THEN
      v_block_reason := 'screening_pending';
    ELSIF v_sanctions_status IS NULL OR v_sanctions_status = 'not_checked'
       OR v_pep_status IS NULL OR v_pep_status = 'not_checked' THEN
      v_block_reason := 'screening_missing';
    END IF;

    IF v_block_reason IS NOT NULL THEN
      UPDATE kyc_cases
      SET dossier_status = CASE
        WHEN v_block_reason LIKE 'sanctions_match%' OR v_block_reason LIKE 'pep_match%' THEN 'failed'
        ELSE 'pending'
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
          'sanctions_decision', v_sanctions_decision,
          'pep_decision', v_pep_decision,
          'lba_article', CASE
            WHEN v_block_reason LIKE 'sanctions_match%' OR v_block_reason LIKE 'pep_match%' THEN 'art. 9 (MROS)'
            ELSE 'art. 7 (vigilance documentée)'
          END
        )
      );

      RETURN NEW;
    END IF;

    -- Tout est OK (clear OU décision false_positive documentée) → verified
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
        'sanctions_decision', v_sanctions_decision,
        'pep_decision', v_pep_decision,
        'expires_at', (NOW() + INTERVAL '12 months')::TEXT
      )
    );
  ELSIF v_current_status = 'none' THEN
    UPDATE kyc_cases
    SET dossier_status = 'pending'
    WHERE id = NEW.kyc_case_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_verify_kyc_dossier() IS
  'Trigger AFTER UPDATE kyc_checklist_items. Passe verified UNIQUEMENT si tous les checks requis ET screening clear OU décision false_positive documentée (table kyc_screening_decisions). Match sans décision OU avec décision true_match/escalated/awaiting_evidence → failed + AuditEvent critical.';
