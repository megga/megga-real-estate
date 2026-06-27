-- =====================================================================
-- SÉCURITÉ — Élévation de privilège sur public.profiles (confirmée LIVE)
--
-- Trou (vérifié en prod via pg_policies / pg_proc / information_schema) :
--   * profiles_update_own            : FOR UPDATE USING (id = auth.uid())  SANS with_check
--   * "Users can update own profile" : doublon legacy, idem, sans with_check
--     → deux policies UPDATE permissives sur la même ligne. PostgreSQL combine
--       les with_check des policies permissives en OR : corriger une seule ne
--       suffit PAS, l'autre ré-ouvre le trou.
--   * authenticated/anon détiennent GRANT UPDATE (table-level → toutes colonnes,
--     dont role ET agency_id).
--   * aucun trigger ne garde ces colonnes.
--   → un agent authentifié pouvait, avec la clé anon publique + son propre JWT,
--     `PATCH /profiles?id=eq.<self>` en posant :
--       - role = 'super_admin'  → la policy super_admin_read_all_profiles ouvre
--         alors TOUTES les agences (KYC/PII inclus) ;
--       - agency_id = <autre>    → rattachement cross-tenant.
--   is_super_admin() lit profiles.role ; get_my_agency_id() lit profiles.agency_id
--   → l'escalade débloque immédiatement les deux fonctions de gating.
--
-- Principe du fix : role et agency_id deviennent NON ÉCRIVABLES par le rôle
-- authenticated/anon. La SEULE voie légitime pour les poser est service_role
-- ou une fonction SECURITY DEFINER (onboarding + RPC ci-dessous). Défense en
-- profondeur, 4 couches indépendantes :
--
--   1. RLS    — profiles_update_own recréée avec WITH CHECK qui FIGE role +
--               agency_id à leur valeur courante ; le doublon legacy
--               "Users can update own profile" est supprimé (sinon OR-bypass).
--   2. GRANT  — REVOKE UPDATE sur profiles FROM authenticated, anon ; puis
--               GRANT UPDATE sur TOUTES les colonnes SAUF role + agency_id
--               (liste générée dynamiquement → robuste aux colonnes ajoutées
--               après le baseline : preferences, rcc, mobile_phone, …).
--   3. TRIGGER— backstop BEFORE UPDATE : RAISE si current_user ∈
--               {authenticated, anon} tente de modifier role/agency_id.
--               Immunisé contre toute dérive future de policy ou de GRANT.
--   4. SIGNUP — handle_new_user() clamp le role issu du user_metadata : un
--               nouvel inscrit ne peut plus se déclarer 'super_admin'.
--
-- Chemins légitimes (RPC SECURITY DEFINER, owned by postgres → current_user =
-- postgres → exempts des 3 couches) : claim_pending_role (auto-claim au signup),
-- admin_set_user_role (panneau super-admin), team_set_member_role /
-- team_remove_member (gestion d'équipe agence).
--
-- Onboarding (create_agency_and_join / join_agency) : INCHANGÉ — déjà SECURITY
-- DEFINER owned by postgres → continue de poser role/agency_id. Régression
-- couverte par tests/backend/onboarding-agency-rpc.spec.ts.
-- =====================================================================

-- ── 1. RLS — figer role + agency_id sur l'auto-update ───────────────────────
-- Supprime le doublon legacy (PUBLIC, sans with_check) qui ré-ouvrait le OR.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recrée la policy canonique avec WITH CHECK : un user ne peut écrire sa propre
-- ligne QUE si role et agency_id restent identiques à leur valeur courante.
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND agency_id IS NOT DISTINCT FROM (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- ── 2. Privilèges colonne — retirer UPDATE(role) / UPDATE(agency_id) ─────────
-- Le GRANT table-level couvre toutes les colonnes ; un REVOKE colonne seul
-- serait un no-op tant que le grant table existe. On retire donc le grant
-- table puis on re-grant UPDATE colonne par colonne, SAUF role + agency_id.
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;  -- anon n'a aucune policy UPDATE de toute façon

DO $$
DECLARE
  v_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY column_name)
    INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'profiles'
     AND column_name NOT IN ('role', 'agency_id');  -- les deux colonnes sensibles
  EXECUTE format('GRANT UPDATE (%s) ON public.profiles TO authenticated', v_cols);
END
$$;

-- ── 3. Trigger backstop — bloque tout changement de role/agency_id ───────────
-- venant des rôles bas-privilège (authenticated/anon). service_role et toute
-- fonction SECURITY DEFINER (owned by postgres) tournent sous un current_user
-- différent → intentionnellement exemptés.
CREATE OR REPLACE FUNCTION public.tg_profiles_guard_role_agency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'profiles.role is read-only for % — use a SECURITY DEFINER RPC / service_role', current_user
        USING ERRCODE = '42501';
    END IF;
    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
      RAISE EXCEPTION 'profiles.agency_id is read-only for % — use a SECURITY DEFINER RPC / service_role', current_user
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.tg_profiles_guard_role_agency() IS
  'Backstop privilege-escalation : empêche authenticated/anon de modifier profiles.role ou profiles.agency_id. Voir migration 20260627120000.';

DROP TRIGGER IF EXISTS trg_profiles_guard_role_agency ON public.profiles;
CREATE TRIGGER trg_profiles_guard_role_agency
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_profiles_guard_role_agency();

-- ── 4. Signup — clamp du role issu du user_metadata (jamais super_admin) ─────
-- handle_new_user() insérait COALESCE(metadata.role, 'buyer') sans filtrage :
-- un signup avec user_metadata.role='super_admin' créait un profil super_admin.
-- On clamp à la liste des rôles auto-attribuables ; tout le reste → 'buyer'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', ''),
    CASE
      WHEN (NEW.raw_user_meta_data ->> 'role') IN
           ('agent', 'manager', 'admin', 'assistant', 'seller', 'buyer', 'particulier')
        THEN NEW.raw_user_meta_data ->> 'role'
      ELSE 'buyer'
    END
  );
  RETURN NEW;
