-- =====================================================================
-- Découplage LISTE DE DIFFUSION admin ↔ ALLOWLIST D'IDENTITÉ super-admin
--
-- Problème : les mails admin/cron (alerting horaire admin-monitoring →
--   _shared/admin-alerts.ts, rapport hebdomadaire weekly-report) sont
--   adressés à public.super_admin_allowlist(). Or cette MÊME allowlist est
--   l'IDENTITÉ super-admin via super_admin_allowlist_match() — consommée par
--   is_super_admin() (~30 policies RLS + RPCs admin), _shared/require-super-admin.ts
--   et les gardes anti-lockout (admin-user-lifecycle, admin-agency-lifecycle,
--   delete-account). Retirer un email de l'allowlist pour le sortir des mails
--   lui ferait AUSSI perdre son accès super-admin.
--
-- Fix : une liste de diffusion DÉRIVÉE = allowlist MOINS un opt-out éditable
--   (app_config.admin_alert_optout). L'identité reste super_admin_allowlist()
--   strictement intacte ; seuls les DESTINATAIRES d'emails changent.
--   Additif + idempotent (INSERT ... ON CONFLICT DO NOTHING, CREATE OR REPLACE).
-- =====================================================================

-- ── 1. Opt-out : array JSON d'emails en minuscules (éditable service_role) ───
-- app_config = clé/valeur TEXT (RLS sans policy → service_role uniquement).
-- ON CONFLICT DO NOTHING : ne réécrase pas un opt-out déjà ajusté en prod.
INSERT INTO public.app_config (key, value)
VALUES ('admin_alert_optout', '["hello@juarts.com"]')
ON CONFLICT (key) DO NOTHING;

-- ── 2. Destinataires = allowlist MOINS opt-out ──────────────────────────────
-- SECURITY DEFINER pour lire app_config (RLS sans policy) ; STABLE (lit une
-- table). L'identité super-admin reste super_admin_allowlist() : cette
-- fonction ne sert QUE de liste de diffusion pour les mails admin/cron.
CREATE OR REPLACE FUNCTION public.admin_alert_recipients()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(array_agg(e), ARRAY[]::text[])
  FROM unnest(public.super_admin_allowlist()) AS e
  WHERE lower(e) NOT IN (
    SELECT lower(x)
    FROM jsonb_array_elements_text(
      COALESCE((SELECT value::jsonb FROM public.app_config
                WHERE key = 'admin_alert_optout'), '[]'::jsonb)
    ) AS x
  );
$$;
COMMENT ON FUNCTION public.admin_alert_recipients() IS
  'Destinataires des mails admin/cron = super_admin_allowlist() moins app_config.admin_alert_optout (opt-out éditable service_role). NE modifie PAS l''identité super-admin.';

-- Grants calqués sur super_admin_allowlist() (migration 20260705160000) :
-- fonction consommée uniquement côté serveur (crons/edges en service_role).
REVOKE ALL ON FUNCTION public.admin_alert_recipients() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_alert_recipients() TO service_role;
