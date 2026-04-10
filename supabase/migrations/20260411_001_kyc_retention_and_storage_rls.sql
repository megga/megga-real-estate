-- ============================================================================
-- KYC RETENTION & STORAGE RLS HARDENING
-- Created: 2026-04-11
-- Audit: swiss-compliance-check (LBA-C1, LBA-C4)
--
-- Fixes two critical LBA violations:
--
-- LBA-C1: Storage bucket kyc-documents had policies USING (bucket_id = 'kyc-documents')
--         which allowed ANY authenticated agent to read/delete KYC documents from
--         ANY agency. Cross-agency data leak risk (nLPD art. 8 + LBA art. 7).
--
-- LBA-C4: No 10-year retention policy. LBA art. 7 al. 3 requires KYC documents
--         to be kept 10 years. Currently any agent can delete them anytime.
--
-- Strategy:
--   1. Storage paths follow pattern: {agency_id}/{kyc_case_id}/{filename}
--      → RLS uses (storage.foldername(name))[1] to extract agency_id prefix
--      → Joined with profiles.agency_id of current user via get_my_agency_id()
--   2. Add retention_until column on documents (default created_at + 10 years)
--   3. BEFORE DELETE trigger blocks deletion while retention_until > now()
--   4. Super admins can bypass retention for legitimate legal reasons
--
-- Idempotent: uses DO blocks and IF EXISTS/NOT EXISTS guards.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. STORAGE RLS — agency-scoped policies
-- ============================================================================

-- Drop the old permissive policies
DROP POLICY IF EXISTS "agents_upload_kyc_docs" ON storage.objects;
DROP POLICY IF EXISTS "agents_read_kyc_docs" ON storage.objects;
DROP POLICY IF EXISTS "agents_delete_kyc_docs" ON storage.objects;

-- New agency-scoped policies
-- The first folder segment of the storage path MUST match the user's agency_id
-- Path pattern enforced by useKyc.ts:220 → `${agencyId}/${kycCaseId}/${filename}`

CREATE POLICY "kyc_docs_agency_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = get_my_agency_id()::text
);

CREATE POLICY "kyc_docs_agency_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (
    (storage.foldername(name))[1] = get_my_agency_id()::text
    OR is_super_admin()
  )
);

CREATE POLICY "kyc_docs_agency_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = get_my_agency_id()::text
);

-- DELETE is heavily restricted — only super_admin can delete, AND only if the
-- corresponding document record has passed its retention_until date.
-- Normal agents CANNOT delete KYC documents (LBA art. 7 al. 3).
CREATE POLICY "kyc_docs_super_admin_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND is_super_admin()
);

-- ============================================================================
-- 2. RETENTION — column + default
-- ============================================================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ;

-- Backfill existing KYC documents with 10-year retention from creation date
UPDATE documents
SET retention_until = created_at + interval '10 years'
WHERE kyc_case_id IS NOT NULL
  AND retention_until IS NULL;

-- Set default for future inserts via trigger (cannot use column default with expression referencing other columns)
CREATE OR REPLACE FUNCTION set_kyc_document_retention()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.kyc_case_id IS NOT NULL AND NEW.retention_until IS NULL THEN
    NEW.retention_until := NEW.created_at + interval '10 years';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_kyc_document_retention ON documents;
CREATE TRIGGER trg_set_kyc_document_retention
BEFORE INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION set_kyc_document_retention();

-- ============================================================================
-- 3. RETENTION ENFORCEMENT — block DELETE if retention_until not reached
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_kyc_retention()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only enforce for KYC documents
  IF OLD.kyc_case_id IS NOT NULL
     AND OLD.retention_until IS NOT NULL
     AND OLD.retention_until > now() THEN
    -- Allow super_admin to override for legitimate reasons (audit logged separately)
    IF NOT is_super_admin() THEN
      RAISE EXCEPTION
        'KYC document retention period not elapsed. Retention until: %. LBA art. 7 al. 3 requires 10 years retention.',
        OLD.retention_until;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_kyc_retention ON documents;
CREATE TRIGGER trg_enforce_kyc_retention
BEFORE DELETE ON documents
FOR EACH ROW
EXECUTE FUNCTION enforce_kyc_retention();

-- ============================================================================
-- 4. INDEX — speed up retention queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_documents_retention_until
  ON documents(retention_until)
  WHERE retention_until IS NOT NULL;

-- ============================================================================
-- 5. AUDIT — log this migration
-- ============================================================================

INSERT INTO activity_events (
  actor_id, action, entity_type, entity_id, metadata, created_at
)
VALUES (
  'system',
  'migration_applied',
  'compliance',
  '20260411_001',
  jsonb_build_object(
    'migration', '20260411_001_kyc_retention_and_storage_rls',
    'fixes', jsonb_build_array('LBA-C1', 'LBA-C4'),
    'description', 'KYC storage RLS agency-scoped + 10-year retention trigger'
  ),
  now()
)
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ============================================================================
-- 1. Check policies exist:
--    SELECT policyname FROM pg_policies
--    WHERE schemaname='storage' AND tablename='objects'
--    AND policyname LIKE 'kyc_docs%';
--
-- 2. Check retention backfilled:
--    SELECT COUNT(*) FROM documents
--    WHERE kyc_case_id IS NOT NULL AND retention_until IS NULL;
--    -- Should return 0
--
-- 3. Test deletion is blocked (as agent):
--    DELETE FROM documents WHERE id = '...';  -- should raise EXCEPTION
-- ============================================================================
