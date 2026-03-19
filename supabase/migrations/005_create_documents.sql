-- Migration 005: Create documents table
-- Stores document metadata with references to Supabase Storage

CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID,
  property_id UUID,
  transaction_id UUID,
  kyc_case_id UUID,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'signed', 'rejected')),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Agents can CRUD documents in their agency
CREATE POLICY "Agents can read agency documents"
  ON documents FOR SELECT
  USING (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Agents can insert agency documents"
  ON documents FOR INSERT
  WITH CHECK (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Agents can update agency documents"
  ON documents FOR UPDATE
  USING (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Agents can delete agency documents"
  ON documents FOR DELETE
  USING (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

-- Sellers can read documents for their property
CREATE POLICY "Sellers can read their documents"
  ON documents FOR SELECT
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM contacts c WHERE c.user_id = auth.uid() AND c.type = 'seller'
    )
  );

-- Sellers can upload documents
CREATE POLICY "Sellers can insert documents"
  ON documents FOR INSERT
  WITH CHECK (uploaded_by = auth.uid());

-- Indexes
CREATE INDEX idx_documents_property_id ON documents(property_id);
CREATE INDEX idx_documents_agency_id ON documents(agency_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);

-- Note: Create a Storage bucket named "documents" in the Supabase dashboard
-- with the following policies:
-- - Authenticated users can upload to their own path ({uid}/*)
-- - Authenticated users can read files they uploaded or in their agency
