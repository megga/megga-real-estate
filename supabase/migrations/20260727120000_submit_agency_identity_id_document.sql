-- Étape 2 du chantier KYB, tâche 6 — extension de submit_agency_identity() pour la
-- pièce d'identité du signataire. Voir le « Point d'extension » laissé par la tâche 1
-- dans 20260727100000_submit_agency_identity.sql (fichier volontairement NON modifié
-- rétroactivement — convention du dépôt, cf. docs/agency-kyb-verification.md §5bis).
--
-- Le fichier recto/verso est déposé côté client dans Storage (bucket documents,
-- préfixe kyb-identity, migration 20260727110000) : cette RPC ne touche jamais au
-- fichier lui-même. Sa seule responsabilité ici est de poser la ligne
-- agency_person_verification_checks (check_type='id_document', source='manual',
-- result='pending_manual_review') que le client ne peut PAS écrire lui-même — ces
-- tables n'ont aucune policy INSERT (RLS, 20260726130300), délibérément : seul un
-- SECURITY DEFINER comme celui-ci peut y écrire, pour qu'un inscrit ne fabrique pas sa
-- propre preuve de vérification.
--
-- ⚠ Piège signalé par la tâche 1, traité ici : agency_person_roles n'impose l'unicité
-- que sur (related_person_id, role) — rien n'empêche plusieurs personnes différentes
-- de porter chacune un rôle signatory actif pour la même agence (signature_power =
-- 'joint'). Il n'existe donc pas « le » signataire : p_related_person_id est un
-- paramètre explicite, fourni par le CLIENT — donc falsifiable. Avant tout insert, on
-- vérifie qu'il désigne bien une personne de CETTE agence (v_agency_id) ; sinon un
-- dirigeant de l'agence A pourrait faire poser une ligne de vérification sur un
-- signataire de l'agence B, le SECURITY DEFINER qui permet à cette RPC seule d'écrire
-- contournant la RLS pour le faire.
--
-- p_related_person_id est optionnel (défaut NULL) : rétrocompatible avec tout appel
-- existant `submit_agency_identity()` sans argument (tests de la tâche 1, inchangés).
--
-- ⚠ Postgres identifie une fonction par NOM + TYPES de paramètres — un DEFAULT ne
-- change pas la signature pour la résolution de CREATE OR REPLACE. Sans le DROP
-- explicite ci-dessous, la fonction zéro-argument de la tâche 1 et cette nouvelle
-- fonction à un argument coexisteraient comme deux surcharges DISTINCTES, et tout appel
-- `submit_agency_identity()` deviendrait ambigu (erreur Postgres 42725, « function is
-- not unique ») puisque les deux seraient alors invocables sans argument.
--
-- Idempotente : DROP FUNCTION IF EXISTS puis CREATE OR REPLACE, REVOKE/GRANT rejouables.

drop function if exists public.submit_agency_identity();

create or replace function public.submit_agency_identity(p_related_person_id uuid default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_agency_id        uuid;
  v_error            text;
  v_submitted        timestamptz;
  v_person_agency_id uuid;
begin
  -- 1. Garde : seul le dirigeant de SA propre agence peut clore la saisie — la même
  -- garde que celle qui protège la lecture des données de conformité
  -- (agency_related_persons, agency_person_roles, 20260726130200).
  if not public.is_agency_admin() then
    raise exception 'forbidden: agency_admin required' using errcode = '42501';
  end if;

  v_agency_id := public.get_my_agency_id();

  -- 2. Complétude : message distinct par cause (helper de la tâche 1), pour que le
  -- wizard sache à quelle étape ramener l'utilisateur. Inchangée par cette tâche : la
  -- pièce d'identité n'entre pas dans cette liste (décision de périmètre, cf. rapport
  -- de la tâche 6 — l'étape 5/tâche 7 gère l'exigence côté écran).
  v_error := public._agency_identity_completeness_error(v_agency_id);
  if v_error is not null then
    raise exception '%', v_error;
  end if;

  -- 3. Idempotence métier : un second appel (double clic, retry réseau) ne doit ni
  -- re-timestamper ni re-journaliser, ni reposer une seconde ligne de check. On sort
  -- silencieusement plutôt que de renvoyer une erreur : du point de vue de l'appelant,
  -- la soumission a déjà réussi.
  select identity_submitted_at into v_submitted
    from public.agencies
   where id = v_agency_id;

  if v_submitted is not null then
    return;
  end if;

  -- 4. Pièce d'identité (tâche 6) : si l'appelant désigne une personne, poser la ligne
  -- de check id_document en attente de revue humaine. Garde anti-fuite inter-agences
  -- AVANT tout insert (cf. en-tête) : v_person_agency_id reste NULL si l'id ne
  -- correspond à personne (comportement standard de `select into` sur zéro ligne), ce
  -- qui échoue par la même branche que « mauvaise agence » — fail-closed dans les deux
  -- cas, jamais un id fantôme silencieusement toléré.
  if p_related_person_id is not null then
    select agency_id into v_person_agency_id
      from public.agency_related_persons
     where id = p_related_person_id;

    if v_person_agency_id is null or v_person_agency_id is distinct from v_agency_id then
      raise exception 'forbidden: related person not in caller agency' using errcode = '42501';
    end if;

    -- Aucun prestataire de vérification automatique à ce stade (spec de conception,
    -- §14 hors périmètre) : le recto/verso déjà déposé par le client dans Storage
    -- attend une revue humaine, comme tout dossier suisse tant que le registre du
    -- commerce ne répond pas. Un seul insert possible par agence : le retour anticipé
    -- de l'étape 3 ci-dessus empêche tout second appel d'atteindre cette ligne, donc
    -- aucun risque d'empiler plusieurs 'pending_manual_review' pour la même personne.
    insert into public.agency_person_verification_checks
      (related_person_id, check_type, source, result)
    values
      (p_related_person_id, 'id_document', 'manual', 'pending_manual_review');
  end if;

  -- 5. Pose l'horodatage de soumission — c'est lui, pas verification_status, que lit
  -- le gate d'onboarding (20260726140300, tâche 2).
  update public.agencies
     set identity_submitted_at = now()
   where id = v_agency_id;

  -- 6. Audit LAB : category='kyc' (jamais 'compliance', absent du CHECK et qui ferait
  -- échouer l'insert — activity_events_category_check). actor_kind='user' avec
  -- actor_id posé : c'est un dirigeant qui agit, pas le système.
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity)
  values
    (v_agency_id, auth.uid(), 'user', 'agency_identity_submitted', 'agency', v_agency_id, 'kyc', 'info');
end;
$$;

comment on function public.submit_agency_identity(uuid) is
  'Le dirigeant déclare sa saisie d''identité KYB terminée (étape 2 onboarding). Vérifie la complétude (raison sociale, forme juridique, pays, signataire actif), pose agencies.identity_submitted_at, journalise dans activity_events (category=kyc). p_related_person_id (optionnel) : si fourni, pose aussi la ligne agency_person_verification_checks (check_type=id_document, source=manual, result=pending_manual_review) pour cette personne, APRÈS avoir vérifié qu''elle appartient à l''agence de l''appelant (42501 sinon). Idempotente : un second appel après succès ne fait rien, y compris pour le check. Voir docs/agency-kyb-verification.md et docs/superpowers/plans/2026-07-27-onboarding-kyb-etape-2.md (tâche 6).';

revoke all on function public.submit_agency_identity(uuid) from public, anon;
grant execute on function public.submit_agency_identity(uuid) to authenticated;
