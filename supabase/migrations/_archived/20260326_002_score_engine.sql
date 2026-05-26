-- MEGGA Score Engine v1
-- 3 tables: market_changes, contact_scores, property_scores

-- ═══════════════════════════════════════════════════════════════════
-- 1. market_changes — Log every market movement detected by scrape-delta
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE market_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  market_listing_id UUID REFERENCES market_listings(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('new', 'price_drop', 'price_increase', 'removed', 'relisted')),
  old_price NUMERIC(12,2),
  new_price NUMERIC(12,2),
  change_pct NUMERIC(6,2),         -- e.g., -8.5 for 8.5% drop
  listing_title TEXT,               -- denormalized for quick display
  listing_city TEXT,
  listing_canton TEXT,
  listing_type TEXT,
  listing_rooms NUMERIC(3,1),
  detected_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_market_changes_detected ON market_changes(detected_at DESC);
CREATE INDEX idx_market_changes_type ON market_changes(change_type, detected_at DESC);
CREATE INDEX idx_market_changes_listing ON market_changes(market_listing_id);

-- ═══════════════════════════════════════════════════════════════════
-- 2. contact_scores — Behavioral scoring per contact
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE contact_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE UNIQUE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  -- Individual dimension scores (0-100)
  reactivity_score INTEGER DEFAULT 0,        -- How fast they respond
  engagement_score INTEGER DEFAULT 0,        -- How often they interact
  budget_coherence_score INTEGER DEFAULT 0,  -- Declared vs actual behavior
  visit_quality_score INTEGER DEFAULT 0,     -- Visit outcomes quality

  -- Composite scores
  buyer_score INTEGER DEFAULT 0,             -- Weighted combination (0-100)
  conversion_probability INTEGER DEFAULT 0,  -- Likelihood to close (0-100)

  -- Derived intelligence
  estimated_real_budget NUMERIC(12,2),       -- Calculated from visited property prices
  rejection_patterns JSONB DEFAULT '[]',     -- ["rez-de-chaussée", "bruit", "sombre"]
  intent_signals JSONB DEFAULT '{}',         -- {"urgent": true, "preferred_zones": ["Champel"], "preferred_floor": "high"}
  engagement_trend TEXT DEFAULT 'stable',    -- 'rising', 'stable', 'declining'

  -- Metadata
  interactions_count INTEGER DEFAULT 0,
  visits_count INTEGER DEFAULT 0,
  matches_sent_count INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contact_scores_agency ON contact_scores(agency_id);
CREATE INDEX idx_contact_scores_buyer ON contact_scores(buyer_score DESC);

-- ═══════════════════════════════════════════════════════════════════
-- 3. property_scores — Heat score per property (internal + market)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE property_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  market_listing_id UUID REFERENCES market_listings(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('internal', 'market')),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,

  -- Scores (0-100)
  heat_score INTEGER DEFAULT 0,              -- Overall attractiveness
  market_position_score INTEGER DEFAULT 0,   -- Price vs comparables
  interest_level INTEGER DEFAULT 0,          -- Matches, visits, feedback

  -- Derived data
  days_on_market INTEGER DEFAULT 0,
  price_trend TEXT DEFAULT 'stable' CHECK (price_trend IN ('stable', 'dropping', 'rising')),
  stagnation_risk TEXT DEFAULT 'low' CHECK (stagnation_risk IN ('low', 'medium', 'high')),
  comparable_count INTEGER DEFAULT 0,
  avg_comparable_price NUMERIC(12,2),
  price_vs_market_pct NUMERIC(6,2),          -- e.g., +8.5 means 8.5% above market

  -- Metadata
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure one score per property per source
  UNIQUE (property_id, source),
  UNIQUE (market_listing_id, source)
);

CREATE INDEX idx_property_scores_heat ON property_scores(heat_score DESC);
CREATE INDEX idx_property_scores_agency ON property_scores(agency_id);

-- ═══════════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE market_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_scores ENABLE ROW LEVEL SECURITY;

-- market_changes: public read (market data is shared)
CREATE POLICY "Anyone can read market changes"
  ON market_changes FOR SELECT USING (true);

-- contact_scores: agency-scoped
CREATE POLICY "Users can read own agency contact scores"
  ON contact_scores FOR SELECT
  USING (agency_id = get_my_agency_id());

CREATE POLICY "Service role full access contact scores"
  ON contact_scores FOR ALL
  USING (auth.role() = 'service_role');

-- property_scores: agency-scoped for internal, public for market
CREATE POLICY "Users can read own agency property scores"
  ON property_scores FOR SELECT
  USING (agency_id = get_my_agency_id() OR agency_id IS NULL);

CREATE POLICY "Service role full access property scores"
  ON property_scores FOR ALL
  USING (auth.role() = 'service_role');
