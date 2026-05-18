-- ============================================================================
-- VALIDATE properties CHECK constraints introduced in migration 20260518_004
-- ============================================================================
-- Migration 20260518_004 added 5 CHECK constraints on `properties` with the
-- NOT VALID flag so the migration could ship without blocking on legacy data
-- that might violate the rules. They now apply to all NEW rows but legacy
-- rows are skipped until you run VALIDATE CONSTRAINT.
--
-- This script does the second half of that work:
--   1. AUDIT  — finds rows that would violate each constraint
--   2. CLEAN  — (manual) fix or null-out / soft-delete bad rows
--   3. VALIDATE — once all audit queries return 0 rows, lock in the
--                  constraints so they apply to ALL rows going forward.
--
-- HOW TO RUN
--   Option A (recommended): Supabase Dashboard → SQL Editor
--     https://supabase.com/dashboard/project/eayczugyrvmtqnnmvjod/sql
--     Paste section by section. Run AUDIT first, fix anything that shows up,
--     then run VALIDATE.
--
--   Option B: psql connected to the Supabase Pro instance.
--     psql "$(supabase status -o env | grep DB_URL)"  -- or paste DSN
--     \i scripts/validate-properties-constraints.sql
--
-- LOCK BEHAVIOUR
--   VALIDATE CONSTRAINT takes a `ShareUpdateExclusive` lock — concurrent
--   reads/writes continue, but other ALTER TABLE / DDL are blocked. On the
--   current properties row count (~12 internal listings + drafts), each
--   validation is sub-second. Safe to run during business hours.
-- ============================================================================


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 1 — AUDIT (read-only) — should each return 0 rows
-- ───────────────────────────────────────────────────────────────────────────

-- 1.1 — Canton outside the 26 Swiss codes
SELECT id, canton, title, created_at
FROM properties
WHERE canton IS NOT NULL
  AND UPPER(canton) NOT IN (
    'GE','VD','VS','NE','FR','BE','JU',
    'BS','BL','AG','SO','ZH','LU','ZG',
    'SZ','NW','OW','UR','GL','SH','TG',
    'AR','AI','SG','GR','TI'
  );

-- 1.2 — Negative price OR above CHF 200 M (likely fat-finger or e-notation)
SELECT id, price, title, transaction_type
FROM properties
WHERE price IS NOT NULL AND (price < 0 OR price > 200000000);

-- 1.3 — Latitude outside Switzerland's bounding box (45.8 .. 47.85)
SELECT id, lat, lng, address, city, canton
FROM properties
WHERE lat IS NOT NULL AND (lat < 45.8 OR lat > 47.85);

-- 1.4 — Longitude outside Switzerland's bounding box (5.95 .. 10.5)
SELECT id, lat, lng, address, city, canton
FROM properties
WHERE lng IS NOT NULL AND (lng < 5.95 OR lng > 10.5);

-- 1.5 — Postal code that doesn't match the Swiss NPA pattern [1-9]\d{3}
SELECT id, postal_code, city, canton
FROM properties
WHERE postal_code IS NOT NULL AND postal_code !~ '^[1-9][0-9]{3}$';


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2 — CLEAN (templates — adapt per finding)
-- ───────────────────────────────────────────────────────────────────────────
-- Run these only for rows you saw in SECTION 1.
-- DO NOT run all of these blindly — they're starter templates.
--
-- (a) Fix a known-wrong canton:
--    UPDATE properties SET canton = 'GE' WHERE id = '<uuid-here>';
--
-- (b) Null out unreliable coords (the bien will simply not appear on the
--     map until corrected — strictly better than showing it in Berlin):
--    UPDATE properties SET lat = NULL, lng = NULL WHERE id = '<uuid-here>';
--
-- (c) Soft-delete a row that is garbage and not worth fixing
--     (audit trail preserved by the trg_properties_audit trigger):
--    UPDATE properties SET deleted_at = now() WHERE id = '<uuid-here>';
--
-- (d) Normalise an existing canton case (in case some rows have 'ge'):
--    UPDATE properties SET canton = UPPER(canton) WHERE canton <> UPPER(canton);
--
-- After each clean, re-run the matching SECTION 1 query until it returns 0.


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 3 — VALIDATE — run only after all SECTION 1 queries return 0 rows
-- ───────────────────────────────────────────────────────────────────────────
-- Each ALTER will instantly scan the `properties` table. On the current
-- volume this is sub-second. If any returns
--   ERROR:  check constraint "..." is violated by some row
-- → re-run the matching SECTION 1 query to find the row, clean it,
--   then retry VALIDATE.

ALTER TABLE properties VALIDATE CONSTRAINT properties_canton_check;
ALTER TABLE properties VALIDATE CONSTRAINT properties_price_check;
ALTER TABLE properties VALIDATE CONSTRAINT properties_lat_check;
ALTER TABLE properties VALIDATE CONSTRAINT properties_lng_check;
ALTER TABLE properties VALIDATE CONSTRAINT properties_postal_code_check;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 4 — POST-VALIDATION VERIFICATION
-- ───────────────────────────────────────────────────────────────────────────
-- Confirm all constraints are now flagged validated (validated = 't').
-- Each row should have validated = TRUE.

SELECT conname, convalidated AS validated
FROM pg_constraint
WHERE conrelid = 'properties'::regclass
  AND conname IN (
    'properties_canton_check',
    'properties_price_check',
    'properties_lat_check',
    'properties_lng_check',
    'properties_postal_code_check'
  )
ORDER BY conname;
