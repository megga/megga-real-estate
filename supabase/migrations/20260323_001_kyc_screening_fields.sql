-- ============================================================================
-- Migration: KYC Screening Fields + Storage Bucket
-- Date: 2026-03-23
-- Description: Adds PEP/Sanctions screening fields to kyc_cases,
--              document expiration fields to documents,
--              and creates kyc-documents storage bucket.
-- ============================================================================

-- ============================================================================
-- 1. CHAMPS MANQUANTS SUR kyc_cases
-- ============================================================================

ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS pep_status TEXT
  CHECK (pep_status IN ('clear', 'match', 'pending', 'not_checked'))
  DEFAULT 'not_checked';

ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS pep_details JSONB;

ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS sanctions_status TEXT
  CHECK (sanctions_status IN ('clear', 'match', 'pending', 'not_checked'))
  DEFAULT 'not_checked';

ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS sanctions_details JSONB;

ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS last_screening_at TIMESTAMPTZ;

ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS contact_nationality TEXT;

ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS transaction_amount NUMERIC;

ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS risk_score INTEGER;

ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS risk_factors JSONB;

ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- 2. CHAMPS MANQUANTS SUR documents
-- ============================================================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_category TEXT
  CHECK (document_category IN ('identity', 'domicile', 'financial', 'compliance', 'other'))
  DEFAULT 'other';

-- ============================================================================
-- 3. STORAGE BUCKET kyc-documents
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "agents_upload_kyc_docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-documents');

CREATE POLICY "agents_read_kyc_docs" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'kyc-documents');

CREATE POLICY "agents_delete_kyc_docs" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'kyc-documents');

-- ============================================================================
-- 4. INDEX for screening queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_kyc_cases_pep_status ON kyc_cases(pep_status);
CREATE INDEX IF NOT EXISTS idx_kyc_cases_sanctions_status ON kyc_cases(sanctions_status);
CREATE INDEX IF NOT EXISTS idx_documents_kyc_expires ON documents(kyc_case_id, expires_at)
  WHERE expires_at IS NOT NULL;
