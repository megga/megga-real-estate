-- Suppression de l'onboarding post-login (wizard onboarding-sugar + premier-jour).
--
-- Le wizard était le SEUL chemin qui posait profiles.agency_id (étape Agence →
-- create_agency_and_join / join_agency ; le lockdown 20260627120000 interdit
-- l'update direct). Sans remplacement, tout nouveau signup vitrine (role agent)
-- atterrirait sur un CRM vide et muet (toutes les policies RLS verrouillent sur
-- agency_id). Remplacement : auto-provision d'une agence solo côté serveur.
--
--   1. provision_solo_agency() — helper interne (non exposé aux clients).
--   2. handle_new_user() — provisionne l'agence à l'inscription pour les rôles
--      agence. Best-effort : un échec de provisioning ne bloque JAMAIS le signup
--      (leçon incident signup vitrine) ; le compte peut être rattaché ensuite.
--   3. Backfill des comptes agence existants sans agency_id (piégés dans le
--      wizard jusqu'ici).
--   4. onboarding_completed / first_day_done → DEFAULT true + backfill : le gate
--      n'existe plus, et l'attribut Intercom `onboarding_completed` reste cohérent.
--   5. DROP onboarding_checklist (0 ligne, aucune écriture depuis src) et
--      search_agencies (autocomplete du wizard, orphelin).
--
-- CONSERVÉS volontairement : create_agency_and_join / join_agency (seuls chemins
-- SECURITY DEFINER légitimes pour agency_id, testés par onboarding-agency-rpc.spec),
-- day0_payload + compute_agent_preferences + gate d'autonomie WhatsApp (défauts
-- NULL sûrs = jamais d'auto-envoi ; le réglage d'autonomie vivra dans Réglages).
--
-- Idempotente : rejouable sans effet (CREATE OR REPLACE, IF EXISTS, updates gardés,
-- backfill sur agency_id IS NULL uniquement).

-- ── 1. Helper : création d'une agence solo pour un utilisateur ───────────────
-- Interne (appelé par handle_new_user + backfill) : PAS d'EXECUTE client.
CREATE OR REPLACE FUNCTION public.provision_solo_agency(p_user uuid, p_display_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text := COALESCE(NULLIF(btrim(p_display_name), ''), 'Mon agence');
  v_slug text;
  v_id   uuid;
BEGIN
  -- Même génération de slug que create_agency_and_join (cohérence).
  v_slug := lower(regexp_replace(btrim(v_name), '\s+', '-', 'g'));
  IF EXISTS (SELECT 1 FROM agencies WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
  END IF;

  INSERT INTO agencies (name, slug, solo, plan, status, created_by)
  VALUES (v_name, v_slug, true, 'starter', 'active', p_user)
  RETURNING id INTO v_id;

  -- Ne touche PAS role (déjà clampé par handle_new_user) ; ne rattache que si
  -- le profil n'a pas encore d'agence (idempotence backfill / double trigger).
  UPDATE profiles SET agency_id = v_id
  WHERE id = p_user AND agency_id IS NULL;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_solo_agency(uuid, text) FROM PUBLIC, anon, authenticated;

-- ── 2. handle_new_user : profil + agence solo à l'inscription ────────────────
-- Reprend la version lockdown (clamp du role, jamais super_admin) et ajoute le
-- provisioning. L'agence porte le nom de l'agent (renommable dans Réglages →
-- Agence).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_full_name text := COALESCE(NEW.raw_user_meta_data ->> 'full_name',
                               NEW.raw_user_meta_data ->> 'name', '');
  v_role      text := CASE
    WHEN (NEW.raw_user_meta_data ->> 'role') IN
         ('agent', 'manager', 'admin', 'assistant', 'seller', 'buyer', 'particulier')
      THEN NEW.raw_user_meta_data ->> 'role'
    ELSE 'buyer'
  END;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    v_full_name,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', ''),
    v_role
  );

  -- Rôles agence → agence solo immédiate (remplace l'étape Agence du wizard
  -- d'onboarding, supprimé). Best-effort : ne bloque jamais le signup.
  IF v_role IN ('agent', 'manager', 'admin', 'assistant') THEN
    BEGIN
      PERFORM public.provision_solo_agency(
        NEW.id,
        COALESCE(NULLIF(btrim(v_full_name), ''), split_part(COALESCE(NEW.email, ''), '@', 1))
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'provision_solo_agency failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3. Backfill : comptes agence existants sans agency_id ────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id, full_name, email FROM public.profiles
    WHERE agency_id IS NULL
      AND role IN ('agent', 'manager', 'admin', 'assistant')
  LOOP
    PERFORM public.provision_solo_agency(
      r.id,
      COALESCE(NULLIF(btrim(r.full_name), ''), split_part(r.email, '@', 1))
    );
  END LOOP;
END;
$$;

-- ── 4. Flags d'onboarding : plus jamais false ────────────────────────────────
ALTER TABLE public.profiles ALTER COLUMN onboarding_completed SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN first_day_done SET DEFAULT true;

UPDATE public.profiles SET onboarding_completed = true
WHERE onboarding_completed IS DISTINCT FROM true;
UPDATE public.profiles SET first_day_done = true
WHERE first_day_done IS DISTINCT FROM true;

-- ── 5. Objets morts ──────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.onboarding_checklist;
DROP FUNCTION IF EXISTS public.search_agencies(text, integer);