END;
$$;

-- ── 5. Chemins légitimes (SECURITY DEFINER) ─────────────────────────────────

-- 5a. Auto-claim d'un rôle « en attente » au premier login (remplace l'update
--     client direct dans useAuth). Le rôle vient du JWT (user_metadata), n'est
--     appliqué QUE si le profil est encore buyer/particulier, et JAMAIS
--     super_admin. Reproduit exactement l'ancien comportement, côté serveur.
CREATE OR REPLACE FUNCTION public.claim_pending_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_meta_role text := auth.jwt() -> 'user_metadata' ->> 'role';
  v_current   text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT role INTO v_current FROM public.profiles WHERE id = v_uid;

  IF v_current IN ('buyer', 'particulier')
     AND v_meta_role IN ('agent', 'manager', 'admin', 'assistant') THEN
    UPDATE public.profiles SET role = v_meta_role WHERE id = v_uid;
    RETURN v_meta_role;
  END IF;

  RETURN v_current;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_pending_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_pending_role() TO authenticated;

-- 5b. Panneau super-admin : poser n'importe quel rôle (remplace useAdminUsers).
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin required' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('super_admin', 'admin', 'manager', 'agent', 'assistant', 'seller', 'buyer', 'particulier') THEN
    RAISE EXCEPTION 'invalid role: %', p_role;
  END IF;
  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;

-- 5c. Gestion d'équipe agence : changer le rôle d'un membre (remplace
--     useChangeTeamRole). super_admin OU admin/manager de la MÊME agence.
--     Ne peut poser que des rôles d'agence (jamais super_admin), ni se viser
--     soi-même.
CREATE OR REPLACE FUNCTION public.team_set_member_role(p_member_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_caller_role   text;
  v_caller_agency uuid;
  v_target_agency uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_role NOT IN ('agent', 'manager', 'admin', 'assistant') THEN
    RAISE EXCEPTION 'invalid team role: %', p_role;
  END IF;
  IF p_member_id = v_uid THEN
    RAISE EXCEPTION 'cannot change your own role';
  END IF;

  IF public.is_super_admin() THEN
    UPDATE public.profiles SET role = p_role WHERE id = p_member_id;
    RETURN;
  END IF;

  SELECT role, agency_id INTO v_caller_role, v_caller_agency
    FROM public.profiles WHERE id = v_uid;
  SELECT agency_id INTO v_target_agency
    FROM public.profiles WHERE id = p_member_id;

  IF v_caller_role NOT IN ('admin', 'manager')
     OR v_caller_agency IS NULL
     OR v_target_agency IS DISTINCT FROM v_caller_agency THEN
    RAISE EXCEPTION 'forbidden: agency admin/manager of the same agency required'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles SET role = p_role WHERE id = p_member_id;
END;
$$;
REVOKE ALL ON FUNCTION public.team_set_member_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_set_member_role(uuid, text) TO authenticated;

-- 5d. Gestion d'équipe agence : retirer un membre (remplace useRemoveTeamMember)
--     → détache l'agence + remet le rôle 'buyer'. Mêmes règles d'autorisation.
CREATE OR REPLACE FUNCTION public.team_remove_member(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_caller_role   text;
  v_caller_agency uuid;
  v_target_agency uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_member_id = v_uid THEN
    RAISE EXCEPTION 'cannot remove yourself';
  END IF;

  IF public.is_super_admin() THEN
    UPDATE public.profiles SET agency_id = NULL, role = 'buyer' WHERE id = p_member_id;
    RETURN;
  END IF;

  SELECT role, agency_id INTO v_caller_role, v_caller_agency
    FROM public.profiles WHERE id = v_uid;
  SELECT agency_id INTO v_target_agency
    FROM public.profiles WHERE id = p_member_id;

  IF v_caller_role NOT IN ('admin', 'manager')
     OR v_caller_agency IS NULL
     OR v_target_agency IS DISTINCT FROM v_caller_agency THEN
    RAISE EXCEPTION 'forbidden: agency admin/manager of the same agency required'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles SET agency_id = NULL, role = 'buyer' WHERE id = p_member_id;
END;
$$;
REVOKE ALL ON FUNCTION public.team_remove_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_remove_member(uuid) TO authenticated;
