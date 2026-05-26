-- Cache for external market search results (RealAdvisor Phase 1)
CREATE TABLE IF NOT EXISTS external_listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  search_hash text NOT NULL,
  external_id text,
  title text,
  price numeric,
  address text,
  city text,
  canton text,
  rooms numeric,
  surface_m2 numeric,
  type text,
  photo_url text,
  source_url text NOT NULL,
  source_portal text DEFAULT 'realadvisor',
  source_agency text,
  source_logo_url text,
  fetched_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 hour')
);

-- Index for cache lookup
CREATE INDEX idx_external_listings_search_hash ON external_listings(search_hash, expires_at);
CREATE INDEX idx_external_listings_agency ON external_listings(agency_id);

-- RLS
ALTER TABLE external_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_own_agency" ON external_listings
  FOR ALL USING (
    agency_id = (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
    )
  );
