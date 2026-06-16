-- ════════════════════════════════════════════════════════════════════════════
-- MEGGA — Algo Focus : exposer le barème today_focus_v1 au client (tunable live)
-- ════════════════════════════════════════════════════════════════════════════
-- Le client ne peut PAS lire app_config (get_app_config non accordé à
-- authenticated). Ce RPC SECURITY DEFINER renvoie UNIQUEMENT la clé
-- 'today_focus_v1' (jamais tout app_config) → le scoring/tiers côté client
-- (focusScore.ts) devient pilotable depuis la DB sans redeploy. Renvoie '{}' si
-- la clé manque (le client retombe alors sur FOCUS_DEFAULTS via parseFocusConfig).
-- Suite de 20260616120000_today_focus.sql.

CREATE OR REPLACE FUNCTION public.get_today_focus_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value::jsonb FROM app_config WHERE key = 'today_focus_v1'),
    '{}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.get_today_focus_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_today_focus_config() TO authenticated, service_role;
