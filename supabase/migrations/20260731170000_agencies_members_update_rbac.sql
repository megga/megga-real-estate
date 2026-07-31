-- Étape 7, tâche 3 — correctif écart 1 (30 juillet 2026) : agencies_members_update ferme
-- enfin le TODO RBAC laissé ouvert par 20260527010000.
--
-- LE DÉFAUT. `agencies_members_update` (20260527010000) autorise TOUT membre authentifié à
-- écrire N'IMPORTE QUELLE colonne de la ligne de son agence — son propre commentaire porte
-- le TODO : « restreindre UPDATE aux rôles admin/manager une fois la table agency_members +
-- le RBAC ship. Pour l'instant la politique est ouverte à tout membre car l'app n'a qu'un
-- seul rôle effectif (agent) ». L'app a plusieurs rôles depuis (provision_solo_agency,
-- 20260729150500, pose role='admin' sur le fondateur ; vérifié en lisant cette migration
-- avant d'écrire celle-ci), et le TODO n'avait jamais été fermé.
--
-- 20260730130000 a verrouillé 5 colonnes DÉCLARATIVES par un trigger (garde qui lit
-- old.identity_submitted_at, jamais un fait que l'appelant contrôle). Mais un trigger par
-- colonne ne protège QUE les colonnes qu'il nomme. Mesuré en revue : `plan` reste écrivable
-- par tout membre — aucun revoke update ne le couvre (le seul du dépôt, 20260729151600, ne
-- vise que les 5 colonnes de vérification) et aucun trigger ne le protège. Un agent simple
-- pouvait donc encore se poser lui-même un plan supérieur en un appel PostgREST direct.
--
-- LA CORRECTION. Fermer le TODO à la racine : agencies_members_update elle-même exige
-- désormais is_agency_admin() (helper déjà existant — public, SECURITY DEFINER, role in
-- ('admin','manager') sur profiles — déjà utilisé par 20260730130000 et par les policies de
-- agency_related_persons / agency_person_verification_checks ; vérifié avant d'en écrire un
-- nouveau). C'est une défense INDÉPENDANTE du trigger par colonne : une couche RLS par RÔLE,
-- qui ferme la LIGNE entière aux membres qui ne dirigent pas leur agence, là où le trigger de
-- 20260730130000 ferme des COLONNES précises à tout le monde après soumission. Les deux se
-- complètent : le trigger protège l'identité vérifiée même contre un dirigeant après coup ;
-- cette policy protège tout le reste (plan compris) contre quiconque n'est pas dirigeant.
--
-- ATTENTION AU PATRON DÉCRIT PAR LE BRIEF POUR 20260729151600 : il le décrit mal. Le trigger
-- de cette migration-là (agencies_guard_verification_columns) N'ATTRAPE PAS les chemins
-- SECURITY DEFINER, il les EXEMPTE explicitement (current_user = 'authenticated' uniquement).
-- La seconde défense y est un filet contre une régression de GRANT (un futur `GRANT UPDATE ON
-- agencies TO authenticated` sans liste de colonnes), jamais contre un appel SECURITY DEFINER
-- légitime. Cette policy RLS suit le MÊME principe, pas celui décrit par le brief : TO
-- authenticated ne s'applique jamais à l'intérieur d'une fonction SECURITY DEFINER
-- (current_user y devient le propriétaire, postgres) ni à service_role.
--
-- EFFET DE BORD DÉCOUVERT EN VÉRIFIANT « qui écrit dans agencies » (comme demandé, pas
-- supposé). useAgencySettings.ts est bien le seul écrivain direct côté navigateur
-- (`.from('agencies').update(...)`, vérifié par grep sur tout src/), et toutes les RPC
-- SECURITY DEFINER du chantier KYB restent hors d'atteinte de cette policy par construction
-- (current_user=postgres à l'intérieur ; vérifié une à une : submit_agency_identity,
-- recompute_agency_verification, admin_validate_agency_review, admin_reject_agency_review,
-- admin_request_agency_correction, sweep_pending_agency_verifications, admin_set_agency_plan
-- sont TOUTES security definer). MAIS analytics_set_target (20260614150000, feature
-- Analytics, hors chantier KYB) est elle SECURITY INVOKER, et son propre commentaire le dit :
-- « s'appuie sur RLS agencies_members_update (ouverte à tout membre, sans garde de rôle) ».
-- Elle est appelée par AxGate (porte immersive du premier login, AUCUN garde de rôle côté
-- écran — n'importe quel agent nouvellement invité peut y atterrir si sa nouvelle agence n'a
-- pas encore d'objectif) et par MobileSettingsScreen (Réglages > objectif, accessible à tout
-- membre, pas seulement au premier login). Confirmé par un test déjà vert AVANT ce correctif
-- (analytics_rpcs.spec.ts, « set_target » x2) qui appelle ce RPC avec un client role='agent'
-- et attend un succès. Restreindre la policy SANS ajuster cette fonction l'aurait cassée EN
-- SILENCE : RLS filtre par USING, donc 0 ligne affectée, AUCUNE erreur renvoyée au client —
-- la porte AxGate resterait bloquée en boucle (même famille de symptôme que l'incident P0
-- c830f9a9), et l'activity_events écrit par la fonction mentirait (« objectif mis à jour »
-- alors que rien n'a changé). Corrigée ci-dessous en la passant SECURITY DEFINER, comme TOUS
-- les autres écrivains légitimes de agencies dans ce dépôt : elle reste strictement scopée à
-- la propre agence de l'appelant via get_my_agency_id() (lit auth.uid(), inchangé par le mode
-- SECURITY) — aucun élargissement de privilège, seulement un découplage de la policy qu'on
-- referme ici. Grants (EXECUTE authenticated/service_role) et search_path déjà pinné :
-- inchangés, seul le mode SECURITY change ; CREATE OR REPLACE préserve les grants existants.
--
-- Idempotente : DROP POLICY IF EXISTS avant CREATE, CREATE OR REPLACE FUNCTION.

