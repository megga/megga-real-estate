-- ============================================================================
-- PROPERTIES — audit trigger + soft-delete + AI/C2PA labeling + cleanup
-- Created: 2026-05-18
-- Audit: red-team Compliance auditor (Week 3 hotfixes 10–15)
--
-- Closes:
--   - Compliance CRIT #1: publish (draft → active) was silent on audit trail.
--   - Compliance CRIT #2: hard-delete left zero trace (violation nLPD art. 19,
--     LBA art. 7 al. 3).
--   - Compliance WARN #5: extractions IA mute — surfaced via the same trigger
--     when we ever switch to server-side property writes.
--   - Storage E2E P0 #5: photos virtual-staging non labelisées sur marketplace.
--   - EF c2pa-sign trompeur : fallback "megga_shield" masqué derrière le même
--     badge "C2PA certifié" → publicité trompeuse (LPD art. 28 CO).
--   - DB Persistence #2: drafts orphelins illimités, pas de TTL / cleanup.
--
-- Strategy:
--   * `properties_audit_event()` trigger logs every change with OLD↔NEW diff.
--   * `deleted_at` column + soft-delete pattern (existing SELECTs are filtered
--     in the React layer; trigger keeps audit on actual hard deletes).
--   * `ai_generated_photos TEXT[]` lists URLs that came from virtual-staging.
--   * `c2pa_verification_method TEXT` distinguishes "real" C2PA (capture/trufo)
--     from MEGGA Shield fallback (SHA-256 hash, not an official C2PA cert).
--   * pg_cron `cleanup_orphan_property_drafts` runs daily 03:30 UTC.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. COLUMNS — soft-delete, AI labeling, C2PA method
-- ============================================================================

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS ai_generated_photos TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS c2pa_verification_method TEXT;
COMMENT ON COLUMN properties.c2pa_verification_method IS
  'capture | trufo | wasm | megga_shield. Only ''capture''/''trufo'' are real C2PA. ''megga_shield'' is SHA-256 + EXIF (transparent internal trust).';

