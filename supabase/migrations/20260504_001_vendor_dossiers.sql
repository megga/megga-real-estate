-- Migration : vendor dossiers (pipeline vendeur du compte public).
--
-- Le hook useVendorDossiers utilisait localStorage comme stockage initial
-- (pattern identique à useSavedSearches v0). Cette migration crée la table
-- de persistance cross-device. Le hook merge localStorage → Supabase au
-- premier login, puis bascule en mode DB.
--
-- Pipeline 7 étapes : received → reviewing → estimated → mandate → live →
-- visits → sold. Estimation et publication sont des sous-objets JSONB
-- générés à l'avancement de statut (auto-fill avec comparables et stats).

CREATE TABLE IF NOT EXISTS vendor_dossiers (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  transaction TEXT NOT NULL CHECK (transaction IN ('vente', 'location')),
  property_type TEXT NOT NULL CHECK (property_type IN ('appartement', 'maison', 'terrain', 'commercial')),
  address TEXT NOT NULL,
  surface TEXT,
  rooms NUMERIC,
  photos_count INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'reviewing', 'estimated', 'mandate', 'live', 'visits', 'sold')),
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,

  agent JSONB NOT NULL,
  estimation JSONB,
  publication JSONB,
  next_action JSONB,
  msg_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vendor_dossiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own vendor dossiers"
  ON vendor_dossiers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_dossiers_user
  ON vendor_dossiers (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_dossiers_status
  ON vendor_dossiers (user_id, status)
  WHERE status NOT IN ('sold', 'archived');

-- Trigger pour maintenir updated_at à jour
CREATE OR REPLACE FUNCTION update_vendor_dossiers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vendor_dossiers_updated_at
  BEFORE UPDATE ON vendor_dossiers
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_dossiers_updated_at();
