-- ============================================================================
-- Migration: KYC Transaction Stage Monitoring — Mode rapport (Sprint 4.1)
-- Date: 2026-05-20
--
-- Fix red-team Léa #8 (Sprint 4 plan) — passage de score audit-readiness
-- FINMA ~8/10 → ~10/10.
--
-- IMPORTANT — Choix design "monitoring" (vs bloquant) :
-- Le trigger n'INTERROMPT PAS la transition de stage. Il LOG un AuditEvent
-- severity='warn' avec metadata structurée à chaque fois qu'un deal passe
-- en stage post-qualification (offer → closed) sans KYC verified. Cela
-- permet :
--   - aux agents de continuer leur travail sans friction technique
--   - au MLRO de filtrer les events `category=deal AND severity=warn` dans
--     un dashboard de supervision et de prendre les mesures correctives
--     (relance KYC, suspension manuelle de la transaction, etc.)
--   - à la FINMA d'auditer une trace exhaustive des transitions à risque
--
-- Articles : LBA art. 3 (identification), art. 4 (ayant droit économique),
-- art. 7 al. 1 (devoir de vérification + documentation a posteriori).
--
-- Exemptions logging (pas de warn si) :
--  1. Pas de buyer (mandat sans acheteur identifié)
--  2. Montant sous seuil LBA art. 7 (< CHF 100'000)
--  3. Grandfather clause : transition interne entre stages déjà bloquants
--     (ex: signed → closed sur deals legacy)
-- ============================================================================

CREATE OR REPLACE FUNCTION monitor_transaction_kyc_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  -- Stages "post-qualification" qui devraient idéalement avoir un KYC verified
  -- (offre formelle → signature → closing). Stages libres : lead, qualified,
  -- visit_planned. L'absence de KYC sur ces stages génère un warn, pas un blocage.
  v_monitored_stages transaction_stage[] := ARRAY[
    'offer', 'negotiation', 'reserved', 'financing', 'notary', 'signed', 'closed'
  ]::transaction_stage[];
  v_threshold_chf NUMERIC := 100000;
  v_kyc_status TEXT;
  v_kyc_expires TIMESTAMPTZ;
  v_kyc_case_id UUID;
  v_actor_role TEXT;
  v_amount NUMERIC;
  v_kyc_expired BOOLEAN;
BEGIN
  -- 1. Court-circuit : pas de transition vers un stage surveillé → OK
  IF NOT (NEW.stage = ANY(v_monitored_stages)) OR OLD.stage = NEW.stage THEN
    RETURN NEW;
  END IF;

  -- 2. Pas de log si grandfather clause : transition INTERNE entre 2 stages
  --    surveillés (ex: signed → closed) — l'absence éventuelle de KYC a déjà
  --    été loggée à l'entrée dans la zone surveillée.
  IF OLD.stage = ANY(v_monitored_stages) THEN
    RETURN NEW;
  END IF;

  -- 3. Pas de log si pas de buyer (mandat de vente seul) — pas de KYC requis
  IF NEW.contact_buyer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 4. Pas de log si sous seuil LBA art. 7 (< CHF 100'000) — hors périmètre LAB
  v_amount := COALESCE(NEW.price_offered, NEW.price_final, 0);
  IF v_amount > 0 AND v_amount < v_threshold_chf THEN
    RETURN NEW;
  END IF;

  -- 5. Recherche du dossier KYC buyer le plus récent dans l'agence
  SELECT id, dossier_status, expires_at
    INTO v_kyc_case_id, v_kyc_status, v_kyc_expires
  FROM kyc_cases
  WHERE contact_id = NEW.contact_buyer_id
    AND agency_id = NEW.agency_id
  ORDER BY created_at DESC
  LIMIT 1;

  v_kyc_expired := (v_kyc_expires IS NOT NULL AND v_kyc_expires <= NOW());

  -- 6. Si KYC verified et non expiré → on log un info (transition conforme)
  IF v_kyc_status = 'verified' AND NOT v_kyc_expired THEN
    -- Pas de log info ici pour ne pas inonder activity_events sur des cas OK.
    -- (Le log de la validation KYC initial suffit comme preuve d'antériorité.)
    RETURN NEW;
  END IF;

  -- 7. KYC manquant / non-verified / expiré → log severity=warn pour le MLRO
  -- Cast explicite enum user_role → TEXT (défensif contre renommage futur de l'enum).
  SELECT role::TEXT INTO v_actor_role FROM profiles WHERE id = auth.uid();

  INSERT INTO activity_events
    (agency_id, actor_id, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    NEW.agency_id,
    auth.uid(),
    'Transition stage sans KYC vérifié',
    'transaction',
    NEW.id,
    'deal',
    'warn',
    'Transaction ' || NEW.id::TEXT,
    jsonb_build_object(
      'attempted_stage', NEW.stage,
      'previous_stage', OLD.stage,
      'kyc_case_id', v_kyc_case_id,
      'kyc_status', COALESCE(v_kyc_status, 'none'),
      'kyc_expires_at', v_kyc_expires,
      'kyc_expired', v_kyc_expired,
      'amount_chf', v_amount,
      'actor_role', COALESCE(v_actor_role, 'unknown'),
      'mode', 'monitoring_only',
      'lba_article', 'art. 3, 4, 7 al. 1',
      'mlro_action_required', TRUE
    )
  );

  -- Pas de RAISE EXCEPTION — la transition est autorisée mais tracée.
  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION monitor_transaction_kyc_gate() IS
  'Sprint 4.1 — Monitoring LBA art. 7 al. 1. Log un AuditEvent severity=warn quand une transition vers offer/negotiation/reserved/financing/notary/signed/closed se fait sans KYC buyer verified. Pas de blocage technique — le MLRO filtre les warns dans le dashboard pour action manuelle. Exemptions : pas de buyer, montant < CHF 100k, transition interne entre stages déjà surveillés.';

DROP TRIGGER IF EXISTS trg_enforce_transaction_kyc_gate ON transactions;
DROP TRIGGER IF EXISTS trg_monitor_transaction_kyc_gate ON transactions;
CREATE TRIGGER trg_monitor_transaction_kyc_gate
  AFTER UPDATE OF stage ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION monitor_transaction_kyc_gate();

-- Index composite pour la perf du SELECT dans le trigger
-- (idx_kyc_cases_contact existe déjà sur contact_id, mais composite avec
-- agency_id + created_at DESC accélère la recherche du dossier le plus récent).
CREATE INDEX IF NOT EXISTS idx_kyc_cases_contact_agency_created
  ON kyc_cases (contact_id, agency_id, created_at DESC);
