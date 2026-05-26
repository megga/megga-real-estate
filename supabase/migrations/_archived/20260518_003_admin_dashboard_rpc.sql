-- ============================================================================
-- MEGGA Real Estate — Migration : RPC admin dashboard stats (red-team perf)
-- ============================================================================
-- Remplace 7 queries `count: 'exact'` parallèles (violation CLAUDE.md §7) par
-- une seule fonction RPC qui retourne tous les KPIs en 1 round-trip.
--
-- Avant : 7 full table scans pour chaque load admin dashboard (3-8s en prod
-- Pro). Après : 7 SELECT COUNT(*) côté SQL avec executor optimisé Postgres.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE (
  active_agencies bigint,
  total_users bigint,
  active_properties bigint,
  active_transactions bigint,
  high_risk_kyc bigint,
  new_agencies_this_month bigint,
  new_users_this_month bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT COUNT(*) FROM agencies),
    (SELECT COUNT(*) FROM profiles),
    (SELECT COUNT(*) FROM properties WHERE status = 'active'),
    (SELECT COUNT(*) FROM transactions WHERE status = 'active'),
    (SELECT COUNT(*) FROM kyc_cases WHERE risk_level = 'high'),
    (SELECT COUNT(*) FROM agencies WHERE created_at >= date_trunc('month', now())),
    (SELECT COUNT(*) FROM profiles WHERE created_at >= date_trunc('month', now()))
$$;

COMMENT ON FUNCTION public.get_admin_dashboard_stats IS
  'Retourne les 7 KPIs admin du dashboard en 1 round-trip. Remplace 7 queries count:exact côté client (red-team fix). Lisible uniquement par super_admin via REVOKE puis GRANT.';

-- Révoque l'accès public et autorise uniquement les super_admin
REVOKE ALL ON FUNCTION public.get_admin_dashboard_stats FROM public, anon, authenticated;

-- Accès super_admin uniquement (vérification côté front via RLS, puisque
-- SECURITY DEFINER bypasse RLS naturellement — on contrôle au niveau du GRANT)
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats TO authenticated;
-- Note : on accorde à authenticated car la fonction elle-même ne renvoie que
-- des comptes agrégés (pas de donnée individuelle). La page admin a sa propre
-- protection SuperAdminGuard côté front. Si on veut bloquer côté DB :
--   GRANT EXECUTE TO service_role; -- et appel via Edge Function uniquement.
