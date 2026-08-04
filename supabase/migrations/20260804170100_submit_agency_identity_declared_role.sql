-- submit_agency_identity() applique le rôle déclaré à l'étape 1 du wizard.
--
-- RECOPIE MÉCANIQUE de 20260731150000 (dernière définition en date), un seul bloc
-- ajouté — l'étape 6bis ci-dessous. Même convention que cette migration-là, qui
-- recopiait elle-même 20260731121000 : `create or replace` conserve les privilèges,
-- donc rien à redonner ; seul le COMMENT doit être réécrit, sans quoi il décrirait un
-- comportement qui vient de changer.
--
-- ── POURQUOI LE RÔLE EST POSÉ ICI, ET NULLE PART AILLEURS ────────────────────────
--
-- Le dirigeant choisit son rôle d'organisation à l'étape 1 (« Quel est votre rôle ? »,
-- à la place de l'ancien pouvoir de signature). La valeur est persistée aussitôt dans
-- agency_related_persons.agency_role (migration 20260804170000) — comme tout le reste
-- de ce wizard, fermer l'onglet ne la perd pas — mais elle n'atteint profiles.role
-- qu'ICI, à la soumission d'un dossier complet. Trois raisons, toutes mesurables :
--
--   1. Aucune RPC « je change mon propre rôle » n'est exposée au client, et ce n'est
--      pas un oubli : ce serait exactement la porte que le verrou anti-escalade de
--      privilèges a fermée (20260627120000 — profiles.role n'est plus écrivable par
--      `authenticated`, et team_set_member_role refuse explicitement de se viser
--      soi-même). Le seul chemin d'écriture reste un SECURITY DEFINER qui agit sur
--      auth.uid() seul, une fois, au bout d'un parcours de conformité.
--
--   2. Écrire le rôle DÈS l'étape 1 ferait sortir de son propre parcours celui qui se
--      déclare agent ou assistant : le gate d'onboarding n'existe que pour
--      admin|manager (resolveIdentityGateStatus, src/hooks/useIdentityGate.ts).
--
--   3. L'étape « rendez-vous », désormais obligatoire et placée avant le
--      récapitulatif, réserve via l'edge onboarding-call-book, qui exige elle aussi
--      admin|manager. Un dirigeant démis à l'étape 1 ne pourrait plus franchir
--      l'étape 4.
--
-- ── GARDE-FOU DERNIER ADMINISTRATEUR ─────────────────────────────────────────────
--
-- Une agence sans administrateur n'a plus personne pour ouvrir ses réglages, gérer sa
-- facturation ou inviter un collègue — et le fondateur d'une agence solo EST, par
-- construction, son seul admin (provision_solo_agency, 20260729150500). Si le rôle
-- déclaré retirait à l'agence son dernier administrateur, il n'est PAS appliqué au
-- compte : le dossier KYB garde la déclaration (agency_role, que la console admin
-- relit), le compte garde ses droits. L'écran de saisie annonce cette réserve AU
-- MOMENT DU CHOIX — elle n'est donc jamais une surprise constatée après coup.
--
-- Le garde-fou ne se déclenche que si l'appelant est lui-même admin : un manager qui
-- se déclare agent ne retire aucun administrateur à personne, et son changement passe.
--
-- ── PLACEMENT DANS LE CORPS ──────────────────────────────────────────────────────
--
-- APRÈS le retour anticipé de l'étape 5, délibérément — contrairement à l'étape 4
-- (pièce d'identité), qui doit s'exécuter même sur un dossier déjà soumis. Le rôle
-- s'applique UNE fois, à la première soumission : une resoumission après correction
-- demandée ne doit pas re-basculer un rôle que l'agence aurait entre-temps changé
-- depuis Réglages › Équipe. Le dossier, lui, garde toujours ce qui a été déclaré.

create or replace function public.submit_agency_identity(p_related_person_id uuid default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_agency_id           uuid;
  v_error               text;
  v_submitted           timestamptz;
  v_person_agency_id    uuid;
  v_base_url            text;
  v_svc_key             text;
  v_latest_check_id     uuid;
  v_latest_check_result text;
  v_declared_role       text;
  v_caller_role         text;
  v_would_orphan        boolean;
begin
  -- 1. Garde : seul le dirigeant de SA propre agence peut clore la saisie.
  if not public.is_agency_admin() then
    raise exception 'forbidden: agency_admin required' using errcode = '42501';
  end if;

  v_agency_id := public.get_my_agency_id();

  -- 2. Complétude : message distinct par cause, pour que le wizard sache à quelle étape
  -- ramener l'utilisateur. La pièce d'identité n'entre pas dans cette liste.
  v_error := public._agency_identity_completeness_error(v_agency_id);
  if v_error is not null then
    raise exception '%', v_error;
  end if;

  -- 3. Verrou de concurrence : `select ... for update` sur la ligne agencies sérialise les
  -- appels concurrents sur la même agence (deux onglets, un double clic). Le second appel
  -- BLOQUE jusqu'à ce que le premier ait committé, puis relit l'état à jour. C'est ce
  -- verrou, et non la garde de l'étape 4, qui empêche deux appels entrelacés d'empiler
  -- chacun une demande de revue.
  select identity_submitted_at into v_submitted
    from public.agencies
   where id = v_agency_id
     for update;

  -- 4. Pièce d'identité : si l'appelant désigne une personne, poser une demande de revue
  -- humaine, QUE le dossier soit à sa première soumission ou déjà soumis.
  if p_related_person_id is not null then
    select agency_id into v_person_agency_id
      from public.agency_related_persons
     where id = p_related_person_id;

    if v_person_agency_id is null or v_person_agency_id is distinct from v_agency_id then
      raise exception 'forbidden: related person not in caller agency' using errcode = '42501';
    end if;

    -- La personne visée doit porter un rôle de SIGNATAIRE ACTIF : un bénéficiaire effectif
    -- de la MÊME agence passait la garde ci-dessus, qui ne teste que agency_id. Même
    -- discipline « actif » que _agency_identity_completeness_error : valid_to nul ou futur,
    -- un mandat radié ne compte pas.
    if not exists (
      select 1 from public.agency_person_roles
       where related_person_id = p_related_person_id
         and role = 'signatory'
         and (valid_to is null or valid_to > current_date)
    ) then
      raise exception 'forbidden: related person is not an active signatory' using errcode = '42501';
    end if;

    -- Étape 7, tâche 2 : on regarde la ligne LA PLUS RÉCENTE, et on repose une demande
    -- sauf dans les deux cas où ce serait faux — une demande déjà OUVERTE
    -- (pending_manual_review), ou une question TRANCHÉE en faveur (match). Formulé en
    -- `not in` délibérément : le jour où une nouvelle valeur de résultat apparaîtrait, le
    -- comportement par défaut doit être « la pièce reste remplaçable ».
    select check_id, check_result
      into v_latest_check_id, v_latest_check_result
      from public._latest_person_verification_check(p_related_person_id, 'id_document');

    if v_latest_check_id is null or v_latest_check_result not in ('pending_manual_review', 'match') then
      insert into public.agency_person_verification_checks
        (related_person_id, check_type, source, result)
      values
        (p_related_person_id, 'id_document', 'manual', 'pending_manual_review');
    end if;
  end if;

  -- 5. Idempotence métier : un second appel ne re-timestampe ni ne re-journalise. On sort
  -- silencieusement plutôt que d'échouer : du point de vue de l'appelant, la soumission a
  -- déjà réussi. Ce retour couvre aussi le déclenchement de l'étape 8. L'étape 4 ci-dessus
  -- s'exécute AVANT ce retour, et c'est ce qui rend le redépôt d'une pièce possible sur un
  -- dossier déjà soumis.
  if v_submitted is not null then
    return;
  end if;

  -- 6. Pose l'horodatage de soumission -- c'est lui, pas verification_status, que lit le
  -- gate d'onboarding.
  --
  -- ETAPE 7, TACHE 5 : une resoumission apres correction demandee REND LA MAIN AU MOTEUR.
  -- Le moteur refuse d'ecraser 'correction_requested' (c'est une decision humaine, comme
  -- 'rejected' et 'validated'), donc si personne ne remettait le dossier en 'pending', il
  -- resterait bloque dans cet etat pour toujours. C'est ICI que la main se rend, dans la
  -- MEME UPDATE que l'horodatage, parce que c'est le meme evenement -- la resoumission --
  -- et qu'une seconde ecriture laisserait une fenetre ou l'horodatage est pose et le statut
  -- encore 'correction_requested'.
  update public.agencies
     set identity_submitted_at = now(),
         verification_status = case
           when verification_status = 'correction_requested' then 'pending'
           else verification_status
         end,
         verification_sweep_attempts = case
           when verification_status = 'correction_requested' then 0
           else verification_sweep_attempts
         end
   where id = v_agency_id;

  -- ═══ 6bis. LA SEULE ADDITION DE CETTE MIGRATION — le rôle déclaré ═══
  --
  -- Voir l'en-tête du fichier pour les trois raisons du placement et pour le garde-fou.
  -- Lu depuis la personne désignée par l'appelant, dont les deux gardes de l'étape 4 ont
  -- déjà établi qu'elle appartient à CETTE agence et y porte un rôle de signataire actif :
  -- aucune lecture supplémentaire n'est donc à re-vérifier ici. L'écriture, elle, ne porte
  -- QUE sur auth.uid() — jamais sur la ligne de la personne désignée, qui pourrait être
  -- quelqu'un d'autre.
  if p_related_person_id is not null then
    select agency_role into v_declared_role
      from public.agency_related_persons
     where id = p_related_person_id;
  end if;

  if v_declared_role is not null then
    select role into v_caller_role from public.profiles where id = auth.uid();

    -- « Ce changement laisserait-il l'agence sans administrateur ? » Trois conditions,
    -- toutes nécessaires : l'appelant est admin, il demande à ne plus l'être, et personne
    -- d'autre ne l'est dans son agence.
    v_would_orphan :=
      v_caller_role = 'admin'
      and v_declared_role is distinct from 'admin'
      and not exists (
        select 1 from public.profiles
         where agency_id = v_agency_id
           and role = 'admin'
           and id is distinct from auth.uid()
      );

    if not v_would_orphan and v_declared_role is distinct from v_caller_role then
      update public.profiles set role = v_declared_role where id = auth.uid();

      -- category='settings' et non 'kyc' : ce n'est pas un fait de conformité mais un
      -- changement de droits dans le produit, et c'est sous ce chapeau qu'on ira le
      -- chercher. severity='warn' : un rôle qui change mérite un regard, à plus forte
      -- raison quand il se pose sur le compte de celui qui le demande.
      insert into public.activity_events
        (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, metadata)
      values (
        v_agency_id, auth.uid(), 'user', 'agency_role_declared', 'profile', auth.uid(),
        'settings', 'warn',
        jsonb_build_object('from', v_caller_role, 'to', v_declared_role)
      );
    end if;
  end if;

  -- 7. Audit LAB : category='kyc' (jamais 'compliance', absent du CHECK).
  -- actor_kind='user' avec actor_id posé : c'est un dirigeant qui agit.
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity)
  values
    (v_agency_id, auth.uid(), 'user', 'agency_identity_submitted', 'agency', v_agency_id, 'kyc', 'info');

  -- 8. Déclenchement de la vérification KYB via net.http_post, best-effort à deux niveaux :
  -- un échec ne doit jamais faire échouer la soumission déjà committée ci-dessus.
  v_base_url := public.get_app_config('supabase_url');
  v_svc_key  := public.get_app_config('service_role_key');

  if v_base_url is not null and v_base_url <> '' and v_svc_key is not null and v_svc_key <> '' then
    begin
      perform net.http_post(
        url := v_base_url || '/functions/v1/agency-verification-run',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_svc_key
        ),
        body := jsonb_build_object('agency_id', v_agency_id),
        timeout_milliseconds := 15000
      );
    exception when others then
      raise warning 'submit_agency_identity: declenchement agency-verification-run echoue pour %: %', v_agency_id, sqlerrm;
    end;
  end if;
