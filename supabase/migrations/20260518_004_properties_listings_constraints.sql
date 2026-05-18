-- ============================================================================
-- PROPERTIES + LISTINGS — integrity constraints
-- Created: 2026-05-18
-- Audit: red-team Schema auditor + Persistence auditor (Week 2 hotfixes 5–7)
--
-- Closes:
--   - V9  HIGH (Zod):  canton accepted "ZZ" — no enum, no DB CHECK.
--   - V2  CRIT (Zod):  price had no upper bound on buy (1.7e308 passed).
--   - V10 HIGH (Zod):  lat/lng outside Switzerland accepted.
--   - V8  MED  (Zod):  postal_code accepted "abcd" / "0000".
--   - DB #4 CRIT:      no UNIQUE(property_id) on listings → publish race
--                      could create twin listings on /acheter.
--
-- Strategy:
--   * CHECK constraints added with NOT VALID so the migration can't fail on
--     bad legacy data. Each gets a paired VALIDATE block in the verification
--     section that the operator runs after a manual cleanup pass.
--   * UNIQUE on listings.property_id requires dedup first — we consolidate
--     views_count / favorites_count onto the most-recent listing per property
--     then drop the rest. Done in a temp table to keep the operation auditable.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CHECK constraints on properties (added NOT VALID — see notes above)
-- ============================================================================

-- Canton must be one of the 26 Swiss codes (case-insensitive — older rows
-- may use lowercase, the UI now produces uppercase via z.enum(CANTONS)).
ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_canton_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_canton_check
  CHECK (
    canton IS NULL
    OR UPPER(canton) IN (
      'GE','VD','VS','NE','FR','BE','JU',
      'BS','BL','AG','SO','ZH','LU','ZG',
      'SZ','NW','OW','UR','GL','SH','TG',
      'AR','AI','SG','GR','TI'
    )
  )
  NOT VALID;

-- Price bounds mirror the Zod superRefine: rent CHF 100–50K/mois OR buy CHF
-- 50K–200M total. We can't express the rent/buy split in a single CHECK
-- without `transaction_type`, so we apply the global outer bounds here and
-- let Zod enforce the per-mode tightening at the form layer.
ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_price_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_price_check
  CHECK (price IS NULL OR (price >= 0 AND price <= 200000000))
  NOT VALID;

-- Switzerland's bounding box for lat/lng. Closes the "appartement Genève
-- avec coords à Berlin" scenario from the red-team E2E persona.
ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_lat_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_lat_check
  CHECK (lat IS NULL OR (lat BETWEEN 45.8 AND 47.85))
  NOT VALID;

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_lng_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_lng_check
  CHECK (lng IS NULL OR (lng BETWEEN 5.95 AND 10.5))
  NOT VALID;

-- Swiss NPA: 4 digits, no leading zero (Liechtenstein-only codes excluded
-- as they're handled by a separate flow).
ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_postal_code_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_postal_code_check
  CHECK (postal_code IS NULL OR postal_code ~ '^[1-9][0-9]{3}$')
  NOT VALID;

-- ============================================================================
-- 2. LISTINGS — dedup then UNIQUE(property_id)
-- ============================================================================

-- Step A: snapshot which listing-id is the keeper per property_id (most-recent
-- published_at wins, id as tiebreaker for determinism).
DROP TABLE IF EXISTS _listings_dedup_keepers;
CREATE TEMP TABLE _listings_dedup_keepers AS
SELECT DISTINCT ON (property_id)
  id,
  property_id
FROM listings
ORDER BY property_id, published_at DESC NULLS LAST, id;

-- Step B: consolidate stats from soon-to-be-deleted duplicates onto the keeper.
-- Only touches rows that actually have duplicates — single-listing properties
-- are untouched.
UPDATE listings l
SET
  views_count = stats.total_views,
  favorites_count = stats.total_favorites
FROM (
  SELECT property_id,
         SUM(views_count) AS total_views,
         SUM(favorites_count) AS total_favorites
  FROM listings
  GROUP BY property_id
  HAVING COUNT(*) > 1
) stats
WHERE l.id IN (SELECT id FROM _listings_dedup_keepers)
  AND l.property_id = stats.property_id;

-- Step C: delete the non-keeper duplicates.
DELETE FROM listings
WHERE id NOT IN (SELECT id FROM _listings_dedup_keepers)
  AND property_id IN (SELECT property_id FROM _listings_dedup_keepers);

-- Step D: enforce uniqueness going forward. The double-click race from the
-- E2E P0 scenario can no longer create twin marketplace rows.
ALTER TABLE listings
  DROP CONSTRAINT IF EXISTS listings_property_id_unique;
ALTER TABLE listings
  ADD CONSTRAINT listings_property_id_unique UNIQUE (property_id);

DROP TABLE IF EXISTS _listings_dedup_keepers;

-- ============================================================================
-- 3. Address-dedup index on properties (lookup helper, no constraint)
-- ============================================================================

-- Not a UNIQUE — a PPE legitimately has multiple lots at the same address.
-- Just a composite index for the future dedup-detection UI surface.
CREATE INDEX IF NOT EXISTS idx_properties_addr_agency
  ON properties (agency_id, lower(address), postal_code)
  WHERE status IN ('draft', 'active');

COMMIT;

-- ============================================================================
-- VERIFICATION + POST-MIGRATION TASKS (manual)
-- ============================================================================
-- 1. Inspect rows that would fail validation, then clean and VALIDATE:
--
--    SELECT id, canton FROM properties
--      WHERE canton IS NOT NULL
--        AND UPPER(canton) NOT IN ('GE','VD','VS','NE','FR','BE','JU','BS','BL',
--                                  'AG','SO','ZH','LU','ZG','SZ','NW','OW','UR',
--                                  'GL','SH','TG','AR','AI','SG','GR','TI');
--    -- After cleanup:
--    ALTER TABLE properties VALIDATE CONSTRAINT properties_canton_check;
--
--    SELECT id, price FROM properties
--      WHERE price IS NOT NULL AND (price < 0 OR price > 200000000);
--    ALTER TABLE properties VALIDATE CONSTRAINT properties_price_check;
--
--    SELECT id, lat, lng FROM properties
--      WHERE (lat IS NOT NULL AND (lat < 45.8 OR lat > 47.85))
--         OR (lng IS NOT NULL AND (lng < 5.95 OR lng > 10.5));
--    ALTER TABLE properties VALIDATE CONSTRAINT properties_lat_check;
--    ALTER TABLE properties VALIDATE CONSTRAINT properties_lng_check;
--
--    SELECT id, postal_code FROM properties
--      WHERE postal_code IS NOT NULL AND postal_code !~ '^[1-9][0-9]{3}$';
--    ALTER TABLE properties VALIDATE CONSTRAINT properties_postal_code_check;
--
-- 2. Verify no duplicate listings remain:
--    SELECT property_id, COUNT(*) FROM listings GROUP BY property_id HAVING COUNT(*) > 1;
--    -- Should return 0 rows.
-- ============================================================================
