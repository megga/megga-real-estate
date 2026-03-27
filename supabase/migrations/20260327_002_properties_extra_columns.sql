-- Add missing columns to properties table (used by ListingFormPage wizard)

ALTER TABLE properties ADD COLUMN IF NOT EXISTS floor INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS total_floors INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS year_built INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS charges_monthly NUMERIC(10,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS mandate_type TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
