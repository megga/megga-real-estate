-- team_invitations : ajouter le prédicat de rôle et le WITH CHECK manquants.
--
-- Les trois policies posées par 20260526130000 ne filtraient QUE l'agence, sans
-- aucun prédicat de rôle -- et l'UPDATE n'avait pas de WITH CHECK, donc il
-- suffisait que l'ANCIENNE ligne soit dans son agence pour pouvoir en réécrire
-- n'importe quelle colonne. Vérifié en base le 02.08.2026 : `authenticated`
-- détient bien INSERT/UPDATE/DELETE/TRUNCATE sur cette table (grants par défaut
-- du projet), donc la RLS est le seul verrou.
--
-- Chaîne d'élévation que cela ouvrait, pour un agent SIMPLE :
--   1. réécrire (ou insérer) une invitation de sa propre agence avec son e-mail
--      et `role = 'admin'` ;
--   2. lire le `token` via la policy SELECT ;
--   3. appeler l'edge `accept-team-invite` en mode `claim` : la vérification
--      d'e-mail passe (il l'a mis au sien) et la fonction écrit
--      `profiles.role = invitation.role`.
-- Le verrou anti-escalade 20260627120000 (`tg_profiles_guard_role_agency`) ne
-- l'arrête PAS : il ne lève son exception que si `current_user` vaut
-- 'authenticated' ou 'anon', or `accept-team-invite` écrit avec un client
-- service_role. Le plafond est `admin` -- l'enum `user_role` n'a pas de
-- `super_admin`.
--
-- Le prédicat retenu, `is_agency_admin()` (role in ('admin','manager')), est
-- EXACTEMENT la garde applicative que `send-team-invite` applique déjà
-- (`['admin','manager'].includes(profile.role)`). Cette fonction écrit avec le
-- JWT de l'appelant, donc sous RLS : le durcissement ne change rien au flux
-- légitime. `accept-team-invite` écrit en service_role et contourne la RLS de
-- toute façon. Le front, lui, n'accède JAMAIS à cette table directement
-- (vérifié : aucune occurrence dans src/ hors types générés).

-- `is_agency_admin()` vaut admin OU manager. Sans hiérarchie, un MANAGER
-- s'auto-promeut : POST direct sur /rest/v1/team_invitations (donc sans passer
-- par send-team-invite, où vit la garde de rang applicative), invitation à son
-- propre e-mail en `role='admin'`, puis claim. Cela défait deux règles que le
-- dépôt paie déjà du code pour tenir : la garde de rang de send-team-invite et
-- l'invariant « cannot change your own role » de team_set_member_role.
-- Le rang doit donc vivre DANS la policy, pas seulement dans l'edge.
--
-- `assistant` est un rôle d'agent à part entière (src/types/auth.ts AGENT_ROLES,
-- proposé par la console) : il est classé au niveau d'`agent`, pas exclu.
CREATE OR REPLACE FUNCTION public.team_role_rank(p_role text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'assistant' THEN 1
    WHEN 'agent'     THEN 1
    WHEN 'manager'   THEN 2
    WHEN 'admin'     THEN 3
    ELSE 0
  END;
$$;

COMMENT ON FUNCTION public.team_role_rank(text) IS
  'Hiérarchie des rôles d''équipe, pour interdire d''inviter au-dessus de soi. '
  'Doit rester alignée sur ROLE_RANK de supabase/functions/send-team-invite.';

-- `invited_by = auth.uid()` sur l'INSERT seulement : à l'UPDATE (annulation ou
-- renvoi), un dirigeant doit pouvoir agir sur l'invitation émise par un autre.
DROP POLICY IF EXISTS team_invitations_insert ON public.team_invitations;
CREATE POLICY team_invitations_insert ON public.team_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = get_user_agency_id()
    AND is_agency_admin()
    AND invited_by = auth.uid()
    AND team_role_rank(role::text) > 0
    AND team_role_rank(role::text) <= team_role_rank(get_user_role())
  );

-- Le WITH CHECK est le correctif de fond : sans lui, l'UPDATE ne contrôlait que
-- la ligne AVANT écriture, donc `agency_id`, `email` et `role` étaient libres.
DROP POLICY IF EXISTS team_invitations_update ON public.team_invitations;
CREATE POLICY team_invitations_update ON public.team_invitations
  FOR UPDATE TO authenticated
  USING (agency_id = get_user_agency_id() AND is_agency_admin())
  WITH CHECK (
    agency_id = get_user_agency_id()
    AND is_agency_admin()
    AND team_role_rank(role::text) > 0
    AND team_role_rank(role::text) <= team_role_rank(get_user_role())
  );

-- Lecture inchangée sur le fond (l'écran d'équipe liste les invitations en
-- attente), mais recadrée sur `authenticated` : la policy était `TO public`,
-- ce qui l'exposait aussi à `anon`.
DROP POLICY IF EXISTS team_invitations_select ON public.team_invitations;
CREATE POLICY team_invitations_select ON public.team_invitations
  FOR SELECT TO authenticated
  USING (agency_id = get_user_agency_id());

-- Aucun chemin anonyme ne touche cette table : la prévisualisation d'invitation
-- (`accept-team-invite`, action `preview`) passe par un client service_role.
REVOKE ALL ON public.team_invitations FROM anon;

-- Le DELETE n'était bloqué que par l'ABSENCE de policy DELETE — un accident de
-- RLS, pas une contrainte : la première policy `FOR ALL` écrite un jour ici le
-- rouvrirait sans que personne ne le remarque. Aucun chemin produit ne supprime
-- une invitation avec un JWT utilisateur (accept-team-invite et les tests
-- passent en service_role, que ce REVOKE n'affecte pas).
REVOKE DELETE, TRUNCATE ON public.team_invitations FROM authenticated;

COMMENT ON TABLE public.team_invitations IS
  'Invitations d''équipe par agence. Écritures réservées aux rôles admin/manager '
  '(policies + garde applicative de send-team-invite) : le token qu''elles portent '
  'vaut attribution de rôle au moment du claim (accept-team-invite écrit '
  'profiles.role en service_role, hors de portée du garde-fou tg_profiles_guard_role_agency).';
