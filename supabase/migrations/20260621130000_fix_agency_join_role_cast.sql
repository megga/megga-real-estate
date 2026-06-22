-- HOTFIX : create_agency_and_join / join_agency cassées en prod → onboarding bloqué.
--
-- `public.profiles.role` est de type TEXT, mais ces deux RPC mettaient à jour le rôle
-- avec un CASE dont la branche ELSE castait vers l'enum `user_role` :
--   role = CASE WHEN role IN (...) THEN role ELSE 'admin'::user_role END
-- Les deux branches du CASE (text `role` vs `user_role`) ne sont pas du même type →
-- ERROR 42804 « CASE types user_role and text cannot be matched » à CHAQUE appel.
--
-- Conséquence (découverte au test bout-en-bout du pré-vol pilote) : l'étape Agence de
-- l'onboarding (create_agency_and_join) échouait pour TOUT agent. Aucune agence créée
-- depuis le 2026-05-18 → un nouvel agent (Gregory) n'aurait jamais pu sortir de
-- l'onboarding (agency_id jamais posé → gate qui re-boucle). Une migration a basculé
-- `profiles.role` en TEXT sans corriger ces fonctions ; le trou est resté invisible
-- faute d'onboarding réel exécuté depuis.
--
-- Fix : ELSE en littéral TEXT ('admin' / 'agent'), cohérent avec le type de la colonne.
-- Aucun autre changement de logique.

CREATE OR REPLACE FUNCTION public.create_agency_and_join(p_name text, p_city text, p_canton text, p_solo boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid  UUID := auth.uid();
  v_slug TEXT;
  v_id   UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_slug := lower(regexp_replace(btrim(p_name), '\s+', '-', 'g'));
  IF EXISTS (SELECT 1 FROM agencies WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
  END IF;

  INSERT INTO agencies (name, slug, city, canton, solo, plan, status, created_by)
  VALUES (btrim(p_name), v_slug, btrim(p_city), p_canton, COALESCE(p_solo, false),
          'starter', 'active', v_uid)
  RETURNING id INTO v_id;

  UPDATE profiles
     SET agency_id = v_id,
         role = CASE
           WHEN role IN ('manager', 'admin', 'agent', 'assistant') THEN role
           ELSE 'admin'
         END
   WHERE id = v_uid;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_agency(p_agency_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM agencies WHERE id = p_agency_id) THEN
    RAISE EXCEPTION 'agency_not_found';
  END IF;

  UPDATE profiles
     SET agency_id = p_agency_id,
         role = CASE
           WHEN role IN ('agent', 'manager', 'admin', 'assistant') THEN role
           ELSE 'agent'
         END
   WHERE id = v_uid;
END;
$function$;
