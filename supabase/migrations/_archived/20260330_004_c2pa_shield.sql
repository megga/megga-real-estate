-- C2PA / MEGGA Shield — photo authenticity verification
ALTER TABLE properties ADD COLUMN IF NOT EXISTS c2pa_verified BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS c2pa_verified_at TIMESTAMPTZ;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS c2pa_verified BOOLEAN DEFAULT false;
