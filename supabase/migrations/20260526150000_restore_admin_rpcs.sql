-- Restore 2 super-admin RPCs that exist in code but were missing from the
-- baseline schema dump. Same pattern as 20260526_002_restore_check_email_exists.
--
-- Originals: supabase/migrations/_archived/20260404_004_agency_stats_rpc.sql
--
-- Without these, the typed Supabase client (`createClient<Database>`) rejects
-- the .rpc() calls in:
--   - src/hooks/useAdminAgencies.ts        (get_agency_stats)
--   - src/hooks/useOnboardingTracker.ts    (get_onboarding_milestones)
-- and at runtime PostgREST returns 404 — the super-admin dashboard stats
-- silently render 0s.

-- ============================================================================
-- get_agency_stats — per-agency agent/property/transaction counts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_agency_stats(agency_ids uuid[])
RETURNS TABLE (
  agency_id uuid,
  agent_count bigint,
  property_count bigint,
  transaction_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    a.id AS agency_id,
    COALESCE(p.cnt, 0) AS agent_count,
    COALESCE(pr.cnt, 0) AS property_count,
    COALESCE(t.cnt, 0) AS transaction_count
  FROM unnest(agency_ids) AS a(id)
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt FROM public.profiles WHERE profiles.agency_id = a.id
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt FROM public.properties WHERE properties.agency_id = a.id AND properties.status = 'active'
  ) pr ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt FROM public.transactions WHERE transactions.agency_id = a.id AND transactions.status = 'active'
  ) t ON true
  WHERE a.id = ANY(agency_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_agency_stats(uuid[]) TO authenticated;

-- ============================================================================
-- get_onboarding_milestones — first-mile checklist per agency
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_onboarding_milestones(agency_ids uuid[])
RETURNS TABLE (
  agency_id uuid,
  has_contact boolean,
  has_property boolean,
  has_kyc boolean,
  has_transaction boolean,
  has_match boolean,
  last_activity_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    a.id AS agency_id,
    EXISTS (SELECT 1 FROM public.contacts WHERE contacts.agency_id = a.id) AS has_contact,
    EXISTS (SELECT 1 FROM public.properties WHERE properties.agency_id = a.id) AS has_property,
    EXISTS (SELECT 1 FROM public.kyc_cases WHERE kyc_cases.agency_id = a.id) AS has_kyc,
    EXISTS (SELECT 1 FROM public.transactions WHERE transactions.agency_id = a.id) AS has_transaction,
    EXISTS (SELECT 1 FROM public.matches WHERE matches.agency_id = a.id) AS has_match,
    (SELECT max(created_at) FROM public.activity_events WHERE activity_events.agency_id = a.id) AS last_activity_at
  FROM unnest(agency_ids) AS a(id);
$$;

GRANT EXECUTE ON FUNCTION public.get_onboarding_milestones(uuid[]) TO authenticated;
