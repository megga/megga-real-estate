-- ============================================================================
-- PROPERTIES — extend audit trigger to capture ai_generated_photos changes
-- Created: 2026-05-18
-- Audit: red-team Compliance (P2 — defense-in-depth audit trail)
--
-- Closes:
--   - Audit gap from 20260518_005: the trigger captures c2pa_verified flips,
--     photo_count deltas, mandate_signed_at, but NOT `ai_generated_photos`.
--     A virtual-staging EF call mutates the array silently from the trigger's
--     perspective. virtual-staging logs its own activity_event, but if anyone
--     ever bypasses the EF (admin SQL, future API surface, etc.) the array
--     change goes untraced. Belt + suspenders.
--
-- Strategy: CREATE OR REPLACE the existing function with one extra IF block.
-- The trigger DDL itself is unchanged — only the function body grows.
-- ============================================================================

BEGIN;

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
      -- AI-generated photos array delta — captures virtual-staging additions/removals.
      -- We track the count (URLs themselves stay out of the audit log to keep rows
      -- small and avoid leaking storage paths to long-lived audit consumers).
      IF (COALESCE(array_length(NEW.ai_generated_photos, 1), 0))
         IS DISTINCT FROM (COALESCE(array_length(OLD.ai_generated_photos, 1), 0)) THEN
        v_diff := v_diff || jsonb_build_object('ai_photo_count',
          jsonb_build_array(
            COALESCE(array_length(OLD.ai_generated_photos, 1), 0),
            COALESCE(array_length(NEW.ai_generated_photos, 1), 0)
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

-- Trigger DDL unchanged — CREATE OR REPLACE on the function is enough.

COMMIT;

-- ============================================================================
-- VERIFICATION (manual)
-- ============================================================================
-- 1. Confirm the function definition includes ai_photo_count:
--    SELECT prosrc FROM pg_proc WHERE proname = 'properties_audit_event';
--    -- Expect to see "ai_photo_count" in the body.
--
-- 2. Trigger still active:
--    SELECT tgname, tgenabled FROM pg_trigger
--    WHERE tgrelid = 'properties'::regclass AND tgname = 'trg_properties_audit';
--
-- 3. Smoke test:
--    UPDATE properties SET ai_generated_photos = '{}'::text[]
--    WHERE id = '<some-property-id-from-your-agency>';
--    -- (If the array was non-empty before, this generates a bien_updated event
--    --  with metadata->'diff'->'ai_photo_count' = [N, 0].)
-- ============================================================================
