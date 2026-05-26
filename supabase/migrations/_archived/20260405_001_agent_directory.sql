-- ============================================================================
-- Agent Directory — Tables, RLS, Indexes, RPC
-- ============================================================================

-- ── agency_profiles (must be created first — agent_profiles references it) ──

CREATE TABLE agency_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id),

  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,

  canton text,
  city text,
  address text,

  description text,
  founded_year integer,
  specialties text[] DEFAULT '{}',
  languages text[] DEFAULT '{}',
  certifications text[] DEFAULT '{}',
  website_url text,
  phone text,
  email text,
  zones_covered text[] DEFAULT '{}',

  status text NOT NULL DEFAULT 'unclaimed'
    CHECK (status IN ('unclaimed', 'claimed', 'verified')),
  claim_token uuid DEFAULT gen_random_uuid(),
  claimed_at timestamptz,
  verified_at timestamptz,

  agent_count integer DEFAULT 0,
  active_listings_count integer DEFAULT 0,
  rating_avg numeric DEFAULT 0,
  rating_count integer DEFAULT 0,

  source text,  -- 'svit', 'smk', 'uspi', 'manual'
  source_id text, -- external ID for deduplication

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── agent_profiles ──

CREATE TABLE agent_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id),
  agency_profile_id uuid REFERENCES agency_profiles(id),

  first_name text NOT NULL,
  last_name text NOT NULL,
  slug text UNIQUE NOT NULL,
  photo_url text,

  canton text,
  city text,

  specialties text[] DEFAULT '{}',
  languages text[] DEFAULT '{}',
  bio text,
  experience_years integer,
  certifications text[] DEFAULT '{}',
  website_url text,
  phone text,
  email text,

  status text NOT NULL DEFAULT 'unclaimed'
    CHECK (status IN ('unclaimed', 'claimed', 'verified')),
  claim_token uuid DEFAULT gen_random_uuid(),
  claimed_at timestamptz,
  verified_at timestamptz,

  stats_properties_sold integer DEFAULT 0,
  stats_avg_price numeric DEFAULT 0,
  stats_avg_days_to_sell integer DEFAULT 0,
  stats_response_rate numeric DEFAULT 0,
  stats_updated_at timestamptz,

  meta_title text,
  meta_description text,

  rating_avg numeric DEFAULT 0,
  rating_count integer DEFAULT 0,

  source text,
  source_id text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── agent_reviews ──

CREATE TABLE agent_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_profile_id uuid NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,

  reviewer_name text NOT NULL,
  reviewer_email text,
  reviewer_contact_id uuid REFERENCES contacts(id),
  is_verified boolean DEFAULT false,

  rating_local_knowledge smallint NOT NULL CHECK (rating_local_knowledge BETWEEN 1 AND 5),
  rating_process_expertise smallint NOT NULL CHECK (rating_process_expertise BETWEEN 1 AND 5),
  rating_responsiveness smallint NOT NULL CHECK (rating_responsiveness BETWEEN 1 AND 5),
  rating_negotiation smallint NOT NULL CHECK (rating_negotiation BETWEEN 1 AND 5),
  rating_overall numeric GENERATED ALWAYS AS (
    (rating_local_knowledge + rating_process_expertise + rating_responsiveness + rating_negotiation) / 4.0
  ) STORED,

  comment text,

  agent_response text,
  agent_responded_at timestamptz,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  moderated_at timestamptz,

  created_at timestamptz DEFAULT now()
);

-- ── Indexes ──

CREATE INDEX idx_agent_profiles_canton ON agent_profiles(canton);
CREATE INDEX idx_agent_profiles_status ON agent_profiles(status);
CREATE INDEX idx_agent_profiles_slug ON agent_profiles(slug);
CREATE INDEX idx_agent_profiles_search ON agent_profiles
  USING gin (to_tsvector('french', coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(city, '')));

