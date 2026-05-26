-- ============================================================
-- Seller Leads table + Property Estimation RPC
-- ============================================================

-- Table: seller_leads
CREATE TABLE IF NOT EXISTS seller_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Property data (JSONB snapshot of what the seller entered)
  property_data JSONB NOT NULL DEFAULT '{}',
  -- Estimation results
  estimation_min BIGINT,
  estimation_max BIGINT,
  estimation_median BIGINT,
  estimation_price_per_m2 INTEGER,
  estimation_confidence TEXT CHECK (estimation_confidence IN ('low', 'medium', 'high')),
  comparable_count INTEGER DEFAULT 0,
  -- Contact info
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  motivation TEXT CHECK (motivation IN ('immediate', '3months', '6months', 'exploring')),
  -- Assignment
  assigned_agency_id UUID REFERENCES agencies(id),
  -- Status
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'mandate', 'lost')),
  source TEXT NOT NULL DEFAULT 'website',
  -- Linked records (populated when agent converts lead)
  contact_id UUID REFERENCES contacts(id),
  property_id UUID REFERENCES properties(id),
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_seller_leads_status ON seller_leads(status);
CREATE INDEX idx_seller_leads_created_at ON seller_leads(created_at DESC);
CREATE INDEX idx_seller_leads_agency ON seller_leads(assigned_agency_id) WHERE assigned_agency_id IS NOT NULL;

-- RLS
ALTER TABLE seller_leads ENABLE ROW LEVEL SECURITY;

-- Anon can INSERT (public form submission)
CREATE POLICY "anon_insert_seller_leads"
  ON seller_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Authenticated agents can read leads from their agency
CREATE POLICY "agents_read_seller_leads"
  ON seller_leads FOR SELECT
  TO authenticated
  USING (
    assigned_agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
    OR assigned_agency_id IS NULL  -- unassigned leads visible to all agents
  );

-- Authenticated agents can update leads from their agency
CREATE POLICY "agents_update_seller_leads"
  ON seller_leads FOR UPDATE
  TO authenticated
  USING (
    assigned_agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
    OR assigned_agency_id IS NULL
  );

-- ============================================================
-- RPC: estimate_property_price
-- Returns median price/m2, estimation range, and comparables
-- ============================================================
CREATE OR REPLACE FUNCTION estimate_property_price(
  p_canton TEXT,
  p_city TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_surface INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_median_price_m2 NUMERIC;
  v_count INTEGER;
  v_comparables JSON;
  v_confidence TEXT;
  v_estimation BIGINT;
  v_min BIGINT;
  v_max BIGINT;
BEGIN
  -- Step 1: Get median price/m2 for this canton (+ city + type if provided)
  SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_m2),
    count(*)
  INTO v_median_price_m2, v_count
  FROM market_listings
  WHERE status IN ('active', 'price_reduced')
    AND quality_score >= 50
    AND price_per_m2 IS NOT NULL
    AND price_per_m2 > 0
    AND canton = p_canton
    AND (p_city IS NULL OR city ILIKE p_city)
    AND (p_type IS NULL OR type = p_type)
    AND transaction_type = 'buy';

  -- Fallback: if too few results with city, try canton-only
  IF v_count < 5 AND p_city IS NOT NULL THEN
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_m2),
      count(*)
    INTO v_median_price_m2, v_count
    FROM market_listings
    WHERE status IN ('active', 'price_reduced')
      AND quality_score >= 50
      AND price_per_m2 IS NOT NULL
      AND price_per_m2 > 0
      AND canton = p_canton
      AND (p_type IS NULL OR type = p_type)
      AND transaction_type = 'buy';
  END IF;

  -- Confidence level
  IF v_count < 5 THEN
    v_confidence := 'low';
  ELSIF v_count <= 15 THEN
    v_confidence := 'medium';
  ELSE
    v_confidence := 'high';
  END IF;

  -- Calculate estimation if we have data
  IF v_median_price_m2 IS NOT NULL AND p_surface IS NOT NULL AND p_surface > 0 THEN
    v_estimation := (v_median_price_m2 * p_surface)::BIGINT;
    v_min := (v_estimation * 0.85)::BIGINT;
    v_max := (v_estimation * 1.15)::BIGINT;
  END IF;

  -- Step 2: Get 5 comparable properties
  SELECT json_agg(comp) INTO v_comparables
  FROM (
    SELECT
      id,
      title,
      city,
      address,
      type,
      rooms,
      surface_m2,
      price,
      price_per_m2,
      photos[1] AS photo_url,
      days_on_market
    FROM market_listings
    WHERE status IN ('active', 'price_reduced')
      AND quality_score >= 50
      AND canton = p_canton
      AND (p_type IS NULL OR type = p_type)
      AND transaction_type = 'buy'
      AND price IS NOT NULL
      AND surface_m2 IS NOT NULL
      AND (p_surface IS NULL OR (
        surface_m2 BETWEEN p_surface * 0.7 AND p_surface * 1.3
      ))
    ORDER BY
      CASE WHEN p_surface IS NOT NULL
        THEN ABS(surface_m2 - p_surface)
        ELSE 0
      END ASC,
      last_seen_at DESC
    LIMIT 5
  ) comp;

  RETURN json_build_object(
    'median_price_m2', ROUND(v_median_price_m2),
    'estimation', v_estimation,
    'estimation_min', v_min,
    'estimation_max', v_max,
    'confidence', v_confidence,
    'comparable_count', v_count,
    'comparables', COALESCE(v_comparables, '[]'::json)
  );
END;
$$;
