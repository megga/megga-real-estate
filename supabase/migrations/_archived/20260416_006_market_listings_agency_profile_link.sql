-- Link market_listings to agency_profiles for full profile pages
ALTER TABLE market_listings
  ADD COLUMN IF NOT EXISTS agency_profile_id UUID REFERENCES agency_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ml_agency_profile_id
  ON market_listings(agency_profile_id)
  WHERE agency_profile_id IS NOT NULL;

-- Slugify helper: converts "Apleona Schweiz AG" → "apleona-schweiz-ag"
-- Used by Flatfox sync to generate agency_profiles.slug deterministically.
CREATE OR REPLACE FUNCTION slugify(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' from regexp_replace(
    regexp_replace(
      lower(unaccent(coalesce(input, ''))),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-+', '-', 'g'
  ));
$$;

-- Required extension for unaccent (usually already enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS unaccent;
