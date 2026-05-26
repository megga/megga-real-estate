-- Video support for property galleries
ALTER TABLE properties ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS video_url TEXT;
