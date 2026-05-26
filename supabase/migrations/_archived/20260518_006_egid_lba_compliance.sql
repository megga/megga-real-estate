-- ============================================================================
-- PROPERTIES — EGID + mandate expiry enforcement
-- Created: 2026-05-18
-- Audit: red-team Compliance (P1 — notaire-bloquant + LBA)
--
-- Closes:
--   - Compliance #3: EGID/EGRID absent → notaire ne peut pas finaliser l'acte,
--     FINMA ne peut pas reconstruire le dossier 10 ans après.
--   - Compliance #10 (BASSE): mandate_expires_at jamais enforcé — un mandat
--     échu laisse le bien publié indéfiniment (LBA art. 7 al. 1 lit. a :
--     l'agent doit cesser la relation d'affaires à l'échéance du mandat).
--
-- Strategy:
--   * `egid TEXT` column avec CHECK '^\d{9}$' (Swiss federal building ID,
--     9 digits — see SwissTopo / OFS standard). NOT VALID pour ne pas
--     casser les rows legacy ; à VALIDATE manuellement.
--   * pg_cron `unpublish-expired-mandates` (daily 03:45 UTC, 15 min après
--     cleanup-orphan-drafts pour éviter contention) qui passe à `archived`
--     les biens dont le mandat est échu. Le trigger d'audit (migration 005)
--     capture automatiquement le UPDATE comme `bien_updated` avec le diff
--     status sold/archived.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EGID column
-- ============================================================================

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS egid TEXT;

COMMENT ON COLUMN properties.egid IS
  'EGID — Eidgenössischer Gebäudeidentifikator (9 chiffres, OFS/SwissTopo). '
  'Requis par le notaire pour l''acte authentique et par FINMA pour reconstruire '
  'le dossier LBA. Optionnel au formulaire mais affiché en gros sur la fiche.';

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_egid_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_egid_check
  CHECK (egid IS NULL OR egid ~ '^[0-9]{9}$')
  NOT VALID;

-- ============================================================================
-- 2. MANDATE EXPIRY — unpublish at expiration
-- ============================================================================

-- Passe à 'archived' les biens publiés (status='active') dont le mandat
-- est échu. La fonction est SECURITY DEFINER pour bypass la RLS — le cron
-- tourne en service_role et doit pouvoir muter tous les agencies.
--
-- L'audit trigger trg_properties_audit (migration 005) capture chaque UPDATE
-- comme un event `bien_updated` avec le diff status — la reconstruction LBA
-- voit "active → archived" et l'horodatage exact.
CREATE OR REPLACE FUNCTION unpublish_expired_mandates()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE properties
    SET status = 'archived'
  WHERE status = 'active'
    AND deleted_at IS NULL
    AND mandate_expires_at IS NOT NULL
    AND mandate_expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Schedule (idempotent — unschedule first if it already exists)
DO $$
BEGIN
  PERFORM cron.unschedule('unpublish-expired-mandates');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'unpublish-expired-mandates',
  '45 3 * * *', -- daily at 03:45 UTC (15 min after cleanup-orphan-drafts)
  $$SELECT unpublish_expired_mandates();$$
);

COMMIT;

-- ============================================================================
-- VERIFICATION (manual)
-- ============================================================================
-- 1. Confirm column + constraint:
--    \d properties
--    SELECT conname FROM pg_constraint
--    WHERE conrelid = 'properties'::regclass AND conname = 'properties_egid_check';
--
-- 2. Confirm cron is scheduled:
--    SELECT jobname, schedule, active FROM cron.job
--    WHERE jobname = 'unpublish-expired-mandates';
--
-- 3. Dry-run unpublish (count without mutating):
--    SELECT COUNT(*) FROM properties
--    WHERE status = 'active' AND deleted_at IS NULL
--      AND mandate_expires_at IS NOT NULL AND mandate_expires_at < now();
--
-- 4. Inspect rows that would fail EGID CHECK (should be 0 for clean tenants):
--    SELECT id, egid FROM properties
--    WHERE egid IS NOT NULL AND egid !~ '^[0-9]{9}$';
--    -- After cleanup:
--    ALTER TABLE properties VALIDATE CONSTRAINT properties_egid_check;
-- ============================================================================
