-- Restore RPC check_email_exists missing from the baseline schema dump.
-- The function is in prod (used by /login to branch signin vs signup),
-- but somehow didn't make it into the supabase db dump --schema public output.
-- Idempotent (CREATE OR REPLACE), so re-applying in prod is a no-op.

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

GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO anon, authenticated;

COMMENT ON FUNCTION public.check_email_exists(text) IS
  'Retourne true si un compte existe déjà pour cet email. Utilisé par /login pour brancher entre signin et signup.';
