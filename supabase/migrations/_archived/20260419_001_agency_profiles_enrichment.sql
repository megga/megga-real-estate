-- Enrichment columns on agency_profiles for the Lookmove sitemap crawl
-- (Étape 1 of the agency-data enrichment plan).
--
-- Fields we extract from lookmove.ch agency pages:
--   lookmove_agency_id  — opaque numeric id from the page URL
--   enriched_at         — last time we wrote from an external enrichment source
--
-- NB: uid_che (Swiss federal business ID) is NOT extracted — the UID shown
-- on every lookmove agency page is Lookmove SA's own, not the agency's.

ALTER TABLE agency_profiles
  ADD COLUMN IF NOT EXISTS lookmove_agency_id INTEGER,
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_agency_profiles_lookmove_id
  ON agency_profiles(lookmove_agency_id)
  WHERE lookmove_agency_id IS NOT NULL;