-- Partial index speeds up the dashboard list, which now always filters out
-- soft-deleted rows.
CREATE INDEX IF NOT EXISTS idx_properties_alive_agency_status
  ON properties (agency_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. AUDIT TRIGGER — properties INSERT/UPDATE/DELETE → activity_events
-- ============================================================================

CREATE OR REPLACE FUNCTION properties_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_severity TEXT;
  v_metadata JSONB;
  v_agency_id UUID;
  v_actor UUID := auth.uid();
  v_diff JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := CASE WHEN NEW.status = 'active' THEN 'bien_published' ELSE 'bien_created' END;
    v_severity := CASE WHEN NEW.status = 'active' THEN 'warn' ELSE 'info' END;
    v_agency_id := NEW.agency_id;
    v_metadata := jsonb_build_object(
      'status', NEW.status,
      'price', NEW.price,
      'type', NEW.type,
      'canton', NEW.canton,
      'transaction_type', NEW.transaction_type,
      'photo_count', COALESCE(array_length(NEW.photos, 1), 0)
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Skip pure soft-delete touches (handled in DELETE branch by raising soft-delete event)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action := 'bien_soft_deleted';
      v_severity := 'critical';
      v_agency_id := NEW.agency_id;
      v_metadata := jsonb_build_object(
        'previous_status', OLD.status,
        'price', OLD.price,
        'title', OLD.title
      );
    ELSE
      -- Build diff for changed fields we care about for audit
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_diff := v_diff || jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status));
      END IF;
      IF NEW.price IS DISTINCT FROM OLD.price THEN
        v_diff := v_diff || jsonb_build_object('price', jsonb_build_array(OLD.price, NEW.price));
      END IF;
      IF NEW.address IS DISTINCT FROM OLD.address THEN
        v_diff := v_diff || jsonb_build_object('address', jsonb_build_array(OLD.address, NEW.address));
      END IF;
      IF NEW.canton IS DISTINCT FROM OLD.canton THEN
        v_diff := v_diff || jsonb_build_object('canton', jsonb_build_array(OLD.canton, NEW.canton));
      END IF;
      IF NEW.mandate_signed_at IS DISTINCT FROM OLD.mandate_signed_at THEN
        v_diff := v_diff || jsonb_build_object('mandate_signed_at',
          jsonb_build_array(OLD.mandate_signed_at, NEW.mandate_signed_at));
      END IF;
      IF NEW.c2pa_verified IS DISTINCT FROM OLD.c2pa_verified THEN
        v_diff := v_diff || jsonb_build_object('c2pa_verified',
          jsonb_build_array(OLD.c2pa_verified, NEW.c2pa_verified));
      END IF;
      IF (COALESCE(array_length(NEW.photos, 1), 0)) IS DISTINCT FROM (COALESCE(array_length(OLD.photos, 1), 0)) THEN
        v_diff := v_diff || jsonb_build_object('photo_count',
          jsonb_build_array(
            COALESCE(array_length(OLD.photos, 1), 0),
            COALESCE(array_length(NEW.photos, 1), 0)
          ));
      END IF;

      -- No-op update (only updated_at touched): skip the event to avoid noise.
      IF v_diff = '{}'::jsonb THEN
        RETURN NEW;
      END IF;

      v_action := CASE
        WHEN OLD.status = 'draft' AND NEW.status = 'active' THEN 'bien_published'
        WHEN OLD.status != 'sold' AND NEW.status = 'sold' THEN 'bien_sold'
        ELSE 'bien_updated'
      END;
      v_severity := CASE
        WHEN v_action IN ('bien_published', 'bien_sold') THEN 'warn'
        ELSE 'info'
      END;
      v_agency_id := NEW.agency_id;
      v_metadata := jsonb_build_object('diff', v_diff);
    END IF;

  ELSE -- DELETE
    v_action := 'bien_hard_deleted';
    v_severity := 'critical';
    v_agency_id := OLD.agency_id;
    v_metadata := jsonb_build_object(
      'status', OLD.status,
      'price', OLD.price,
      'title', OLD.title,
      'address', OLD.address
    );
  END IF;

  -- Insert the audit row. actor_kind defaults to 'user' when actor_id is set;
  -- pg_cron writes (e.g. cleanup_orphan_drafts) have null auth.uid() → mark
  -- as 'system' so the dashboard can distinguish them from real human acts.
  INSERT INTO activity_events (
    agency_id, actor_id, actor_kind,
    action, entity_type, entity_id,
    severity, category, metadata
  ) VALUES (
    v_agency_id,
    v_actor,
    CASE WHEN v_actor IS NULL THEN 'system' ELSE 'user' END,
    v_action,
    'property',
    COALESCE(NEW.id, OLD.id),
    v_severity,
    'bien',
    v_metadata
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_audit ON properties;
CREATE TRIGGER trg_properties_audit
  AFTER INSERT OR UPDATE OR DELETE ON properties
  FOR EACH ROW EXECUTE FUNCTION properties_audit_event();

-- ============================================================================
-- 3. CLEANUP CRON — abandoned drafts older than 30 days
-- ============================================================================

-- Hard-deletes drafts that have never been touched in 30 days. Active /
-- published / sold rows are NEVER touched by this job (only `status='draft'`).
-- The audit trigger above will capture each delete as a 'bien_hard_deleted'
-- event with actor_kind='system'.
CREATE OR REPLACE FUNCTION cleanup_orphan_property_drafts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM properties
    WHERE status = 'draft'
      AND deleted_at IS NULL
      AND updated_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Schedule (idempotent — unschedule first if it already exists)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-orphan-property-drafts');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-orphan-property-drafts',
  '30 3 * * *', -- daily at 03:30 UTC
  $$SELECT cleanup_orphan_property_drafts();$$
);

-- ============================================================================
-- 4. RLS — exclude soft-deleted rows from agent + public SELECTs
-- ============================================================================
-- Single source of truth for "hide soft-deleted" — every hook that queries
-- properties (20+ call sites in src/) automatically inherits this filter
-- without needing per-call .is('deleted_at', null) plumbing. super_admin
-- policies stay untouched so moderation tooling can see soft-deleted rows.

DROP POLICY IF EXISTS properties_select_agency ON properties;
CREATE POLICY properties_select_agency ON properties
  FOR SELECT
  USING (agency_id = get_user_agency_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS properties_select_public ON properties;
CREATE POLICY properties_select_public ON properties
  FOR SELECT
  USING (status = 'active' AND deleted_at IS NULL);

-- UPDATE policy unchanged on the WITH-CHECK side — we explicitly WANT agents
-- to be able to set deleted_at via UPDATE (that's how soft-delete works).
-- The audit trigger then converts that UPDATE into a 'bien_soft_deleted'
-- activity_events row.

COMMIT;

-- ============================================================================
-- VERIFICATION (manual)
-- ============================================================================
-- 1. Confirm trigger is live:
--    SELECT tgname FROM pg_trigger WHERE tgrelid = 'properties'::regclass;
--    -- Expect trg_properties_audit
--
-- 2. Confirm cleanup cron is scheduled:
--    SELECT jobname, schedule, active FROM cron.job
--    WHERE jobname = 'cleanup-orphan-property-drafts';
--
-- 3. Dry-run cleanup (count without delete):
--    SELECT COUNT(*) FROM properties
--      WHERE status = 'draft' AND deleted_at IS NULL
--        AND updated_at < now() - INTERVAL '30 days';
--
-- 4. Sample an audit event from the last hour:
--    SELECT created_at, action, severity, metadata
--    FROM activity_events
--    WHERE entity_type = 'property' AND created_at > now() - INTERVAL '1 hour'
--    ORDER BY created_at DESC LIMIT 10;
-- ============================================================================