CREATE INDEX idx_agency_profiles_canton ON agency_profiles(canton);
CREATE INDEX idx_agency_profiles_status ON agency_profiles(status);
CREATE INDEX idx_agency_profiles_slug ON agency_profiles(slug);
CREATE INDEX idx_agency_profiles_search ON agency_profiles
  USING gin (to_tsvector('french', coalesce(name, '') || ' ' || coalesce(city, '')));

CREATE INDEX idx_agent_reviews_agent ON agent_reviews(agent_profile_id);
CREATE INDEX idx_agent_reviews_status ON agent_reviews(status);

-- ── RLS ──

ALTER TABLE agency_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reviews ENABLE ROW LEVEL SECURITY;

-- agency_profiles: public read, owner/admin write
CREATE POLICY "public_read_agency_profiles" ON agency_profiles
  FOR SELECT USING (true);

CREATE POLICY "owner_update_agency_profiles" ON agency_profiles
  FOR UPDATE TO authenticated
  USING (
    agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
    OR is_super_admin()
  );

CREATE POLICY "admin_insert_agency_profiles" ON agency_profiles
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

-- agent_profiles: public read, owner/admin write
CREATE POLICY "public_read_agent_profiles" ON agent_profiles
  FOR SELECT USING (true);

CREATE POLICY "owner_update_agent_profiles" ON agent_profiles
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() OR is_super_admin());

CREATE POLICY "admin_insert_agent_profiles" ON agent_profiles
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

-- agent_reviews: public read approved, anyone can insert, owner can respond, admin can moderate
CREATE POLICY "public_read_approved_reviews" ON agent_reviews
  FOR SELECT USING (status = 'approved');

CREATE POLICY "anyone_insert_reviews" ON agent_reviews
  FOR INSERT WITH CHECK (true);

CREATE POLICY "agent_respond_reviews" ON agent_reviews
  FOR UPDATE TO authenticated
  USING (
    agent_profile_id IN (SELECT id FROM agent_profiles WHERE profile_id = auth.uid())
    OR is_super_admin()
  );

CREATE POLICY "admin_delete_reviews" ON agent_reviews
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ── RPC: search directory ──