begin;

-- ─── 1. agencies_members_update : réservée aux dirigeants ──────────────────────────
drop policy if exists "agencies_members_update" on public.agencies;
create policy "agencies_members_update" on public.agencies
  for update
  to authenticated
  using (id = public.get_user_agency_id() and public.is_agency_admin())
  with check (id = public.get_user_agency_id() and public.is_agency_admin());

comment on policy "agencies_members_update" on public.agencies is
  'Étape 7, tâche 3 (écart 1, 30 juillet 2026) : ferme le TODO RBAC de 20260527010000. Seul un dirigeant (role admin|manager, is_agency_admin()) peut écrire la ligne de sa propre agence via un UPDATE direct authenticated — un agent simple ne peut plus écrire AUCUNE colonne (identité comprise, déjà gelée par le trigger de 20260730130000, mais aussi plan et tout le reste, que rien d''autre ne protégeait). Défense par RÔLE, indépendante du trigger par COLONNE de 20260730130000. Ne s''applique jamais à l''intérieur d''une fonction SECURITY DEFINER (current_user y devient le propriétaire) ni à service_role.';

-- ─── 2. analytics_set_target : ne dépend plus de cette policy ──────────────────────
-- Corps IDENTIQUE à 20260614150000 — seul SECURITY INVOKER -> SECURITY DEFINER change (voir
-- en-tête). get_my_agency_id()/auth.uid() ne dépendent pas du mode SECURITY : le scope reste
-- strictement l'agence de l'appelant, aucun élargissement de privilège.
create or replace function public.analytics_set_target(p_yearly numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency  uuid := get_my_agency_id();
  v_yearly  numeric := ROUND(GREATEST(0, COALESCE(p_yearly, 0)));
  v_quarter numeric := ROUND(v_yearly / 4);
  v_month   numeric := ROUND(v_yearly / 12);
  v_prev    jsonb;
BEGIN
  IF v_agency IS NULL THEN
    RAISE EXCEPTION 'Aucune agence associée à l''utilisateur';
  END IF;

  SELECT jsonb_build_object(
    'yearly', yearly_target, 'quarterly', quarterly_target, 'monthly', monthly_target
  ) INTO v_prev
  FROM agencies WHERE id = v_agency;

  UPDATE agencies
  SET yearly_target = v_yearly,
      quarterly_target = v_quarter,
      monthly_target = v_month
  WHERE id = v_agency;

  INSERT INTO activity_events (
    agency_id, actor_id, actor_kind, action, entity_type, entity_id,
    category, severity, object_label, metadata
  ) VALUES (
    v_agency, auth.uid(), 'user', 'agency_target_updated', 'agency', v_agency,
    'settings', 'info', 'Objectif commercial annuel',
    jsonb_build_object(
      'basis', 'annual',
      'old', v_prev,
      'new', jsonb_build_object('yearly', v_yearly, 'quarterly', v_quarter, 'monthly', v_month)
    )
  );
END;
$$;

comment on function public.analytics_set_target(numeric) is
  'Persiste l''objectif commercial annuel de l''agence de l''appelant (dérive /4 et /12) + audit atomique dans activity_events. SECURITY DEFINER depuis le 30 juillet 2026 (étape 7, tâche 3, écart 1) : dépendait auparavant de la policy RLS agencies_members_update, resserrée aux rôles admin/manager par cette même migration (20260731170000) — cette fonction, elle, reste ouverte à tout membre authentifié (AxGate, le geste obligatoire du premier login, et Réglages > objectif n''ont aucun garde de rôle côté écran), strictement scopée à sa PROPRE agence via get_my_agency_id() (lit auth.uid(), inchangé par le mode SECURITY) : aucun élargissement de privilège, seulement un découplage de la policy resserrée.';

commit;
