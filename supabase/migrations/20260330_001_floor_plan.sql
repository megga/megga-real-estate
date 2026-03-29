-- Floor Plan Interactif — colonnes pour plan d'étage cliquable + tagging photos par pièce

-- Properties (biens internes agents)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS floor_plan_url TEXT,
  ADD COLUMN IF NOT EXISTS floor_plan_hotspots JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_tags JSONB DEFAULT '[]'::jsonb;

-- Market listings (biens marché scrapés)
ALTER TABLE market_listings
  ADD COLUMN IF NOT EXISTS floor_plan_url TEXT,
  ADD COLUMN IF NOT EXISTS floor_plan_hotspots JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_tags JSONB DEFAULT '[]'::jsonb;
