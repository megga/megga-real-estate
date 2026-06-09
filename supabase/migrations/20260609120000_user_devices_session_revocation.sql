-- Révocation de session réelle pour « Déconnecter un appareil ».
--
-- Contexte : user_devices suivait l'appareil (fingerprint) mais n'avait AUCUN lien
-- vers la session auth. « Déconnecter » supprimait juste la ligne (révocation du
-- suivi) sans invalider le JWT distant. On ajoute le lien session + une RPC
-- service_role qui invalide la vraie session GoTrue.
--
-- Limite inhérente Supabase (assumée) : supprimer la ligne auth.sessions coupe le
-- REFRESH ; l'access token déjà émis reste valide jusqu'à son exp (~1h).
--
-- Idempotent (la CI ré-applique les migrations datées du jour à chaque deploy).

-- 1) Lien appareil -> session auth (NULL pour les lignes d'avant cette migration).
ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS session_id uuid;

-- 2) RPC de révocation. SECURITY DEFINER (exécutée comme le propriétaire = postgres,
--    qui a accès au schéma auth). SÉCURITÉ : ne supprime QUE si la session
--    appartient bien à p_user_id -> un utilisateur ne peut révoquer que SES sessions.
--    L'edge function appelle cette RPC avec l'id utilisateur VÉRIFIÉ (admin.getUser).
CREATE OR REPLACE FUNCTION public.revoke_user_session(p_user_id uuid, p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL THEN
    RETURN;
  END IF;
  -- Supprimer la session GoTrue (les refresh_tokens sont liés par session_id).
  DELETE FROM auth.sessions
  WHERE id = p_session_id
    AND user_id = p_user_id;
END;
$$;

-- 3) Garde d'exposition : service_role uniquement (jamais anon/authenticated).
REVOKE ALL ON FUNCTION public.revoke_user_session(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_user_session(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.revoke_user_session(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_session(uuid, uuid) TO service_role;
