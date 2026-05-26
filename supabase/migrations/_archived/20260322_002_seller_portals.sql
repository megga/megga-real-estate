-- Portails vendeurs — accès tokénisé sans login
CREATE TABLE IF NOT EXISTS seller_portals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL UNIQUE,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,        -- Le vendeur (référence contacts)
  property_id uuid NOT NULL,       -- Le bien en vente
  agent_id uuid NOT NULL,          -- L'agent responsable
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '6 months'),
  last_viewed_at timestamptz,
  view_count integer DEFAULT 0
);

-- Index pour lookup par token (accès public)
CREATE UNIQUE INDEX idx_seller_portals_token ON seller_portals(token);

-- Index pour lookup par contact/property (côté agent)
CREATE INDEX idx_seller_portals_contact ON seller_portals(contact_id);
CREATE INDEX idx_seller_portals_property ON seller_portals(property_id);
CREATE INDEX idx_seller_portals_agency ON seller_portals(agency_id);

-- RLS
ALTER TABLE seller_portals ENABLE ROW LEVEL SECURITY;

-- Les agents voient les portails de leur agence
CREATE POLICY "agents_own_agency" ON seller_portals
  FOR ALL USING (
    agency_id = (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Accès public en lecture seule via token (pour les vendeurs non authentifiés)
-- Note: l'accès par token se fait via Edge Function ou requête directe avec le token
CREATE POLICY "public_read_by_token" ON seller_portals
  FOR SELECT USING (true);
