-- Étape 2 du chantier KYB, tâche 1 — RPC de soumission de l'identité légale.
--
-- Le dirigeant clôt le wizard « Identité » en appelant cette fonction : elle vérifie
-- que le dossier est complet, pose agencies.identity_submitted_at et journalise
-- l'événement. C'est cet horodatage — pas verification_status, qui porte le VERDICT et
-- non l'avancement de la saisie (20260726140300) — que lira le gate d'onboarding
-- (AgentSugarLayout, tâche 2 de cette étape) pour savoir si l'agence a fini de saisir.
--
-- Deux fonctions plutôt qu'un corps monolithique :
--   • _agency_identity_completeness_error() isole la seule logique appelée à évoluer
--     à court terme. Une tâche ultérieure du même chantier ajoute le téléversement de
--     la pièce d'identité du signataire ; la ligne de check qui en résulte
--     (agency_person_verification_checks) devra être posée par CETTE RPC, puisque ces
--     tables refusent l'écriture à tout rôle utilisateur (20260726130300) — c'est la
--     garantie qu'un inscrit ne fabrique pas sa propre preuve de vérification. Le point
--     d'insertion est marqué plus bas, après que la complétude et l'idempotence sont
--     déjà tranchées : rien au-dessus n'aura à être retouché pour la greffer.
--   • submit_agency_identity() reste la seule interface publique (celle que le wizard
--     appelle) ; la séparation est un détail d'implémentation, invisible du client.
--
-- Idempotente : CREATE OR REPLACE FUNCTION, REVOKE/GRANT rejouables sans effet de bord.