end;
$$;

comment on function public.submit_agency_identity(uuid) is
  'Le dirigeant déclare sa saisie d''identité KYB terminée (étape 2 onboarding). Vérifie la complétude (raison sociale, forme juridique, pays, signataire actif), pose agencies.identity_submitted_at, journalise dans activity_events (category=kyc), puis déclenche agency-verification-run via net.http_post best-effort (jamais bloquant). p_related_person_id (optionnel) : pose une demande de revue de la pièce d''identité après avoir vérifié que la personne appartient à l''agence de l''appelant ET porte un rôle signatory ACTIF. ÉTAPE 7, TÂCHE 2 : la demande est reposée dès que la ligne LA PLUS RÉCENTE pour cette personne (_latest_person_verification_check, même départage que le moteur) n''est ni pending_manual_review ni match — une pièce refusée redevient donc remplaçable. ÉTAPE 7, TÂCHE 5 : une resoumission d''un dossier en correction_requested le repasse en pending et remet verification_sweep_attempts à 0, dans la MÊME UPDATE que l''horodatage. RÔLE DÉCLARÉ (04.08.2026) : à la PREMIÈRE soumission seulement, applique agency_related_persons.agency_role de la personne désignée à profiles.role de l''APPELANT (auth.uid(), jamais la personne désignée) — seul chemin d''écriture de cette colonne pour un utilisateur, aucune RPC équivalente n''étant exposée au client depuis 20260627120000. N''est JAMAIS appliqué s''il retirait à l''agence son dernier administrateur : le dossier garde la déclaration, le compte garde ses droits. Journalise alors activity_events (category=settings, severity=warn, action=agency_role_declared). Concurrence : verrou FOR UPDATE sur la ligne agencies. Idempotente : un second appel ne re-timestampe ni ne re-journalise, ne pose jamais deux demandes de revue simultanées pour la même personne, ne réapplique jamais le rôle, et ne redéclenche jamais la vérification. Voir docs/superpowers/plans/2026-07-30-onboarding-kyb-etape-7-remediation.md.';
