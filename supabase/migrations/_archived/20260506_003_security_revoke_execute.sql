-- ============================================================
-- Phase B — Security hardening: REVOKE EXECUTE on internal SECURITY DEFINER
-- ============================================================
-- Supabase linter codes 0028 (anon_security_definer_function_executable)
-- and 0029 (authenticated_security_definer_function_executable) flag any
-- SECURITY DEFINER function exposed via PostgREST at /rest/v1/rpc/<name>.
--
-- For internal-only functions (cron jobs, triggers, admin helpers, RLS
-- helpers) this exposure is unintended. We revoke EXECUTE so they can no
-- longer be called via the REST API.
--
-- Two groups:
--
--   GROUP A — INTERNAL-ONLY (cron / trigger / admin tools)
--     REVOKE EXECUTE FROM PUBLIC, anon, authenticated.
--     Triggers run as the function definer and ignore EXECUTE grants;
--     pg_cron jobs run as postgres role. Revoking the broad grants does
--     not break either path.
--
--   GROUP B — RLS HELPERS (called from policy USING / WITH CHECK clauses)
--     REVOKE FROM PUBLIC, anon. KEEP authenticated grant.
--     RLS evaluation requires the calling role to hold EXECUTE on the
--     helper. We verified (grep -rn) that no anon-scoped policy references
--     these helpers, so anon doesn't need EXECUTE — and dropping the grant
--     clears lint 0028 for these names.
--
-- NOT TOUCHED:
--   - count_market_by_*, estimate_property_price, get_app_config,
--     get_cities_by_canton, get_popular_articles, get_market_map_points,
--     get_price_hexagons, search_directory — these ARE intentional public
--     RPCs called from the marketplace anon UI. Lint 0028/0029 warnings
--     for them are expected and accepted.
--   - st_estimatedextent (PostGIS owned, can't ALTER).
--
-- Idempotent — REVOKE is safe to re-run.
-- ============================================================

-- ─── GROUP A: internal-only functions ────────────────────────
DO $$
DECLARE
  fn_name text;
  fn_args text;
  revoked_count integer := 0;
BEGIN
  FOR fn_name IN
    SELECT unnest(ARRAY[
      'daily_matching_scan',
      'handle_new_user',
      'hourly_automation_scan',
      'pg_database_size_mb',
      'run_search_alerts',
      'storage_size_mb',
      'trigger_matching_on_new_search',
      'trigger_matching_on_price_change',
      'trigger_matching_on_property_active',
      'trigger_matching_on_search_updated',
      'update_thread_on_new_message'
    ])
  LOOP
    FOR fn_args IN
      SELECT pg_get_function_identity_arguments(p.oid)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn_name
    LOOP
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
        fn_name, fn_args
      );
      revoked_count := revoked_count + 1;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Group A: REVOKE EXECUTE FROM PUBLIC/anon/authenticated on % internal function signature(s)',
    revoked_count;
END $$;

-- ─── GROUP B: RLS helpers (keep authenticated) ───────────────
DO $$
DECLARE
  fn_name text;
  fn_args text;
  revoked_count integer := 0;
BEGIN
  FOR fn_name IN
    SELECT unnest(ARRAY[
      'get_my_agency_id',
      'get_user_agency_id',
      'get_user_role',
      'is_super_admin'
    ])
  LOOP
    FOR fn_args IN
      SELECT pg_get_function_identity_arguments(p.oid)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn_name
    LOOP
      -- Drop broad grants (PUBLIC + anon)
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
        fn_name, fn_args
      );
      -- Re-affirm authenticated grant (RLS evaluation needs it)
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
        fn_name, fn_args
      );
      revoked_count := revoked_count + 1;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Group B: REVOKE FROM anon, GRANT TO authenticated on % RLS helper signature(s)',
    revoked_count;
END $$;

-- ─── Verification: log current EXECUTE grants for visibility ─
-- Logs which roles currently hold EXECUTE on each function so the
-- linter status can be cross-checked. Visible in Supabase Studio logs.
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'Post-Phase-B EXECUTE grants on flagged functions:';
  FOR rec IN
    SELECT
      p.proname AS fn,
      pg_get_function_identity_arguments(p.oid) AS args,
      array_agg(DISTINCT a.rolname ORDER BY a.rolname) FILTER (
        WHERE has_function_privilege(a.oid, p.oid, 'EXECUTE')
      ) AS roles_with_execute
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN pg_roles a
    WHERE n.nspname = 'public'
      AND p.proname IN (
        -- Group A
        'daily_matching_scan', 'handle_new_user', 'hourly_automation_scan',
        'pg_database_size_mb', 'run_search_alerts', 'storage_size_mb',
        'trigger_matching_on_new_search', 'trigger_matching_on_price_change',
        'trigger_matching_on_property_active', 'trigger_matching_on_search_updated',
        'update_thread_on_new_message',
        -- Group B
        'get_my_agency_id', 'get_user_agency_id', 'get_user_role', 'is_super_admin'
      )
      AND a.rolname IN ('anon', 'authenticated', 'postgres', 'service_role')
    GROUP BY p.oid, p.proname
    ORDER BY p.proname
  LOOP
    RAISE NOTICE '  - public.%(%) -> %', rec.fn, rec.args, rec.roles_with_execute;
  END LOOP;
END $$;