-- ─── Helper interne : première cause de refus, ou NULL si le dossier est complet ────
-- Ordre de vérification imposé par le wizard (raison sociale → forme juridique → pays →
-- signataire) : c'est l'étape à laquelle l'interface doit ramener l'utilisateur en cas
-- de refus, donc un message générique unique rendrait ce refus inutilisable en aval.
--
-- STABLE (lecture seule). SECURITY DEFINER par cohérence avec le reste du fichier :
-- redondant tant que cette fonction n'est appelée que depuis submit_agency_identity()
-- (qui a déjà élevé le contexte d'exécution), mais évite une exception isolée si elle
-- est un jour invoquée autrement. Aucun EXECUTE client : REVOKE plus bas, même régime
-- que provision_solo_agency (20260726140100) — un SECURITY DEFINER appelé depuis un
-- autre SECURITY DEFINER s'exécute déjà sous le rôle propriétaire (postgres), le REVOKE
-- sur authenticated ne gêne donc pas submit_agency_identity().
create or replace function public._agency_identity_completeness_error(p_agency_id uuid)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_legal_name    text;
  v_legal_form_id uuid;
  v_country       text;
  v_has_signatory boolean;
begin
  select legal_name, legal_form_id, country
    into v_legal_name, v_legal_form_id, v_country
    from public.agencies
   where id = p_agency_id;

  if v_legal_name is null or btrim(v_legal_name) = '' then
    return 'agency_identity_incomplete: legal_name';
  end if;

  if v_legal_form_id is null then
    return 'agency_identity_incomplete: legal_form';
  end if;

  if v_country is null or btrim(v_country) = '' then
    return 'agency_identity_incomplete: country';
  end if;

  -- « Actif » : rôle signatory dont le mandat n'est pas expiré. valid_to nul = sans
  -- date de fin ; valid_to futur = mandat qui court encore. Un signataire radié
  -- (valid_to passé) ne doit pas compter, sous peine de valider un dossier dont plus
  -- personne n'a le pouvoir de signer.
  select exists (
    select 1
      from public.agency_person_roles apr
      join public.agency_related_persons arp on arp.id = apr.related_person_id
     where arp.agency_id = p_agency_id
       and apr.role = 'signatory'
       and (apr.valid_to is null or apr.valid_to > current_date)
  ) into v_has_signatory;

  if not v_has_signatory then
    return 'agency_identity_incomplete: signatory';
  end if;

  return null;
end;
$$;

comment on function public._agency_identity_completeness_error(uuid) is
  'Interne : première cause de refus de complétude KYB (raison sociale, forme juridique, pays, signataire actif — dans cet ordre), ou NULL si le dossier est complet. Isolée pour rester réutilisable telle quelle quand la tâche « pièce d''identité » étendra submit_agency_identity(). Aucun EXECUTE client.';

revoke all on function public._agency_identity_completeness_error(uuid) from public, anon, authenticated;

-- ─── RPC publique : soumission ───────────────────────────────────────────────
create or replace function public.submit_agency_identity()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_agency_id uuid;
  v_error     text;
  v_submitted timestamptz;
begin
  -- 1. Garde : seul le dirigeant de SA propre agence peut clore la saisie — la même
  -- garde que celle qui protège la lecture des données de conformité
  -- (agency_related_persons, agency_person_roles, 20260726130200).
  if not public.is_agency_admin() then
    raise exception 'forbidden: agency_admin required' using errcode = '42501';
  end if;

  v_agency_id := public.get_my_agency_id();

  -- 2. Complétude : message distinct par cause (helper ci-dessus), pour que le wizard
  -- sache à quelle étape ramener l'utilisateur.
  v_error := public._agency_identity_completeness_error(v_agency_id);
  if v_error is not null then
    raise exception '%', v_error;
  end if;

  -- 3. Idempotence métier : un second appel (double clic, retry réseau) ne doit ni
  -- re-timestamper ni re-journaliser. On sort silencieusement plutôt que de renvoyer
  -- une erreur : du point de vue de l'appelant, la soumission a déjà réussi.
  select identity_submitted_at into v_submitted
    from public.agencies
   where id = v_agency_id;

  if v_submitted is not null then
    return;
  end if;

  -- ── Point d'extension (tâche « pièce d'identité », même étape) ──────────────────
  -- Déjà en place : le point d'insertion (complétude et idempotence tranchées
  -- au-dessus, rien à retoucher pour ça) et le verrouillage de la table cible —
  -- agency_person_verification_checks n'a aucune policy INSERT (RLS, 20260726130300) :
  -- seule une RPC SECURITY DEFINER comme celle-ci peut y écrire, ce qui garantit qu'un
  -- inscrit ne fabrique pas sa propre preuve de vérification.
  --
  -- PAS une greffe purement additive, en revanche : cette RPC ne reçoit aujourd'hui
  -- aucun identifiant de personne, seulement v_agency_id. Or agency_person_roles
  -- n'impose l'unicité que sur (related_person_id, role) — rien n'empêche plusieurs
  -- personnes différentes de porter chacune un rôle signatory actif pour la même
  -- agence (c'est même le cas prévu par signature_power = 'joint'). Il n'existe donc
  -- pas « le » signataire : la tâche future devra ajouter un paramètre désignant
  -- explicitement la personne visée (p.ex. p_related_person_id uuid).
  --
  -- Piège à ne pas manquer : ce paramètre viendrait du client, donc falsifiable.
  -- Avant l'insert, vérifier qu'il désigne bien une personne de CETTE agence —
  --   select agency_id into v_person_agency_id
  --     from public.agency_related_persons where id = p_related_person_id;
  --   if v_person_agency_id is distinct from v_agency_id then
  --     raise exception 'forbidden: related person not in caller agency' using errcode = '42501';
  --   end if;
  -- Sans cette garde, un dirigeant de l'agence A pourrait faire poser une ligne de
  -- vérification sur un signataire de l'agence B : le SECURITY DEFINER qui permet à
  -- cette RPC seule d'écrire (paragraphe précédent) contourne la RLS pour le faire —
  -- rien ne rattrape une fuite inter-agences si l'appartenance n'est pas revérifiée
  -- explicitement ici.

  update public.agencies
     set identity_submitted_at = now()
   where id = v_agency_id;

  -- 5. Audit LAB : category='kyc' (jamais 'compliance', absent du CHECK et qui ferait
  -- échouer l'insert — activity_events_category_check). actor_kind='user' avec
  -- actor_id posé : c'est un dirigeant qui agit, pas le système.
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity)
  values
    (v_agency_id, auth.uid(), 'user', 'agency_identity_submitted', 'agency', v_agency_id, 'kyc', 'info');
end;
$$;

comment on function public.submit_agency_identity() is
  'Le dirigeant déclare sa saisie d''identité KYB terminée (étape 2 onboarding). Vérifie la complétude (raison sociale, forme juridique, pays, signataire actif), pose agencies.identity_submitted_at, journalise dans activity_events (category=kyc). Idempotente : un second appel après succès ne fait rien. Voir docs/agency-kyb-verification.md et docs/superpowers/plans/2026-07-27-onboarding-kyb-etape-2.md.';

revoke all on function public.submit_agency_identity() from public, anon;
grant execute on function public.submit_agency_identity() to authenticated;
