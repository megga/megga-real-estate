-- ============================================================================
-- MEGGA Real Estate — Migration : RPCs admin batch + index composites
-- ============================================================================
-- Suite du red-team perf (PR précédente : get_admin_dashboard_stats). Cette
-- migration adresse les 13+ `count:'exact'` restants dans 4 hooks admin et
-- pose les index composites manquants identifiés dans l'audit.
--
-- Pattern : 1 RPC SQL par page admin → 1 round-trip au lieu de N parallèles.
-- ============================================================================

-- ============================================================================
-- A. Index composites (red-team CLAUDE.md §7 — ORDER BY sans index → seq scan)
-- ============================================================================

-- kyc_cases : status + created_at DESC (utilisé par useAdminCompliance, KycList)
CREATE INDEX IF NOT EXISTS idx_kyc_cases_status_created_at
  ON kyc_cases (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kyc_cases_screening_status
  ON kyc_cases (screening_status)
  WHERE screening_status = 'match';

-- activity_events : action + created_at DESC (useAdminMonitoring, useAdminLiveFeed)
CREATE INDEX IF NOT EXISTS idx_activity_events_action_created_at
  ON activity_events (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_created_at
  ON activity_events (created_at DESC);

-- support_tickets : status + updated_at (useAdminSupport)
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_updated_at
  ON support_tickets (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_sla_breached
  ON support_tickets (sla_breached, status)
  WHERE sla_breached = true;

-- moderation_actions : action + created_at DESC (useAdminModeration)
CREATE INDEX IF NOT EXISTS idx_moderation_actions_action_created_at
  ON moderation_actions (action, created_at DESC);

-- properties : moderation_status (useAdminModeration)
CREATE INDEX IF NOT EXISTS idx_properties_moderation_status
  ON properties (moderation_status)
  WHERE moderation_status = 'published';

-- ============================================================================
-- B. RPC : get_admin_compliance_stats()
-- Remplace 3 count:'exact' + 1 AVG dans useAdminCompliance.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_compliance_stats()
RETURNS TABLE (
  total bigint,
  pending bigint,
  screening_match bigint,
  avg_completion numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT COUNT(*) FROM kyc_cases),
    (SELECT COUNT(*) FROM kyc_cases WHERE status IN ('pending', 'in_progress')),
    (SELECT COUNT(*) FROM kyc_cases WHERE screening_status = 'match'),
    COALESCE((SELECT ROUND(AVG(completion_pct)::numeric, 1) FROM kyc_cases), 0)
$$;

REVOKE ALL ON FUNCTION public.get_admin_compliance_stats FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_compliance_stats TO authenticated;

-- ============================================================================
-- C. RPC : get_admin_support_stats()
-- Remplace 4 count:'exact' dans useAdminSupport.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_support_stats()
RETURNS TABLE (
  open_count bigint,
  new_count bigint,
  resolved_this_week bigint,
  sla_breached_open bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT COUNT(*) FROM support_tickets WHERE status = 'open'),
    (SELECT COUNT(*) FROM support_tickets WHERE status = 'new'),
    (SELECT COUNT(*) FROM support_tickets
      WHERE status = 'resolved'
        AND updated_at >= now() - INTERVAL '7 days'),
    (SELECT COUNT(*) FROM support_tickets
      WHERE sla_breached = true
        AND status IN ('new', 'open', 'pending'))
$$;

REVOKE ALL ON FUNCTION public.get_admin_support_stats FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_support_stats TO authenticated;

-- ============================================================================
-- D. RPC : get_admin_moderation_stats()
-- Remplace 3 count:'exact' dans useAdminModeration.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_moderation_stats()
RETURNS TABLE (
  published_count bigint,
  flags_this_month bigint,
  removes_this_month bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT COUNT(*) FROM properties WHERE moderation_status = 'published'),
    (SELECT COUNT(*) FROM moderation_actions
      WHERE action = 'flag'
        AND created_at >= date_trunc('month', now())),
    (SELECT COUNT(*) FROM moderation_actions
      WHERE action = 'remove'
        AND created_at >= date_trunc('month', now()))
$$;

REVOKE ALL ON FUNCTION public.get_admin_moderation_stats FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_moderation_stats TO authenticated;

-- ============================================================================
-- E. RPC : get_admin_monitoring_health()
-- Remplace 4 count:'exact' + 2 SELECT metric_value dans useAdminMonitoring.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_monitoring_health()
RETURNS TABLE (
  errors_last_24h bigint,
  emails_sent_today bigint,
  api_requests_today bigint,
  last_scraping_at timestamptz,
  db_size_mb numeric,
  storage_used_mb numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT COUNT(*) FROM activity_events
      WHERE action = 'edge_function_error'
        AND created_at >= now() - INTERVAL '24 hours'),
    (SELECT COUNT(*) FROM activity_events
      WHERE action = 'email_sent'
        AND created_at >= date_trunc('day', now())),
    (SELECT COUNT(*) FROM activity_events
      WHERE created_at >= date_trunc('day', now())),
    (SELECT MAX(created_at) FROM activity_events WHERE action = 'scraping_completed'),
    COALESCE((SELECT metric_value FROM platform_metrics
      WHERE metric_type = 'db_size_mb'
      ORDER BY recorded_at DESC LIMIT 1), 0),
    COALESCE((SELECT metric_value FROM platform_metrics
      WHERE metric_type = 'storage_used_mb'
      ORDER BY recorded_at DESC LIMIT 1), 0)
$$;

REVOKE ALL ON FUNCTION public.get_admin_monitoring_health FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_monitoring_health TO authenticated;
