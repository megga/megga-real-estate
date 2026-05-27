-- Agencies RLS for agency members.
--
-- Découvert via le backend test agency-settings-wire.spec.ts : la prod n'a que
-- les policies super_admin sur agencies → les agents ne peuvent ni lire ni
-- éditer leur propre agence. Bloque la nouvelle AgencySection wired sur
-- useAgencySettings (PR #452).
--
-- Cette migration ajoute :
--   - agencies_members_select : tout membre lit la ligne de SON agence
--   - agencies_members_update : tout membre édite la ligne de SON agence
--
-- L'isolation cross-agence reste protégée par `id = get_user_agency_id()`.
-- Pas de policy INSERT/DELETE — la création passe par l'onboarding RPC, la
-- suppression est réservée au super_admin.
--
-- TODO RBAC : restreindre UPDATE aux rôles admin/manager une fois la table
-- agency_members + le RBAC ship. Pour l'instant la politique est ouverte à
-- tout membre car l'app n'a qu'un seul rôle effectif ("agent").

BEGIN;

DROP POLICY IF EXISTS "agencies_members_select" ON public.agencies;
CREATE POLICY "agencies_members_select" ON public.agencies
  FOR SELECT
  TO authenticated
  USING (id = public.get_user_agency_id());

DROP POLICY IF EXISTS "agencies_members_update" ON public.agencies;
CREATE POLICY "agencies_members_update" ON public.agencies
  FOR UPDATE
  TO authenticated
  USING (id = public.get_user_agency_id())
  WITH CHECK (id = public.get_user_agency_id());

COMMIT;
