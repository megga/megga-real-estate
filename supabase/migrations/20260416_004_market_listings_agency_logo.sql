-- Add agency_logo_url column to market_listings
-- Stores the Flatfox agency logo URL (from agency.logo.url_org_logo_m)
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS agency_logo_url TEXT;
