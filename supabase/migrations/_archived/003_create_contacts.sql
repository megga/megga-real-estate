-- Migration 003: Create contacts table
-- Stores leads and clients from onboarding forms and manual entry

CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID,
  user_id UUID REFERENCES auth.users(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  type TEXT NOT NULL CHECK (type IN ('buyer', 'seller', 'both', 'lead')),
  entity_type TEXT NOT NULL DEFAULT 'pp' CHECK (entity_type IN ('pp', 'pm')),
  source TEXT NOT NULL DEFAULT 'onboarding' CHECK (source IN ('onboarding', 'manual', 'import', 'website', 'referral')),
  score TEXT DEFAULT 'warm' CHECK (score IN ('hot', 'warm', 'cold')),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  form_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Agents can read contacts in their agency
CREATE POLICY "Agents can read agency contacts"
  ON contacts FOR SELECT
  USING (
    agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
    OR user_id = auth.uid()
  );

-- Allow inserts for onboarding (anon + authenticated)
CREATE POLICY "Anon can insert onboarding contacts"
  ON contacts FOR INSERT
  TO anon, authenticated
  WITH CHECK (source = 'onboarding');

-- Agents can update contacts in their agency
CREATE POLICY "Agents can update agency contacts"
  ON contacts FOR UPDATE
  USING (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

-- Agents can delete contacts in their agency
CREATE POLICY "Agents can delete agency contacts"
  ON contacts FOR DELETE
  USING (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

-- Indexes
CREATE INDEX idx_contacts_agency_id ON contacts(agency_id);
CREATE INDEX idx_contacts_type ON contacts(type);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_source ON contacts(source);
