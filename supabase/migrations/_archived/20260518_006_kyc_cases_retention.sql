-- ============================================================================
-- Migration: KYC Cases Retention Lock (10-year retention enforcement)
-- Date: 2026-05-18
--
-- Fix critique compliance LBA art. 7 al. 3 (red-team finding Roger #11).
--
-- Le trigger `enforce_kyc_retention` existant (migration 20260411_001)
-- protège les `documents` liés à un kyc_case pendant 10 ans, MAIS
-- les `kyc_cases` eux-mêmes ne sont pas protégés. Conséquences :
--
--   1. Un agent peut DELETE un kyc_case avec la policy
--      `kyc_cases_delete FOR DELETE TO authenticated USING (agency_id = ...)`
--   2. ON DELETE CASCADE wipe les `kyc_checklist_items`
--   3. ON DELETE SET NULL sur `documents.kyc_case_id` rend les docs orphelins
--   4. Une fois `kyc_case_id IS NULL`, le trigger doc retention ne protège
--      plus le document (`enforce_kyc_retention` ne s'active que si
--      `OLD.kyc_case_id IS NOT NULL`)
--
-- Cette migration ferme la faille en miroir du trigger documents :
--   - Refuse DELETE sur kyc_cases pendant 10 ans depuis created_at
--   - Sauf super_admin (audit séparé)
--   - Log un AuditEvent severity='critical' à chaque tentative bloquée
--   - Log un AuditEvent severity='warn' à chaque suppression super_admin
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_kyc_cases_retention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_role TEXT;
  v_retention_until TIMESTAMPTZ;
BEGIN
  -- Calcule la date de fin de rétention (10 ans depuis création)
  v_retention_until := OLD.created_at + INTERVAL '10 years';

  -- Récupère le rôle de l'acteur (peut être NULL si service_role ou non-auth)
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = auth.uid();

  -- Si encore dans la fenêtre de rétention ET pas super_admin → refuser
  IF v_retention_until > NOW() AND COALESCE(v_user_role, '') <> 'super_admin' THEN
    -- Log la tentative bloquée pour audit FINMA
    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      OLD.agency_id,
      auth.uid(),
      'Tentative suppression dossier KYC bloquée',
      'kyc_case',
      OLD.id,
      'kyc',
      'critical',
      'Dossier ' || OLD.id::TEXT,
      jsonb_build_object(
        'reason', 'retention_period_active',
        'retention_until', v_retention_until::TEXT,
        'created_at', OLD.created_at::TEXT,
        'lba_article', 'art. 7 al. 3 (conservation 10 ans)',
        'attempted_by_role', COALESCE(v_user_role, 'unknown')
      )
    );

    RAISE EXCEPTION 'Suppression du dossier KYC interdite avant le %. Article 7 al. 3 LBA — conservation obligatoire 10 ans.',
      to_char(v_retention_until, 'DD.MM.YYYY');
  END IF;

  -- Si super_admin bypasse, log l'événement (rare, audit séparé)
  IF v_user_role = 'super_admin' AND v_retention_until > NOW() THEN
    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      OLD.agency_id,
      auth.uid(),
      'Suppression dossier KYC par super_admin (bypass rétention)',
      'kyc_case',
      OLD.id,
      'kyc',
      'warn',
      'Dossier ' || OLD.id::TEXT,
      jsonb_build_object(
        'reason', 'super_admin_override',
        'retention_until', v_retention_until::TEXT,
        'created_at', OLD.created_at::TEXT,
        'dossier_status', OLD.dossier_status,
        'sanctions_status', OLD.sanctions_status,
        'pep_status', OLD.pep_status
      )
    );
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_kyc_cases_retention ON kyc_cases;
CREATE TRIGGER trg_enforce_kyc_cases_retention
  BEFORE DELETE ON kyc_cases
  FOR EACH ROW
  EXECUTE FUNCTION enforce_kyc_cases_retention();

COMMENT ON FUNCTION enforce_kyc_cases_retention() IS
  'Trigger BEFORE DELETE kyc_cases. Refuse la suppression pendant 10 ans (LBA art. 7 al. 3). Miroir de enforce_kyc_retention sur documents. Bypass uniquement pour super_admin avec audit warn. Log critical sur tentative bloquée.';