CREATE OR REPLACE FUNCTION search_directory(
  search_query text DEFAULT '',
  search_type text DEFAULT 'agents',  -- 'agents' | 'agencies'
  filter_canton text DEFAULT NULL,
  filter_city text DEFAULT NULL,
  filter_specialties text[] DEFAULT NULL,
  filter_languages text[] DEFAULT NULL,
  filter_verified boolean DEFAULT NULL,
  sort_by text DEFAULT 'relevance',   -- 'relevance' | 'name' | 'rating' | 'listings'
  page_number integer DEFAULT 0,
  page_size integer DEFAULT 20
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
  total_count bigint;
BEGIN
  IF search_type = 'agents' THEN
    -- Count
    SELECT count(*) INTO total_count
    FROM agent_profiles ap
    WHERE (search_query = '' OR
      to_tsvector('french', coalesce(ap.first_name, '') || ' ' || coalesce(ap.last_name, '') || ' ' || coalesce(ap.city, ''))
      @@ plainto_tsquery('french', search_query)
      OR ap.first_name ILIKE '%' || search_query || '%'
      OR ap.last_name ILIKE '%' || search_query || '%'
      OR ap.city ILIKE '%' || search_query || '%')
    AND (filter_canton IS NULL OR ap.canton = filter_canton)
    AND (filter_city IS NULL OR ap.city ILIKE '%' || filter_city || '%')
    AND (filter_specialties IS NULL OR ap.specialties && filter_specialties)
    AND (filter_languages IS NULL OR ap.languages && filter_languages)
    AND (filter_verified IS NULL OR (filter_verified = true AND ap.status = 'verified') OR filter_verified = false);

    -- Results
    SELECT json_build_object(
      'total', total_count,
      'page', page_number,
      'pageSize', page_size,
      'items', coalesce(json_agg(row_to_json(r)), '[]'::json)
    ) INTO result
    FROM (
      SELECT ap.*,
        agp.name AS agency_name, agp.slug AS agency_slug
      FROM agent_profiles ap
      LEFT JOIN agency_profiles agp ON agp.id = ap.agency_profile_id
      WHERE (search_query = '' OR
        to_tsvector('french', coalesce(ap.first_name, '') || ' ' || coalesce(ap.last_name, '') || ' ' || coalesce(ap.city, ''))
        @@ plainto_tsquery('french', search_query)
        OR ap.first_name ILIKE '%' || search_query || '%'
        OR ap.last_name ILIKE '%' || search_query || '%'
        OR ap.city ILIKE '%' || search_query || '%')
      AND (filter_canton IS NULL OR ap.canton = filter_canton)
      AND (filter_city IS NULL OR ap.city ILIKE '%' || filter_city || '%')
      AND (filter_specialties IS NULL OR ap.specialties && filter_specialties)
      AND (filter_languages IS NULL OR ap.languages && filter_languages)
      AND (filter_verified IS NULL OR (filter_verified = true AND ap.status = 'verified') OR filter_verified = false)
      ORDER BY
        CASE WHEN sort_by = 'name' THEN ap.last_name END ASC,
        CASE WHEN sort_by = 'rating' THEN ap.rating_avg END DESC,
        CASE WHEN sort_by = 'listings' THEN ap.stats_properties_sold END DESC,
        CASE WHEN sort_by = 'relevance' THEN
          CASE WHEN ap.status = 'verified' THEN 0 WHEN ap.status = 'claimed' THEN 1 ELSE 2 END
        END ASC,
        ap.rating_avg DESC,
        ap.created_at DESC
      LIMIT page_size OFFSET page_number * page_size
    ) r;

  ELSE
    -- Agencies
    SELECT count(*) INTO total_count
    FROM agency_profiles agp
    WHERE (search_query = '' OR
      to_tsvector('french', coalesce(agp.name, '') || ' ' || coalesce(agp.city, ''))
      @@ plainto_tsquery('french', search_query)
      OR agp.name ILIKE '%' || search_query || '%'
      OR agp.city ILIKE '%' || search_query || '%')
    AND (filter_canton IS NULL OR agp.canton = filter_canton)
    AND (filter_city IS NULL OR agp.city ILIKE '%' || filter_city || '%')
    AND (filter_specialties IS NULL OR agp.specialties && filter_specialties)
    AND (filter_languages IS NULL OR agp.languages && filter_languages)
    AND (filter_verified IS NULL OR (filter_verified = true AND agp.status = 'verified') OR filter_verified = false);

    SELECT json_build_object(
      'total', total_count,
      'page', page_number,
      'pageSize', page_size,
      'items', coalesce(json_agg(row_to_json(r)), '[]'::json)
    ) INTO result
    FROM (
      SELECT agp.*
      FROM agency_profiles agp
      WHERE (search_query = '' OR
        to_tsvector('french', coalesce(agp.name, '') || ' ' || coalesce(agp.city, ''))
        @@ plainto_tsquery('french', search_query)
        OR agp.name ILIKE '%' || search_query || '%'
        OR agp.city ILIKE '%' || search_query || '%')
      AND (filter_canton IS NULL OR agp.canton = filter_canton)
      AND (filter_city IS NULL OR agp.city ILIKE '%' || filter_city || '%')
      AND (filter_specialties IS NULL OR agp.specialties && filter_specialties)
      AND (filter_languages IS NULL OR agp.languages && filter_languages)
      AND (filter_verified IS NULL OR (filter_verified = true AND agp.status = 'verified') OR filter_verified = false)
      ORDER BY
        CASE WHEN sort_by = 'name' THEN agp.name END ASC,
        CASE WHEN sort_by = 'rating' THEN agp.rating_avg END DESC,
        CASE WHEN sort_by = 'listings' THEN agp.active_listings_count END DESC,
        CASE WHEN sort_by = 'relevance' THEN
          CASE WHEN agp.status = 'verified' THEN 0 WHEN agp.status = 'claimed' THEN 1 ELSE 2 END
        END ASC,
        agp.rating_avg DESC,
        agp.created_at DESC
      LIMIT page_size OFFSET page_number * page_size
    ) r;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION search_directory TO anon, authenticated;
