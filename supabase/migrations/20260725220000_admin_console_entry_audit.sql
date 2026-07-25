-- ============================================================================
-- Audit : entrée en console super-admin
-- ============================================================================
-- Contexte : l'impersonation est journalisée depuis 20260705160000
-- (admin_log_impersonation), mais OUVRIR la console — donc lire Compliance,
-- Security Audit, les dossiers KYC de toutes les agences — ne laissait aucune
-- trace. La console passe sur son PROPRE domaine (admin.megga.ch) : chaque
-- ouverture doit produire une ligne d'audit, c'est ce qui rend l'accès
-- défendable devant un contrôle nLPD.
--
-- Même patron que admin_log_impersonation : SECURITY DEFINER gardée par
-- is_super_admin() (rôle ET email allowlisté), écriture dans activity_events,
-- exécution réservée aux sessions authentifiées.
--
-- agency_id NULL : l'événement est plateforme, il n'appartient à aucune agence.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_log_console_entry(
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor    RECORD;
  v_event_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin required' USING ERRCODE = '42501';
  END IF;

  SELECT p.id, p.email, p.full_name
    INTO v_actor
    FROM public.profiles p
   WHERE p.id = auth.uid();

  INSERT INTO activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    NULL, auth.uid(), 'user', 'admin_console_entered', 'admin_console', auth.uid(),
    'auth', 'warn', coalesce(nullif(v_actor.full_name, ''), v_actor.email),
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION public.admin_log_console_entry(jsonb) IS
  'Audit d''ouverture de la console super-admin (activity_events, severity warn). Appelée par SuperAdminGuard au montage. Voir 20260725220000.';

REVOKE ALL ON FUNCTION public.admin_log_console_entry(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_console_entry(jsonb) TO authenticated;
