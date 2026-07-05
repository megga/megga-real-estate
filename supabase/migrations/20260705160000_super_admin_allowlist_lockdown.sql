-- =====================================================================
-- SÉCURITÉ — Allowlist en dur des super-admins (verrouillage plateforme)
--
-- Menace : l'accès super-admin repose uniquement sur profiles.role='super_admin'.
--   * Toute élévation future (bug de policy, RPC mal gardée, compte admin
--     compromis) ouvre TOUTE la plateforme (KYC/PII de toutes les agences).
--   * admin_set_user_role permet à un super_admin d'en nommer un autre sans
--     restriction → un seul compte compromis suffit à en créer d'autres.
--
-- Fix : l'identité super-admin devient rôle ET email allowlisté en dur
-- (hello@juarts.com, ttaillefer.dev@gmail.com). Défense en profondeur :
--
--   1. is_super_admin() (point de passage unique de ~30 policies RLS + RPCs
--      admin) exige désormais l'email allowlisté — lu depuis auth.users
--      (source autoritative), PAS profiles.email (auto-modifiable par
--      l'utilisateur : le re-grant colonne de 20260627120000 laisse email
--      écrivable), PAS auth.jwt()->>'email' (périmé jusqu'à expiration après
--      un changement d'email).
--   2. admin_set_user_role refuse de poser 'super_admin' sur un email hors
--      allowlist + journalise désormais role_changed dans activity_events.
--   3. Nettoyage one-shot : tout profil super_admin non allowlisté est
--      rétrogradé 'admin' (événement critical par ligne), et les comptes
--      allowlistés existants sont promus super_admin (la plateforme ne peut
--      pas se retrouver sans super-admin légitime après cette migration).
--   4. Les edges admin passent par _shared/require-super-admin.ts qui
--      revérifie l'allowlist côté serveur (RPC super_admin_allowlist_match).
--
-- Échappatoire CI (validée) : super_admin_allowlist_match accepte AUSSI un
-- email dont le domaine égale app_config.super_admin_test_domain — clé
-- ABSENTE en prod, écrivable uniquement par service_role (app_config a RLS
-- sans policy), et contrainte au format '@…​.local' (TLD non routable RFC :
-- aucun signup réel confirmable). Les specs backend (cron-health, whatsapp-*,
-- rls-isolation-*) créent leurs super-admins de test en @megga-test.local.
-- Dev local : seeder un super_admin @megga-test.local + poser la clé
-- super_admin_test_domain='@megga-test.local' via service_role.
--
-- Inclut aussi :
--   * is_service_role() + guard de get_cron_health élargi (l'alerting cron
--     de admin-monitoring appellera les RPC santé avec la service key).
--   * admin_log_impersonation() : audit d'impersonation côté serveur,
--     bloquant (useImpersonate n'écrit plus activity_events en direct).
-- =====================================================================

-- ── 1. Source unique de l'allowlist ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.super_admin_allowlist()
RETURNS text[]
LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT ARRAY['hello@juarts.com', 'ttaillefer.dev@gmail.com'];
$$;
COMMENT ON FUNCTION public.super_admin_allowlist() IS
  'Allowlist EN DUR des emails super-admin (défense en profondeur, voir migration 20260705160000). Aussi consommée par l''alerting admin-monitoring (destinataires).';

REVOKE ALL ON FUNCTION public.super_admin_allowlist() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_allowlist() TO service_role;

-- ── 2. Match allowlist (+ échappatoire CI bornée .local) ────────────────────
CREATE OR REPLACE FUNCTION public.super_admin_allowlist_match(p_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT p_email IS NOT NULL AND (
    lower(p_email) = ANY (public.super_admin_allowlist())
    OR EXISTS (
      -- Échappatoire CI : domaine de test posé par service_role uniquement
      -- (app_config = RLS sans policy), contraint à '@….local' (non routable).
      -- right() = comparaison de suffixe stricte (pas de wildcards LIKE côté valeur).
      SELECT 1 FROM app_config c
      WHERE c.key = 'super_admin_test_domain'
        AND c.value LIKE '@%.local'
        AND right(lower(p_email), char_length(c.value)) = lower(c.value)
    )
  );
$$;
COMMENT ON FUNCTION public.super_admin_allowlist_match(text) IS
  'Vrai si l''email est allowlisté super-admin (liste en dur) ou matche le domaine de test CI (app_config.super_admin_test_domain, ''@….local'' seulement, absent en prod). Voir 20260705160000.';

REVOKE ALL ON FUNCTION public.super_admin_allowlist_match(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_allowlist_match(text) TO service_role;

-- ── 3. is_super_admin() : rôle ET email allowlisté ──────────────────────────
-- Même signature → les ~30 policies RLS et toutes les RPCs qui l'appellent
-- héritent du durcissement sans être touchées.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
      AND public.super_admin_allowlist_match(u.email::text)
  );
$$;
COMMENT ON FUNCTION public.is_super_admin() IS
  'Gate super-admin : rôle profiles.role=''super_admin'' ET email auth.users allowlisté en dur (super_admin_allowlist_match). Un rôle posé sur un email hors allowlist ne donne RIEN. Voir 20260705160000.';

-- ── 4. is_service_role() + guard get_cron_health élargi ─────────────────────
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    current_user::text
  ) = 'service_role';
$$;
COMMENT ON FUNCTION public.is_service_role() IS
  'Vrai si la requête porte la service key (claims PostgREST) ou tourne sous le rôle DB service_role. Utilisé par les RPC santé appelées par les crons admin.';

CREATE OR REPLACE FUNCTION public.get_cron_health()
RETURNS TABLE (jobname text, schedule text, active boolean, last_start timestamptz, last_status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Élargi (20260705160000) : l'alerting cron d'admin-monitoring lit la santé
  -- des jobs avec la service key.
  IF NOT (public.is_super_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT j.jobname::text, j.schedule::text, j.active,
           d.start_time, d.status::text
    FROM cron.job j
    LEFT JOIN LATERAL (
      SELECT r.start_time, r.status
      FROM cron.job_run_details r
      WHERE r.jobid = j.jobid
      ORDER BY r.start_time DESC
      LIMIT 1
    ) d ON true
    ORDER BY j.jobname;
END;
$$;

-- ── 5. admin_set_user_role : refus super_admin hors allowlist + audit ───────
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target_email  text;
  v_old_role      text;
  v_target_agency uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin required' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('super_admin', 'admin', 'manager', 'agent', 'assistant', 'seller', 'buyer', 'particulier') THEN
    RAISE EXCEPTION 'invalid role: %', p_role;
  END IF;

  SELECT u.email, p.role, p.agency_id
    INTO v_target_email, v_old_role, v_target_agency
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
   WHERE p.id = p_user_id;

  IF v_old_role IS NULL THEN
    RAISE EXCEPTION 'target profile not found';
  END IF;

  -- Allowlist : 'super_admin' réservé aux emails allowlistés (20260705160000).
  IF p_role = 'super_admin' AND NOT public.super_admin_allowlist_match(v_target_email) THEN
    RAISE EXCEPTION 'forbidden: super_admin restricted to allowlisted emails' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;

  -- role_changed est dans SENSIBLE_ACTIONS côté UI mais n'était jamais journalisé.
  IF p_role IS DISTINCT FROM v_old_role THEN
    INSERT INTO activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      v_target_agency, auth.uid(), 'user', 'role_changed', 'profile', p_user_id,
      'auth', 'warn', v_target_email,
      jsonb_build_object('old_role', v_old_role, 'new_role', p_role, 'via', 'admin_set_user_role')
    );
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;

-- ── 6. Nettoyage one-shot : démotion hors allowlist + promotion des 2 comptes ─
DO $$
DECLARE
  r RECORD;
BEGIN
  -- 6a. Rétrograder tout super_admin dont l'email n'est pas allowlisté.
  FOR r IN
    SELECT p.id, p.agency_id, u.email
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
     WHERE p.role = 'super_admin'
       AND NOT public.super_admin_allowlist_match(u.email::text)
  LOOP
    UPDATE public.profiles SET role = 'admin' WHERE id = r.id;
    INSERT INTO activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      r.agency_id, NULL, 'system', 'role_changed', 'profile', r.id,
      'auth', 'critical', r.email,
      jsonb_build_object('old_role', 'super_admin', 'new_role', 'admin',
                         'reason', 'super_admin_allowlist_lockdown')
    );
  END LOOP;

  -- 6b. Promouvoir les comptes allowlistés existants (la plateforme ne doit
  -- pas sortir de cette migration sans super-admin légitime).
  FOR r IN
    SELECT p.id, p.agency_id, u.email, p.role AS old_role
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
     WHERE lower(u.email) = ANY (public.super_admin_allowlist())
       AND p.role IS DISTINCT FROM 'super_admin'
  LOOP
    UPDATE public.profiles SET role = 'super_admin' WHERE id = r.id;
    INSERT INTO activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      r.agency_id, NULL, 'system', 'role_changed', 'profile', r.id,
      'auth', 'warn', r.email,
      jsonb_build_object('old_role', r.old_role, 'new_role', 'super_admin',
                         'reason', 'super_admin_allowlist_lockdown')
    );
  END LOOP;
END
$$;

-- ── 7. Audit d'impersonation côté serveur (bloquant, appelé par useImpersonate)
CREATE OR REPLACE FUNCTION public.admin_log_impersonation(
  p_action    text,
  p_target_id uuid,
  p_metadata  jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target   RECORD;
  v_event_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin required' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('impersonate_start', 'impersonate_stop') THEN
    RAISE EXCEPTION 'invalid impersonation action: %', p_action;
  END IF;

  SELECT p.id, p.agency_id, p.email, p.full_name, p.role
    INTO v_target
    FROM public.profiles p
   WHERE p.id = p_target_id;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'target profile not found';
  END IF;

  INSERT INTO activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    v_target.agency_id, auth.uid(), 'user', p_action, 'profile', p_target_id,
    'auth', 'warn', coalesce(nullif(v_target.full_name, ''), v_target.email),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'target_id', p_target_id,
      'target_email', v_target.email,
      'target_role', v_target.role
    )
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;
COMMENT ON FUNCTION public.admin_log_impersonation(text, uuid, jsonb) IS
  'Audit d''impersonation côté serveur (activity_events, severity warn). useImpersonate DOIT obtenir un succès AVANT d''activer la vue impersonée (audit-first). Voir 20260705160000.';

REVOKE ALL ON FUNCTION public.admin_log_impersonation(text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_impersonation(text, uuid, jsonb) TO authenticated;
