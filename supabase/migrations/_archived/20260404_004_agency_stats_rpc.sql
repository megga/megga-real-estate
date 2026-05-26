-- ============================================================================
-- RPC: get_agency_stats — returns agent/property/transaction counts per agency
-- Replaces client-side counting that fetched all rows just to count.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_agency_stats(agency_ids uuid[])
RETURNS TABLE (
  agency_id uuid,
  agent_count bigint,
  property_count bigint,
  transaction_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    a.id AS agency_id,
    COALESCE(p.cnt, 0) AS agent_count,
    COALESCE(pr.cnt, 0) AS property_count,
    COALESCE(t.cnt, 0) AS transaction_count
  FROM unnest(agency_ids) AS a(id)
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt FROM profiles WHERE profiles.agency_id = a.id
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt FROM properties WHERE properties.agency_id = a.id AND properties.status = 'active'
  ) pr ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt FROM transactions WHERE transactions.agency_id = a.id AND transactions.status = 'active'
  ) t ON true
  WHERE a.id = ANY(agency_ids);
$$;

-- Grant execute to authenticated (super_admin check is done in the hook via RLS)
GRANT EXECUTE ON FUNCTION get_agency_stats(uuid[]) TO authenticated;

-- ============================================================================
-- RPC: get_onboarding_milestones — returns which milestones each agency has hit
-- Replaces fetching all rows from 5 tables just to check existence.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_onboarding_milestones(agency_ids uuid[])
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
AS $$
  SELECT
    a.id AS agency_id,
    EXISTS (SELECT 1 FROM contacts WHERE contacts.agency_id = a.id) AS has_contact,
    EXISTS (SELECT 1 FROM properties WHERE properties.agency_id = a.id) AS has_property,
    EXISTS (SELECT 1 FROM kyc_cases WHERE kyc_cases.agency_id = a.id) AS has_kyc,
    EXISTS (SELECT 1 FROM transactions WHERE transactions.agency_id = a.id) AS has_transaction,
    EXISTS (SELECT 1 FROM matches WHERE matches.agency_id = a.id) AS has_match,
    (SELECT max(created_at) FROM activity_events WHERE activity_events.agency_id = a.id) AS last_activity_at
  FROM unnest(agency_ids) AS a(id);
$$;

GRANT EXECUTE ON FUNCTION get_onboarding_milestones(uuid[]) TO authenticated;
