-- ============================================================================
-- Migration: Sprint 1 — KYC LBA + nLPD Audit
-- Date: 2026-05-16
--
-- Couvre les 6 livrables Sprint 1 côté data layer :
--  1. Étend `kyc_cases` pour matcher KYCDossier (handoff §Modèle de données) :
--     vigilance ('standard'|'renforced'), expires_at (verifiedAt + 12 mois),
--     dossier_status (5 valeurs : none|pending|verified|stale|failed).
--  2. Trigger AFTER INSERT : seed les 5 contrôles LBA standards
--     (id / address / pep / sanctions / funds) avec is_required dérivé
--     du couple vigilance + transaction_amount (CHF 100'000 seuil LBA).
--  3. Trigger AFTER UPDATE sur kyc_checklist_items :
--     - log AuditEvent 'Contrôle validé' (info) à chaque coche
--     - quand tous les is_required complétés → dossier_status='verified',
--       validated_at=now(), expires_at=now()+12 mois
--     - log AuditEvent 'Dossier KYC validé' (info)
--  4. Étend `activity_events` pour AuditEvent nLPD :
--     severity ('info'|'warn'|'critical'), category (8 valeurs handoff),
--     object_label (libellé humain), ip_address (traçabilité auth).
--     Append-only déjà garanti par RLS existante (003_rls_policies.sql) :
--     pas de policy UPDATE/DELETE pour les agents — seul service_role
--     peut anonymiser via la fonction delete-account (preuves préservées
--     LBA art. 7 al. 3 = conservation 10 ans).
--  5. Index audit pour filtres journal nLPD (agency + date + cat + sev).
--  6. Helpers RPC : kyc_by_contact_id, kyc_count_by_status.
--
-- Spec : docs/handoff/sprint-1-kyc/HANDOFF_SPRINT_1_CLAUDE_CODE.md
-- Enrichissements : docs/handoff/sprint-1-kyc/KYC_ENRICHISSEMENTS.md
-- ============================================================================

-- ============================================================================
-- 1. EXTENSION kyc_cases — KYCDossier handoff fields
-- ============================================================================

ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS vigilance TEXT
  CHECK (vigilance IN ('standard', 'renforced'))
  DEFAULT 'standard';

ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS dossier_status TEXT
  CHECK (dossier_status IN ('none', 'pending', 'verified', 'stale', 'failed'))
  DEFAULT 'none';

COMMENT ON COLUMN kyc_cases.vigilance IS
  'LBA art. 3-4 (standard) vs art. 6 (renforced). Source : KYCDossier handoff.';
COMMENT ON COLUMN kyc_cases.expires_at IS
  'verifiedAt + 12 mois. Déclenche re-screening (dossier_status passe à stale).';
COMMENT ON COLUMN kyc_cases.dossier_status IS
  'Statut dossier 5 valeurs (handoff §Modèle de données). Distinct du legacy status (kyc_status enum).';

-- ============================================================================
-- 2. SEED 5 CONTRÔLES LBA À LA CRÉATION D'UN DOSSIER
-- ============================================================================
-- À chaque INSERT INTO kyc_cases, on crée automatiquement 5 entrées dans
-- kyc_checklist_items avec les catégories handoff : id, address, pep,
-- sanctions, funds. La règle métier sur is_required :
--   - id, address, pep, sanctions     → TOUJOURS requis (LBA art. 3-5)
--   - funds                            → requis SI vigilance='renforced'
--                                        OR transaction_amount > CHF 100'000
--                                        (LBA art. 6 al. 1 lit. b)

CREATE OR REPLACE FUNCTION seed_kyc_lba_checks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO kyc_checklist_items (kyc_case_id, label, category, is_required)
  VALUES
    (NEW.id, 'Pièce d''identité',         'id',        TRUE),
    (NEW.id, 'Justificatif de domicile',  'address',   TRUE),
    (NEW.id, 'Screening PEP',             'pep',       TRUE),
    (NEW.id, 'Listes de sanctions',       'sanctions', TRUE),
    (NEW.id, 'Source des fonds',          'funds',
      NEW.vigilance = 'renforced'
      OR COALESCE(NEW.transaction_amount, 0) > 100000);

  -- AuditEvent : Dossier KYC ouvert (handoff §7 KYC_ENRICHISSEMENTS)
  INSERT INTO activity_events
    (agency_id, actor_id, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    NEW.agency_id,
    auth.uid(),
    'Dossier KYC ouvert',
    'kyc_case',
    NEW.id,
    'kyc',
    'info',
    'Dossier ' || NEW.id::TEXT,
    jsonb_build_object(
      'vigilance', NEW.vigilance,
      'type', NEW.type,
      'risk_level', NEW.risk_level
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_kyc_lba_checks ON kyc_cases;
CREATE TRIGGER trg_seed_kyc_lba_checks
  AFTER INSERT ON kyc_cases
  FOR EACH ROW
  EXECUTE FUNCTION seed_kyc_lba_checks();

-- ============================================================================
-- 3. AUTO-VALIDATION DOSSIER — Trigger UPDATE sur kyc_checklist_items
-- ============================================================================
-- Quand un check passe is_completed=TRUE :
--  (a) Log AuditEvent 'Contrôle validé' severity 'info'
--  (b) Si premier check du dossier (status='none') → passe à 'pending'
--  (c) Si tous les checks requis sont complétés → 'verified' + 12 mois
--      + AuditEvent 'Dossier KYC validé' severity 'info'

CREATE OR REPLACE FUNCTION auto_verify_kyc_dossier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_remaining_required INTEGER;
  v_agency_id UUID;
  v_current_status TEXT;
BEGIN
  -- Ne trigger QUE quand un check passe FALSE → TRUE
  IF NEW.is_completed IS NOT TRUE OR OLD.is_completed IS TRUE THEN
    RETURN NEW;
  END IF;

  -- (a) AuditEvent : contrôle individuel validé
  SELECT agency_id, dossier_status INTO v_agency_id, v_current_status
  FROM kyc_cases WHERE id = NEW.kyc_case_id;

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
    -- (c) Dossier complet → verified
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

DROP TRIGGER IF EXISTS trg_auto_verify_kyc_dossier ON kyc_checklist_items;
CREATE TRIGGER trg_auto_verify_kyc_dossier
  AFTER UPDATE ON kyc_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_verify_kyc_dossier();

-- ============================================================================
-- 4. EXTENSION activity_events — AuditEvent nLPD fields
-- ============================================================================

ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS severity TEXT
  CHECK (severity IN ('info', 'warn', 'critical'))
  DEFAULT 'info';

ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS category TEXT
  CHECK (category IN ('kyc', 'deal', 'contact', 'bien', 'doc', 'auth', 'settings', 'ai'));

ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS object_label TEXT;

ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS ip_address TEXT;

COMMENT ON COLUMN activity_events.severity IS
  'AuditEvent nLPD severity. Handoff §1 — warn pour passage outre verrou KYC, critical pour stage=signed ou échec auth.';
COMMENT ON COLUMN activity_events.category IS
  'AuditEvent nLPD category. Handoff §Modèle de données : kyc/deal/contact/bien/doc/auth/settings/ai.';
COMMENT ON COLUMN activity_events.object_label IS
  'Libellé humain de l''objet ciblé (handoff : object.label). Ex: "Marie Bertrand · Eaux-Vives 4p".';
COMMENT ON COLUMN activity_events.ip_address IS
  'Adresse IP de l''acteur (nullable pour acteurs système).';

-- ============================================================================
-- 4bis. DATA SYNC LEGACY → NOUVEAU VOCABULAIRE
-- ============================================================================
-- Les dossiers KYC créés avant Sprint 1 ont `status` (enum kyc_status) mais
-- `dossier_status` au DEFAULT 'none'. On synchronise pour que la liste KYC
-- Sugar v3 reflète l'état réel des dossiers legacy :
--   validated  → verified  + populate expires_at = validated_at + 12 mois
--   rejected   → failed
--   pending / in_progress / review → pending
-- Idempotent : ne touche que les rows où dossier_status = 'none' (default).

UPDATE kyc_cases
SET dossier_status = CASE
  WHEN status = 'validated' THEN 'verified'
  WHEN status = 'rejected'  THEN 'failed'
  WHEN status IN ('pending', 'in_progress', 'review') THEN 'pending'
  ELSE 'none'
END
WHERE dossier_status = 'none' AND status IS NOT NULL;

UPDATE kyc_cases
SET expires_at = validated_at + INTERVAL '12 months'
WHERE dossier_status = 'verified'
  AND expires_at IS NULL
  AND validated_at IS NOT NULL;

-- Dossiers vérifiés > 12 mois → automatiquement marqués stale
UPDATE kyc_cases
SET dossier_status = 'stale'
WHERE dossier_status = 'verified'
  AND expires_at IS NOT NULL
  AND expires_at < NOW();

-- ============================================================================
-- 5. INDEX AUDIT — filtres journal nLPD
-- ============================================================================
-- Optimise les requêtes du journal d'audit (agency + date + cat + severity).
-- L'écran AudFilters filtre principalement sur ces 4 colonnes.

CREATE INDEX IF NOT EXISTS idx_activity_events_audit_filters
  ON activity_events (agency_id, created_at DESC, category, severity);

-- ============================================================================
-- 6. RPC HELPERS — kyc service côté front
-- ============================================================================

-- kyc_by_contact_id(contact_id) → KYCDossier + checks_total + checks_completed
-- Utilisé par : useKycDossierByContact (deep-link, CtKyc, CdKycCard)
CREATE OR REPLACE FUNCTION kyc_by_contact_id(p_contact_id UUID)
RETURNS TABLE (
  id UUID,
  agency_id UUID,
  contact_id UUID,
  transaction_id UUID,
  type kyc_person_type,
  risk_level kyc_risk_level,
  risk_score INTEGER,
  dossier_status TEXT,
  vigilance TEXT,
  validated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  pep_status TEXT,
  sanctions_status TEXT,
  last_screening_at TIMESTAMPTZ,
  checks_total INTEGER,
  checks_completed INTEGER
)
LANGUAGE sql STABLE
SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT
    k.id, k.agency_id, k.contact_id, k.transaction_id, k.type, k.risk_level, k.risk_score,
    k.dossier_status, k.vigilance, k.validated_at, k.expires_at, k.created_at,
    k.pep_status, k.sanctions_status, k.last_screening_at,
    (SELECT COUNT(*)::INT FROM kyc_checklist_items WHERE kyc_case_id = k.id)::INT AS checks_total,
    (SELECT COUNT(*)::INT FROM kyc_checklist_items WHERE kyc_case_id = k.id AND is_completed = TRUE)::INT AS checks_completed
  FROM kyc_cases k
  WHERE k.contact_id = p_contact_id
    AND k.agency_id = get_user_agency_id()
  ORDER BY k.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION kyc_by_contact_id(UUID) TO authenticated;

COMMENT ON FUNCTION kyc_by_contact_id(UUID) IS
  'Sprint 1 : retourne le dossier KYC le plus récent pour un contact (ou rien). Inclut le compteur de contrôles complétés pour l''UI. Source de vérité du deep-link contact → KYC.';

-- kyc_count_by_status() → JSONB { none, pending, verified, stale, failed }
-- Utilisé par : useKycStats (KPIs liste KYC, dashboard)
CREATE OR REPLACE FUNCTION kyc_count_by_status()
RETURNS JSONB
LANGUAGE sql STABLE
SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT jsonb_object_agg(dossier_status, n)
  FROM (
    SELECT dossier_status, COUNT(*) AS n
    FROM kyc_cases
    WHERE agency_id = get_user_agency_id()
    GROUP BY dossier_status
  ) sub;
$$;

GRANT EXECUTE ON FUNCTION kyc_count_by_status() TO authenticated;

COMMENT ON FUNCTION kyc_count_by_status() IS
  'Sprint 1 : compteurs par dossier_status pour les KPIs de la liste KYC.';
