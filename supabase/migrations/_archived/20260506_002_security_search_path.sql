-- ============================================================
-- Phase A — Security hardening: function_search_path_mutable (lint 0011)
-- ============================================================
-- Supabase linter flagged 27 functions in `public` schema without
-- an explicit search_path. Without one, a malicious user can shadow
-- a built-in like `pg_catalog.foo` by creating their own
-- `attacker_schema.foo` and pushing `attacker_schema` first in their
-- search path — the SECURITY DEFINER function then executes the
-- attacker's code with elevated privileges.
--
-- Fix: pin `search_path = public, pg_temp` via ALTER FUNCTION.
-- This forces resolution to public + the local temp schema, blocking
-- shadowing.
--
-- Idempotent: PostgreSQL silently overwrites if already set, and the
-- DO block skips functions that don't exist (renamed/dropped).
--
-- Functions intentionally NOT included (different fix in later PRs):
--   - get_my_agency_id, get_user_agency_id, handle_new_user — already
--     have search_path set (only flagged for SECURITY DEFINER, not 0011)
--   - st_estimatedextent (PostGIS owned, can't ALTER)
-- ============================================================

DO $$
DECLARE
  fn_name text;
  fn_args text;
  fixed_count integer := 0;
  skipped_count integer := 0;
  found_signature boolean;
BEGIN
  FOR fn_name IN
    SELECT unnest(ARRAY[
      'calculate_sla',
      'count_market_by_canton',
      'count_market_by_type',
      'daily_matching_scan',
      'enforce_kyc_retention',
      'estimate_property_price',
      'generate_ticket_number',
      'get_app_config',
      'get_cities_by_canton',
      'get_popular_articles',
      'get_user_role',
      'hourly_automation_scan',
      'is_super_admin',
      'pg_database_size_mb',
      'run_search_alerts',
      'search_directory',
      'set_kyc_document_retention',
      'set_ticket_sla',
      'slugify',
      'storage_size_mb',
      'trigger_matching_on_new_search',
      'trigger_matching_on_price_change',
      'trigger_matching_on_property_active',
      'trigger_matching_on_search_updated',
      'update_market_listings_updated_at',
      'update_thread_on_new_message',
      'update_ticket_timestamp'
    ])
  LOOP
    found_signature := false;
    -- Loop over each signature (some functions may have overloads).
    FOR fn_args IN
      SELECT pg_get_function_identity_arguments(p.oid)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn_name
    LOOP
      EXECUTE format(
        'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
        fn_name, fn_args
      );
      fixed_count := fixed_count + 1;
      found_signature := true;
    END LOOP;

    IF NOT found_signature THEN
      skipped_count := skipped_count + 1;
      RAISE NOTICE 'Function public.% not found, skipping', fn_name;
    END IF;
  END LOOP;

  RAISE NOTICE 'Phase A complete: search_path set on % function signature(s), % name(s) skipped (not found)',
    fixed_count, skipped_count;
END $$;

-- ============================================================
-- Verification: confirm each targeted function now has search_path set.
-- Logs WARN per remaining offender — visible in Supabase Studio logs.
-- ============================================================
DO $$
DECLARE
  fn_name text;
  fn_args text;
  has_path boolean;
  ok_count integer := 0;
  bad_count integer := 0;
BEGIN
  FOR fn_name IN
    SELECT unnest(ARRAY[
      'calculate_sla',
      'count_market_by_canton',
      'count_market_by_type',
      'daily_matching_scan',
      'enforce_kyc_retention',
      'estimate_property_price',
      'generate_ticket_number',
      'get_app_config',
      'get_cities_by_canton',
      'get_popular_articles',
      'get_user_role',
      'hourly_automation_scan',
      'is_super_admin',
      'pg_database_size_mb',
      'run_search_alerts',
      'search_directory',
      'set_kyc_document_retention',
      'set_ticket_sla',
      'slugify',
      'storage_size_mb',
      'trigger_matching_on_new_search',
      'trigger_matching_on_price_change',
      'trigger_matching_on_property_active',
      'trigger_matching_on_search_updated',
      'update_market_listings_updated_at',
      'update_thread_on_new_message',
      'update_ticket_timestamp'
    ])
  LOOP
    FOR fn_args, has_path IN
      SELECT
        pg_get_function_identity_arguments(p.oid),
        EXISTS (
          SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
          WHERE cfg LIKE 'search_path=%'
        )
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn_name
    LOOP
      IF has_path THEN
        ok_count := ok_count + 1;
      ELSE
        bad_count := bad_count + 1;
        RAISE WARNING 'Still missing search_path: public.%(%)', fn_name, fn_args;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Verification: % function signature(s) with search_path set, % still missing',
    ok_count, bad_count;
END $$;
