-- CRITICAL FIX — properties table was missing agency-scoped INSERT and
-- DELETE policies, and the only UPDATE policy was super_admin-only.
-- Result: regular agents couldn't create new listings, couldn't edit
-- their own listings, and couldn't archive/delete listings.
--
-- Discovered while wiring the WizardShell "Publier sur MEGGA" silent
-- no-op (PR #437). The button was about to start firing real inserts
-- which would all 42501 with insufficient_privilege — same bug shape
-- as #434 on `transactions`.
--
-- Existing policies kept intact:
--   - properties_select_agency  (agency members SELECT)
--   - properties_select_public  (public visitors SELECT published listings)
--   - super_admin_read_all_properties
--   - super_admin_update_properties (super_admin override on UPDATE)
--
-- Added: standard agency-scoped INSERT / UPDATE / DELETE for authenticated
-- agents, mirroring `contacts_insert/update/delete`, `transactions_*`,
-- `kyc_cases_*`, etc.

DROP POLICY IF EXISTS "properties_insert" ON public.properties;
CREATE POLICY "properties_insert"
  ON public.properties
  FOR INSERT
  TO authenticated
  WITH CHECK (agency_id = public.get_user_agency_id());

DROP POLICY IF EXISTS "properties_update" ON public.properties;
CREATE POLICY "properties_update"
  ON public.properties
  FOR UPDATE
  TO authenticated
  USING (agency_id = public.get_user_agency_id())
  WITH CHECK (agency_id = public.get_user_agency_id());

DROP POLICY IF EXISTS "properties_delete" ON public.properties;
CREATE POLICY "properties_delete"
  ON public.properties
  FOR DELETE
  TO authenticated
  USING (agency_id = public.get_user_agency_id());

-- Make the matching-engine notifier defensive — bail out silently if the
-- app_config isn't fully populated instead of throwing a NOT NULL on
-- http_request_queue.url. Without this guard, a misconfigured prod env
-- (or a local test DB) would 500 every property publish.
CREATE OR REPLACE FUNCTION public.trigger_matching_on_property_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  base_url TEXT;
  svc_key TEXT;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'active')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active'))
  THEN
    base_url := public.get_app_config('supabase_url');
    svc_key := public.get_app_config('service_role_key');

    -- Defensive: skip the dispatch if the config isn't set rather than
    -- blowing up the INSERT with a NOT NULL on http_request_queue.url.
    -- The matching-engine can also be triggered manually if a backfill
    -- is needed.
    IF base_url IS NULL OR base_url = '' OR svc_key IS NULL OR svc_key = '' THEN
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := base_url || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
      ),
      body := jsonb_build_object(
        'mode', 'match-property',
        'property_id', NEW.id,
        'agency_id', NEW.agency_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
