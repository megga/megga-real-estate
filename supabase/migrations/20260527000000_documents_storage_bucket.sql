-- Documents storage bucket for generated PDFs.
-- The DocumentGenerator page renders templates (mandat, bon de visite,
-- offre, etc.) to PDF client-side via @react-pdf/renderer. The blob is
-- then uploaded here and indexed via a `documents` row.
--
-- Bucket layout: `{agency_id}/{document_id}.pdf` — agency isolation at
-- the path level + RLS at the SQL level for defense in depth.

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- ── RLS on storage.objects scoped to the documents bucket ─────────────
-- All policies check that the first path segment matches the user's
-- agency_id. The agent's `get_user_agency_id()` returns null for non-
-- agency users, so they're naturally excluded.

DROP POLICY IF EXISTS "documents_bucket_select" ON storage.objects;
CREATE POLICY "documents_bucket_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_agency_id()::text
  );

DROP POLICY IF EXISTS "documents_bucket_insert" ON storage.objects;
CREATE POLICY "documents_bucket_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_agency_id()::text
  );

DROP POLICY IF EXISTS "documents_bucket_update" ON storage.objects;
CREATE POLICY "documents_bucket_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_agency_id()::text
  );

DROP POLICY IF EXISTS "documents_bucket_delete" ON storage.objects;
CREATE POLICY "documents_bucket_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_agency_id()::text
  );
