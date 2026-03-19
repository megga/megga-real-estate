-- Migration 004: Create offers table
-- Stores purchase offers on properties

CREATE TABLE offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL,
  agency_id UUID,
  contact_buyer_id UUID REFERENCES contacts(id),
  buyer_name TEXT NOT NULL,
  amount BIGINT NOT NULL,
  conditions TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'refused', 'counter', 'expired')),
  responded_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Agents can CRUD offers in their agency
CREATE POLICY "Agents can read agency offers"
  ON offers FOR SELECT
  USING (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Agents can insert agency offers"
  ON offers FOR INSERT
  WITH CHECK (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Agents can update agency offers"
  ON offers FOR UPDATE
  USING (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Agents can delete agency offers"
  ON offers FOR DELETE
  USING (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

-- Sellers can read offers on their property
CREATE POLICY "Sellers can read their offers"
  ON offers FOR SELECT
  USING (
    property_id IN (
      SELECT o2.property_id FROM offers o2
      JOIN contacts c ON c.id = o2.contact_buyer_id OR c.user_id = auth.uid()
      WHERE c.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM contacts c WHERE c.user_id = auth.uid() AND c.type = 'seller'
    )
  );

-- Sellers can update offer status (accept/refuse)
CREATE POLICY "Sellers can respond to offers"
  ON offers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM contacts c WHERE c.user_id = auth.uid() AND c.type = 'seller'
    )
  );

-- Indexes
CREATE INDEX idx_offers_property_id ON offers(property_id);
CREATE INDEX idx_offers_agency_id ON offers(agency_id);
CREATE INDEX idx_offers_status ON offers(status);
