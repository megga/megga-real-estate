-- RPC d'agrégation de l'usage des outils du copilote WhatsApp (clone de
-- get_whatsapp_autonomy_suggestions). Par outil : nb d'appels, nb d'erreurs, taux d'erreur, dernière
-- utilisation. Avec p_known_tools (catalogue WHATSAPP_TOOLS, SOURCE DE VÉRITÉ unique des noms
-- d'outils) : un LEFT JOIN révèle les OUTILS JAMAIS UTILISÉS (total_calls = 0, last_used_at = NULL).
-- Sans le paramètre : seulement les outils observés.
--
-- Pourquoi un paramètre plutôt qu'un catalogue codé en dur : la liste vit dans
-- _shared/whatsapp-tools.ts (TS). La coder ici créerait une dérive TS↔SQL. Le frontend phase-2 passe
-- le catalogue → une seule source de vérité.
--
-- SECURITY DEFINER (contourne la RLS) ; garde SERVEUR public.is_super_admin() (données cross-agence
-- sensibles) + SuperAdminGuard frontend ; REVOKE anon / GRANT authenticated. Idempotent.

CREATE OR REPLACE FUNCTION public.get_whatsapp_tool_usage_stats(p_known_tools text[] DEFAULT NULL)
RETURNS TABLE (
  tool text, total_calls bigint, error_count bigint, error_rate numeric, last_used_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Garde d'accès SERVEUR (pas seulement le SuperAdminGuard frontend) : usage par-agent CROSS-AGENCE.
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT u.tool AS tool,
      count(*)::bigint AS total_calls,
      count(*) FILTER (WHERE u.outcome = 'error')::bigint AS error_count,
      max(u.created_at) AS last_used_at
    FROM whatsapp_tool_usage u
    GROUP BY u.tool
  ),
  -- Univers des outils : le catalogue fourni (révèle les jamais-utilisés) OU, à défaut, les seuls
  -- outils observés.
  universe AS (
    SELECT DISTINCT x AS tool
    FROM unnest(COALESCE(p_known_tools, ARRAY(SELECT a.tool FROM agg a))) AS x
  )
  SELECT
    un.tool,
    COALESCE(a.total_calls, 0)::bigint,
    COALESCE(a.error_count, 0)::bigint,
    CASE WHEN COALESCE(a.total_calls, 0) = 0 THEN 0::numeric
         ELSE round(a.error_count::numeric / a.total_calls, 4) END,
    a.last_used_at
  FROM universe un
  LEFT JOIN agg a ON a.tool = un.tool
  ORDER BY COALESCE(a.total_calls, 0) DESC, un.tool;
END;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_tool_usage_stats(text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_tool_usage_stats(text[]) TO authenticated;

COMMENT ON FUNCTION public.get_whatsapp_tool_usage_stats(text[]) IS 'Observabilité outils WhatsApp — agrège whatsapp_tool_usage par outil (nb appels, erreurs, taux, dernière utilisation). p_known_tools (catalogue WHATSAPP_TOOLS) révèle les outils jamais utilisés via LEFT JOIN. Garde serveur public.is_super_admin() (ERRCODE 42501) + SuperAdminGuard frontend.';
