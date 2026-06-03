-- Palier 3b. Agrège whatsapp_confirmation_log par agent+outil (oui/non, dernier non) et joint
-- l'autonomie de l'agent. Flague suggest_resume UNIQUEMENT pour update_pipeline (SEUL outil
-- élevable ; le socle légal ne devient JAMAIS auto) quand ≥10 oui, 0 non, autonomy≠resume.
-- SECURITY DEFINER (contourne la RLS du journal) ; REVOKE anon + GRANT authenticated ; la garde
-- d'accès est le SuperAdminGuard frontend (pattern get_admin_monitoring_health). Idempotent.

CREATE OR REPLACE FUNCTION public.get_whatsapp_autonomy_suggestions()
RETURNS TABLE (
  profile_id uuid, agent_name text, agency_id uuid, autonomy text,
  tool text, yes_count bigint, no_count bigint, last_no_at timestamptz, suggest_resume boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
  WITH agg AS (
    SELECT l.profile_id, l.tool,
      count(*) FILTER (WHERE l.outcome = 'yes') AS yes_count,
      count(*) FILTER (WHERE l.outcome = 'no')  AS no_count,
      max(l.created_at) FILTER (WHERE l.outcome = 'no') AS last_no_at
    FROM whatsapp_confirmation_log l
    GROUP BY l.profile_id, l.tool
  )
  SELECT a.profile_id, p.full_name AS agent_name, p.agency_id,
    -- p.agency_id / autonomy : affiliation COURANTE de l'agent (profiles), pas figée au log
    (p.day0_payload->>'autonomy') AS autonomy,
    a.tool, a.yes_count, a.no_count, a.last_no_at,
    (a.tool = 'update_pipeline' AND a.yes_count >= 10 AND a.no_count = 0
      AND COALESCE(p.day0_payload->>'autonomy', '') <> 'resume') AS suggest_resume
  FROM agg a JOIN profiles p ON p.id = a.profile_id
  ORDER BY a.profile_id, a.tool;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_autonomy_suggestions() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_autonomy_suggestions() TO authenticated;

COMMENT ON FUNCTION public.get_whatsapp_autonomy_suggestions() IS 'Palier 3b — suggestions d''autonomie pour le super-admin. Agrège whatsapp_confirmation_log (oui/non par agent+outil). suggest_resume=true UNIQUEMENT pour update_pipeline (seul outil élevable) ; MEGGA observe, n''élève rien. Lisible via SuperAdminGuard frontend.';
