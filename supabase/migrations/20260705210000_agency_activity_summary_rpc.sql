-- ============================================================================
-- RPC: get_agency_activity_summary — per-agency event count + last activity
-- over a rolling window (default 30 days), aggregated SERVER-SIDE.
--
-- Motivation : AdminAgenciesPage chargeait *toutes* les lignes activity_events
-- des 30 derniers jours dans le navigateur (SELECT agency_id, created_at sans
-- LIMIT ni agrégation) pour calculer les scores de santé côté client. Sur une
-- table d'audit append-only (cf. 20260705171000_activity_events_retention),
-- ça tire des dizaines de milliers de lignes à chaque visite pour un
-- super_admin réel — anti-pattern perf (CLAUDE.md §7 : agréger côté serveur).
--
-- Cette fonction renvoie ~1 ligne par agence au lieu de tous les événements.
-- Index-backed par idx_activity_events_audit_filters
-- (agency_id, created_at DESC, category, severity) — pas de nouvel index.
--
-- Même pattern que get_agency_stats / get_onboarding_milestones
-- (SECURITY DEFINER + STABLE + search_path figé, GRANT authenticated).
-- L'enforcement super_admin réel reste en DB (RLS is_super_admin) et sur les
-- edges ; ce SECURITY DEFINER ne fait qu'agréger des colonnes non sensibles
-- (agency_id, count, max(created_at)) déjà lisibles par un super_admin.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_agency_activity_summary(
  agency_ids uuid[],
  since_days integer DEFAULT 30
)
RETURNS TABLE (
  agency_id uuid,
  event_count bigint,
  last_activity_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    e.agency_id,
    count(*) AS event_count,
    max(e.created_at) AS last_activity_at
  FROM public.activity_events e
  WHERE e.agency_id = ANY(agency_ids)
    AND e.created_at >= now() - make_interval(days => GREATEST(since_days, 0))
  GROUP BY e.agency_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_agency_activity_summary(uuid[], integer) TO authenticated;
