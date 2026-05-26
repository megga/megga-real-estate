-- RPC pour vérifier si un email a déjà un compte Supabase Auth.
-- Utilisé sur la page de login pour brancher entre flow connexion / inscription
-- sans demander le mot de passe à un nouveau visiteur.
--
-- Sécurité : la fonction tourne en SECURITY DEFINER (elle a besoin d'accéder à
-- auth.users qui est restreint), mais ne retourne qu'un booléen — pas de fuite
-- de données. L'énumération d'emails est intentionnelle ici (on a besoin de
-- savoir pour brancher l'UX), pas une CVE.

CREATE OR REPLACE FUNCTION public.check_email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = lower(trim(p_email))
  )
$$;

-- Accessible aux utilisateurs anonymes (la page login est publique).
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO anon, authenticated;

COMMENT ON FUNCTION public.check_email_exists(text) IS
  'Retourne true si un compte existe déjà pour cet email. Utilisé par /login pour brancher entre signin et signup.';
