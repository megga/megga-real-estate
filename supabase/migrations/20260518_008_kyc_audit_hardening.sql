-- ============================================================================
-- Migration: KYC Audit & Compliance Hardening (Sprint 3)
-- Date: 2026-05-18
--
-- Implémente plusieurs fixes red-team Sprint 3 en une seule migration :
--
--   1. activity_events devient TRULY append-only (trigger BEFORE UPDATE/DELETE
--      qui refuse même en service_role, sauf cas d'anonymisation nLPD limité).
--      → fix Roger #4 (audit trail mutable)
--
--   2. documents.sha256_hash : permet de prouver l'intégrité du document
--      depuis l'upload jusqu'à l'audit FINMA. Le hash est calculé côté client
--      avant upload (Web Crypto API) et vérifié au download.
--      → fix Roger #5 (pas de checksum documents)
--
--   3. kyc_cases.source_of_funds_type / description / doc_id : capture
--      structurée de l'origine économique des fonds (LBA art. 6 al. 1 lit. b).
--      Crypto / mixed = red flag automatique pour le risk score.
--      → fix Léa #1 + #5 (source des fonds non capturée)
--
-- Article LBA / nLPD :
--   - Art. 7 al. 1 (intégrité des preuves)
--   - Art. 7 al. 3 (conservation 10 ans)
--   - Art. 6 al. 1 lit. b (arrière-plan économique)
--   - nLPD art. 12 (intégrité traçabilité)
-- ============================================================================

-- ============================================================================
-- 1. ACTIVITY_EVENTS — TRUE append-only (Roger #4)
-- ============================================================================
-- Le trigger SECURITY DEFINER est exécuté pour TOUTES les écritures (y compris
-- service_role qui bypass RLS). Les seules modifications autorisées sont :
--   - anonymisation nLPD : UPDATE actor_id = NULL AND actor_kind = 'system'
--     (utilisé par delete-account quand un user est supprimé)
-- Toute autre modification ou suppression dans la fenêtre 10 ans → RAISE.

CREATE OR REPLACE FUNCTION enforce_activity_events_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_age_years NUMERIC;
  v_is_anonymization BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Cas autorisé unique : anonymisation nLPD
    -- (actor_id passé à NULL ET actor_kind passé à 'system', tout le reste inchangé)
    v_is_anonymization :=
      (NEW.actor_id IS NULL)
      AND (NEW.actor_kind = 'system')
      AND (NEW.action = OLD.action)
      AND (NEW.entity_type = OLD.entity_type)
      AND (NEW.entity_id IS NOT DISTINCT FROM OLD.entity_id)
      AND (NEW.agency_id IS NOT DISTINCT FROM OLD.agency_id)
      AND (NEW.created_at = OLD.created_at)
      AND (NEW.severity IS NOT DISTINCT FROM OLD.severity)
      AND (NEW.category IS NOT DISTINCT FROM OLD.category);

    IF v_is_anonymization THEN
      -- Marque l'event comme anonymisé via metadata (preuve audit)
      NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'anonymized_at', NOW()::TEXT,
          'anonymized_reason', 'nLPD user deletion'
        );
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'activity_events est append-only (LBA art. 7 al. 1 — intégrité). Seule l''anonymisation nLPD (actor_id=NULL + actor_kind=system) est autorisée.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_age_years := EXTRACT(EPOCH FROM (NOW() - OLD.created_at)) / (365.25 * 24 * 3600);
    IF v_age_years < 10 THEN
      RAISE EXCEPTION 'Suppression activity_events interdite pendant 10 ans (LBA art. 7 al. 3). Event % a % ans.',
        OLD.id, ROUND(v_age_years, 2);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_events_immutable_update ON activity_events;
CREATE TRIGGER trg_activity_events_immutable_update
  BEFORE UPDATE ON activity_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_activity_events_immutability();

DROP TRIGGER IF EXISTS trg_activity_events_immutable_delete ON activity_events;
CREATE TRIGGER trg_activity_events_immutable_delete
  BEFORE DELETE ON activity_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_activity_events_immutability();

COMMENT ON FUNCTION enforce_activity_events_immutability() IS
  'Sprint 3 (Roger #4) : rend activity_events truly append-only même contre service_role. UPDATE autorisé uniquement pour anonymisation nLPD (actor_id NULL + actor_kind system, tout le reste figé). DELETE interdit < 10 ans (LBA art. 7 al. 3).';

-- ============================================================================
-- 2. DOCUMENTS.SHA256_HASH — Intégrité preuve (Roger #5)
-- ============================================================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS sha256_hash TEXT
  CHECK (sha256_hash IS NULL OR sha256_hash ~ '^[a-f0-9]{64}$');

COMMENT ON COLUMN documents.sha256_hash IS
  'SHA-256 hex du contenu fichier (64 chars). Calculé côté client avant upload (Web Crypto API). Permet de prouver à FINMA que le document n''a pas été altéré post-upload. NULL pour les documents legacy sans hash.';

CREATE INDEX IF NOT EXISTS idx_documents_sha256
  ON documents (sha256_hash)
  WHERE sha256_hash IS NOT NULL;

-- ============================================================================
-- 3. KYC_CASES.SOURCE_OF_FUNDS_* — Origine économique structurée (Léa #1 + #5)
-- ============================================================================
-- LBA art. 6 al. 1 lit. b : pour les transactions à risque accru (vigilance
-- renforcée), l'arrière-plan économique DOIT être clarifié et documenté.
-- Aujourd'hui aucun champ structuré → impossible de scorer "crypto" comme red flag.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_source_of_funds_type') THEN
    CREATE TYPE kyc_source_of_funds_type AS ENUM (
      'salary',           -- Salaire / revenus d'activité
      'sale_property',    -- Vente d'un bien immobilier
      'sale_business',    -- Vente d'entreprise / parts sociales
      'inheritance',      -- Héritage / donation
      'investment',       -- Revenus de placement / dividendes
      'crypto',           -- Crypto-actifs (red flag LBA)
      'loan',             -- Prêt bancaire
      'mixed',            -- Origine mixte (red flag : nécessite détail)
      'other'             -- Autre — justifier
    );
  END IF;
END $$;

ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS source_of_funds_type kyc_source_of_funds_type;
ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS source_of_funds_description TEXT;
ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS source_of_funds_doc_id UUID
  REFERENCES documents(id) ON DELETE SET NULL;

COMMENT ON COLUMN kyc_cases.source_of_funds_type IS
  'LBA art. 6 al. 1 lit. b — typologie de l''origine des fonds. crypto / mixed = red flag automatique.';
COMMENT ON COLUMN kyc_cases.source_of_funds_description IS
  'Description libre obligatoire si type=crypto / mixed / other. Justifie l''arrière-plan économique.';
COMMENT ON COLUMN kyc_cases.source_of_funds_doc_id IS
  'Lien vers la pièce justificative (attestation, contrat de vente, déclaration crypto…). Catégorie financial ou compliance.';

-- ============================================================================
-- 4. CHECK constraint cohérence
-- ============================================================================
-- Si type IN (crypto, mixed, other), la description doit être renseignée
-- (>= 20 chars). Sinon le champ peut être NULL.

ALTER TABLE kyc_cases DROP CONSTRAINT IF EXISTS kyc_cases_source_of_funds_desc_check;
ALTER TABLE kyc_cases ADD CONSTRAINT kyc_cases_source_of_funds_desc_check
  CHECK (
    source_of_funds_type IS NULL
    OR source_of_funds_type NOT IN ('crypto', 'mixed', 'other')
    OR (source_of_funds_description IS NOT NULL AND length(source_of_funds_description) >= 20)
  );
