-- AI photo quality scoring + auto-labeling metadata
ALTER TABLE properties ADD COLUMN IF NOT EXISTS photo_quality_scores JSONB DEFAULT '[]'::jsonb;
