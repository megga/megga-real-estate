-- Étape 2 du chantier KYB, tâche 6 — extension de submit_agency_identity() pour la
-- pièce d'identité du signataire. Voir le « Point d'extension » laissé par la tâche 1
-- dans 20260728108000_submit_agency_identity.sql (fichier volontairement NON modifié
-- rétroactivement — convention du dépôt, cf. docs/agency-kyb-verification.md §5bis).
--
-- Le fichier recto/verso est déposé côté client dans Storage (bucket documents,
-- préfixe kyb-identity, migration 20260728109000) : cette RPC ne touche jamais au
-- fichier lui-même. Sa seule responsabilité ici est de poser la ligne
-- agency_person_verification_checks (check_type='id_document', source='manual',
-- result='pending_manual_review') que le client ne peut PAS écrire lui-même — ces
-- tables n'ont aucune policy INSERT (RLS, 20260728103000), délibérément : seul un
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
-- ⚠ Correctif revue tâche 6, point 2 — verrou de concurrence : le SELECT sur
-- identity_submitted_at (étape 3 du corps ci-dessous) est un `select ... for update`
-- sur la ligne agencies. Sans lui, deux appels entrelacés (deux onglets, un double
-- clic) pouvaient tous deux lire l'ancienne valeur avant que l'un n'écrive, et
-- empiler chacun une ligne agency_person_verification_checks + un événement
-- activity_events (append-only, dix ans, jamais purgeable) pour la même personne —
-- reproduit par un test à appels concurrents réels (Promise.all), pas une hypothèse.
--
-- ⚠ Correctif revue tâche 6, point 3 — sémantique du retour anticipé « déjà soumis » :
-- l'étape 4 (pose du check) s'exécute désormais AVANT l'étape 5 (retour anticipé), pas
-- après. Le client actuel appelle encore submit_agency_identity() SANS argument à la
-- soumission initiale (câblage de p_related_person_id laissé à la tâche 7) : avec
-- l'ancien ordre, un appel ultérieur AVEC p_related_person_id une fois ce câblage fait
-- tombait dans le retour anticipé AVANT d'atteindre la pose du check, qui ne
-- s'exécutait donc plus JAMAIS pour une agence déjà soumise — neutralisé
-- définitivement, pas seulement retardé. L'étape 4 est gardée par `not exists` (jamais
-- un second insert pour la même personne, quel que soit l'état de soumission).
--
-- ⚠ Postgres identifie une fonction par NOM + TYPES de paramètres — un DEFAULT ne
-- change pas la signature pour la résolution de CREATE OR REPLACE. Sans le DROP
-- explicite ci-dessous, la fonction zéro-argument de la tâche 1 et cette nouvelle
-- fonction à un argument coexisteraient comme deux surcharges DISTINCTES, et tout appel
-- `submit_agency_identity()` deviendrait ambigu (erreur Postgres 42725, « function is
-- not unique ») puisque les deux seraient alors invocables sans argument.
--
-- ⚠ Correctif revue tâche 7, point 2 — rôle de la personne visée : la garde
-- d'appartenance à l'agence (étape 4 du corps ci-dessous) ferme la fuite INTER-agence
-- mais ne vérifiait pas que la personne désignée porte elle-même un rôle de
-- SIGNATAIRE ACTIF avant d'y poser une vérification de pièce d'identité. Pas
-- exploitable aujourd'hui — le client (IdentityShell.tsx handleSubmit) ne transmet
-- jamais que le signatoryId de CE parcours — mais un SECURITY DEFINER de conformité ne
-- doit pas dépendre pour sa correction d'une hypothèse sur son appelant : un
-- bénéficiaire effectif (ubo) de la MÊME agence passait la garde précédente sans
-- jamais avoir de pouvoir de signature. Ajouté un second `not exists`, avec un message
-- ('…is not an active signatory') distinct de celui de la garde d'agence, pour que les
-- deux causes de refus restent identifiables côté client.
--
-- Idempotente : DROP FUNCTION IF EXISTS puis CREATE OR REPLACE, REVOKE/GRANT rejouables.
-- Ce fichier est modifié SUR PLACE (jamais une nouvelle migration datée) pour les deux
-- correctifs de revue tâche 6 ET tâche 7 : daté du jour de son écriture initiale, le
-- pipeline rejoue son contenu complet à chaque déploiement de ce jour-là.

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
  -- (agency_related_persons, agency_person_roles, 20260728102000).
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

  -- 3. Verrou de concurrence (revue tâche 6, point 2) : `select ... for update` sur la
  -- ligne agencies sérialise les appels concurrents sur la même agence (deux onglets,
  -- un double clic dont le premier clic n'a pas encore désactivé le bouton) — le
  -- second appel BLOQUE jusqu'à ce que le premier ait committé (ou annulé), puis relit
  -- identity_submitted_at déjà posé. Sans ce verrou, deux appels entrelacés liraient
  -- tous deux v_submitted = null avant que l'un n'écrive, et empileraient chacun une
  -- ligne 'pending_manual_review' (étape 4) + un événement activity_events (étape 7,
  -- append-only, conservé dix ans, jamais purgeable) — prouvé par un test à N appels
  -- simultanés (Promise.all, jamais une boucle séquentielle). La décision de sortie
  -- anticipée elle-même est prise plus bas (étape 5), APRÈS l'étape 4 : voir son
  -- en-tête pour pourquoi (revue tâche 6, point 3).
  select identity_submitted_at into v_submitted
    from public.agencies
   where id = v_agency_id
     for update;

  -- 4. Pièce d'identité (tâche 6) : si l'appelant désigne une personne, poser la ligne
  -- de check id_document en attente de revue humaine — QUE le dossier soit à sa
  -- PREMIÈRE soumission ou déjà soumis (correctif revue tâche 6, point 3). Le client
  -- actuel appelle encore submit_agency_identity() SANS argument à la soumission
  -- initiale (useAgencyIdentity.ts `submit()` ; le câblage de p_related_person_id est
  -- laissé à la tâche 7) : un appel ultérieur AVEC p_related_person_id, une fois ce
  -- câblage fait, ne doit jamais rester sans effet à cause du retour anticipé de
  -- l'étape 5 ci-dessous — l'ancienne version de cette RPC vérifiait cette section
  -- APRÈS ce retour anticipé, qui neutralisait alors DÉFINITIVEMENT la pose du check
  -- dès que l'agence était déjà soumise. Prouvé par un test qui appelle sans argument
  -- puis avec, dans cet ordre exact. Garde anti-fuite inter-agences AVANT tout insert
  -- (cf. en-tête), dans TOUS les cas — soumis ou non : v_person_agency_id reste NULL
  -- si l'id ne correspond à personne (comportement standard de `select into` sur zéro
  -- ligne), ce qui échoue par la même branche que « mauvaise agence » — fail-closed
  -- dans les deux cas, jamais un id fantôme silencieusement toléré.
  if p_related_person_id is not null then
    select agency_id into v_person_agency_id
      from public.agency_related_persons
     where id = p_related_person_id;

    if v_person_agency_id is null or v_person_agency_id is distinct from v_agency_id then
      raise exception 'forbidden: related person not in caller agency' using errcode = '42501';
    end if;

    -- Correctif revue tâche 7, point 2 : la garde ci-dessus ferme la fuite
    -- INTER-agence (bonne agence) mais ne vérifiait pas que la personne visée porte
    -- elle-même un rôle de SIGNATAIRE ACTIF avant d'y poser une vérification de pièce
    -- d'identité — un bénéficiaire effectif (ubo) de la MÊME agence passait cette
    -- garde puisqu'elle ne teste que agency_id. Pas exploitable aujourd'hui : le
    -- client (IdentityShell.tsx handleSubmit) ne transmet jamais que le signatoryId de
    -- CE parcours. Mais SECURITY DEFINER de conformité : sa correction ne doit pas
    -- reposer sur une hypothèse concernant son appelant. Même discipline « actif » que
    -- _agency_identity_completeness_error (signatory, 20260728108000) : valid_to nul
    -- ou futur, un mandat radié ne doit pas compter. Message distinct de la garde
    -- d'agence ci-dessus, pour que les deux causes de refus restent identifiables.
    if not exists (
      select 1 from public.agency_person_roles
       where related_person_id = p_related_person_id
         and role = 'signatory'
         and (valid_to is null or valid_to > current_date)
    ) then
      raise exception 'forbidden: related person is not an active signatory' using errcode = '42501';
    end if;

    -- Aucun prestataire de vérification automatique à ce stade (spec de conception,
    -- §14 hors périmètre) : le recto/verso déjà déposé par le client dans Storage
    -- attend une revue humaine, comme tout dossier suisse tant que le registre du
    -- commerce ne répond pas. `not exists` (et non plus seulement le retour anticipé
    -- de l'étape 5, cf. son en-tête) garantit un seul insert par personne : idempotent
    -- que cet appel soit le premier pour cette personne ou un rejeu (double clic,
    -- retry réseau, nouvel appel après une première soumission sans p_related_person_id)
    -- — jamais un second 'pending_manual_review' pour la même personne, avant ou après
    -- soumission de l'agence. Sous concurrence, c'est le verrou FOR UPDATE de l'étape 3
    -- qui sérialise : le perdant de la course relit ce `not exists` APRÈS que le
    -- gagnant ait committé son insert, et le trouve alors faux.
    if not exists (
      select 1 from public.agency_person_verification_checks
       where related_person_id = p_related_person_id
         and check_type = 'id_document'
    ) then
      insert into public.agency_person_verification_checks
        (related_person_id, check_type, source, result)
      values
        (p_related_person_id, 'id_document', 'manual', 'pending_manual_review');
    end if;
  end if;

  -- 5. Idempotence métier : un second appel (double clic, retry réseau, ou un appel
  -- ultérieur avec p_related_person_id après une première soumission sans lui) ne doit
  -- ni re-timestamper ni re-journaliser — une éventuelle ligne de check vient d'être
  -- traitée par l'étape 4 ci-dessus, qui s'exécute que ce test soit vrai ou non. On
  -- sort silencieusement plutôt que de renvoyer une erreur : du point de vue de
  -- l'appelant, la soumission a déjà réussi.
  if v_submitted is not null then
    return;
  end if;

  -- 6. Pose l'horodatage de soumission — c'est lui, pas verification_status, que lit
  -- le gate d'onboarding (20260728107000, tâche 2).
  update public.agencies
     set identity_submitted_at = now()
   where id = v_agency_id;

  -- 7. Audit LAB : category='kyc' (jamais 'compliance', absent du CHECK et qui ferait
  -- échouer l'insert — activity_events_category_check). actor_kind='user' avec
  -- actor_id posé : c'est un dirigeant qui agit, pas le système.
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity)
  values
    (v_agency_id, auth.uid(), 'user', 'agency_identity_submitted', 'agency', v_agency_id, 'kyc', 'info');
end;
$$;

comment on function public.submit_agency_identity(uuid) is
  'Le dirigeant déclare sa saisie d''identité KYB terminée (étape 2 onboarding). Vérifie la complétude (raison sociale, forme juridique, pays, signataire actif), pose agencies.identity_submitted_at, journalise dans activity_events (category=kyc). p_related_person_id (optionnel) : si fourni, pose aussi la ligne agency_person_verification_checks (check_type=id_document, source=manual, result=pending_manual_review) pour cette personne, APRÈS avoir vérifié (1) qu''elle appartient à l''agence de l''appelant et (2) qu''elle porte un rôle signatory ACTIF (valid_to nul ou futur) — 42501 avec un message distinct pour chaque cause sinon — y compris lors d''un appel ULTÉRIEUR à une première soumission sans argument (jamais neutralisé par le retour anticipé). Concurrence : verrou FOR UPDATE sur la ligne agencies. Idempotente : un second appel ne re-timestampe ni ne re-journalise jamais identity_submitted_at ; ne repose jamais un second check id_document pour la même personne. Voir docs/agency-kyb-verification.md et docs/superpowers/plans/2026-07-27-onboarding-kyb-etape-2.md (tâches 6 et 7).';

revoke all on function public.submit_agency_identity(uuid) from public, anon;
grant execute on function public.submit_agency_identity(uuid) to authenticated;
