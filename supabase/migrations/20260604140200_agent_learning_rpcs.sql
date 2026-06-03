-- Apprentissage T1 : RPC super-admin pour lire et activer les profils de style appris.
-- Gardées is_super_admin() côté SERVEUR (ERRCODE 42501) — la RPC expose des données par-agent
-- CROSS-AGENCE (noms, style appris) ; sans ce check, tout user 'authenticated' pourrait l'appeler
-- en direct. Même pattern que get_whatsapp_autonomy_suggestions (P3b hotfix).

CREATE OR REPLACE FUNCTION public.get_agent_learned_styles()
RETURNS TABLE (agent_id uuid, agent_name text, agency_id uuid, learned_style jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Garde d'accès SERVEUR (pas seulement le SuperAdminGuard frontend) : cette RPC expose des
  -- données par-agent CROSS-AGENCE ; sans ce check, tout user 'authenticated' pourrait l'appeler
  -- en direct via supabase.rpc('get_agent_learned_styles').
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT p.id, p.full_name, p.agency_id, ap.learned_style
    FROM agent_ai_profiles ap JOIN profiles p ON p.id = ap.agent_id
    WHERE ap.learned_style IS NOT NULL
    ORDER BY p.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_agent_learned_styles() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_agent_learned_styles() TO authenticated;

COMMENT ON FUNCTION public.get_agent_learned_styles() IS 'Apprentissage T1 — liste les profils de style appris (learned_style IS NOT NULL) pour le super-admin. Garde serveur : public.is_super_admin() (ERRCODE 42501 si non autorisé) + SuperAdminGuard frontend. Données CROSS-AGENCE — ne jamais exposer sans la garde.';

-- Activation / désactivation / édition des traits par un super-admin.
-- L'UPDATE ne touche que les rows où learned_style IS NOT NULL (le cron doit avoir distillé
-- le style avant qu'on puisse l'activer — human-in-the-loop obligatoire).

CREATE OR REPLACE FUNCTION public.set_agent_learned_style(p_agent_id uuid, p_status text, p_traits text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Garde d'accès SERVEUR : idem get_agent_learned_styles (même exposition cross-agence +
  -- l'activation injecte le style dans le prompt WhatsApp de l'agent cible).
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('suggested', 'active', 'off') THEN
    RAISE EXCEPTION 'bad status' USING ERRCODE = '22023';
  END IF;

  UPDATE agent_ai_profiles
    SET learned_style = jsonb_set(
      jsonb_set(COALESCE(learned_style, '{}'::jsonb), '{status}', to_jsonb(p_status)),
      '{traits}', to_jsonb(COALESCE(p_traits, learned_style->>'traits', ''))
    )
    WHERE agent_id = p_agent_id AND learned_style IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.set_agent_learned_style(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_agent_learned_style(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.set_agent_learned_style(uuid, text, text) IS 'Apprentissage T1 — le super-admin active (status=active), suspend (off) ou ajuste les traits d''un profil de style appris. L''UPDATE est conditionné à learned_style IS NOT NULL (le cron doit avoir distillé le style avant activation). Garde serveur : public.is_super_admin() (ERRCODE 42501) + SuperAdminGuard frontend.';
