-- Étape 7, tâche 2 : une pièce d'identité refusée redevient remplaçable.
--
-- LE DÉFAUT, ET POURQUOI IL ÉTAIT INSOLUBLE. Deux gardes, dans deux fonctions différentes,
-- se tenaient l'une l'autre :
--
--   1. submit_agency_identity (20260729151400) ne reposait jamais de ligne
--      agency_person_verification_checks dès qu'UNE ligne existait pour cette personne et
--      ce type, quel qu'en soit le `result`. Après un `mismatch`, une pièce remplacée ne
--      produisait donc JAMAIS de nouvelle demande de revue.
--   2. admin_resolve_agency_id_document (20260729151500) refusait de trancher dès qu'il
--      existait UNE ligne non-pending pour cette personne. Même si la garde 1 avait laissé
--      passer un remplacement, le relecteur n'aurait pas pu le trancher.
--
-- Le premier point était consigné comme dette de l'étape 2 et attribué à l'étape 5, où il
-- n'a pas été traité. Le second n'avait pas été identifié. C'est leur COMBINAISON qui
-- rendait un `mismatch` définitif : le véto de personne restait échoué, et le dossier
-- n'avait aucune voie de sortie, ni automatique ni humaine.
--
-- LA RÈGLE POSÉE ICI, ET SON POINT DE DÉCISION UNIQUE. Les deux tables de checks sont
-- append-only (20260729150300) : rien n'est jamais mis à jour, une nouvelle ligne est
-- insérée, et le moteur ne retient que la PLUS RÉCENTE par (personne, type). Les deux
-- gardes ci-dessus regardaient « existe-t-il une ligne … » alors que la seule question qui
-- ait un sens dans un journal append-only est « que dit la ligne LA PLUS RÉCENTE ».
--
-- « La plus récente » se départage EXACTEMENT comme le fait recompute_agency_verification
-- (20260729151200) : `order by checked_at desc, ctid desc`. Ce n'est pas un détail de
-- confort. checked_at vaut par défaut l'heure de DÉBUT de transaction, donc deux lignes
-- écrites dans la même transaction sont à égalité sur cette seule colonne, et c'est ctid
-- (l'ordre d'insertion physique) qui tranche. Une RPC qui ordonnerait autrement que le
-- moteur pourrait trancher une ligne que le moteur, lui, ne regarde pas : le relecteur
-- croirait avoir décidé, et le verdict ne compterait pas.
--
-- D'où _latest_person_verification_check() ci-dessous : UN SEUL endroit porte cet ordre,
-- et les deux fonctions l'interrogent. Même discipline que vatLookupOwner() dans
-- _shared/kyb-sources.ts : l'accord entre deux règles doit être une propriété du code, pas
-- deux prédicats à tenir d'accord à la main.
--
-- MIGRATION NOUVELLE, JAMAIS UNE REPRISE SUR PLACE. 20260729151400 et 20260729151500 sont
-- appliquées en production : leur version d'origine est déjà enregistrée dans
-- schema_migrations, et les modifier n'aurait aucun effet. Les deux fonctions sont donc
-- RECOPIÉES INTÉGRALEMENT ici depuis leur DERNIÈRE version, pas depuis la première :
-- submit_agency_identity a été redéfinie trois fois (20260729150800, 20260729151000,
-- 20260729151400) et seule la dernière porte le déclenchement net.http_post de la
-- vérification. Un `create or replace` partiel l'aurait perdu en silence.

-- ─── (0) Point de décision unique : la ligne la plus récente ────────────────────────
--
-- security definer : lit une table dont les policies refusent la lecture aux rôles
-- utilisateur (20260729150300). Appelée uniquement depuis les deux fonctions ci-dessous,
-- elles-mêmes SECURITY DEFINER appartenant à postgres -- d'où le REVOKE complet : aucun
-- rôle utilisateur n'a à l'appeler directement, et l'appel imbriqué s'exécute sous le
-- propriétaire.
--
-- stable, pas immutable : lit des lignes.
create or replace function public._latest_person_verification_check(
  p_related_person_id uuid,
  p_check_type text
)
returns table (check_id uuid, check_result text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select apvc.id, apvc.result
    from public.agency_person_verification_checks apvc
   where apvc.related_person_id = p_related_person_id
     and apvc.check_type = p_check_type
   -- MÊME ordre que recompute_agency_verification (20260729151200) : voir l'en-tête.
   order by apvc.checked_at desc, apvc.ctid desc
   limit 1
$$;

comment on function public._latest_person_verification_check(uuid, text) is
  'Étape 7, tâche 2 : la ligne LA PLUS RÉCENTE de agency_person_verification_checks pour une personne et un type, départagée EXACTEMENT comme recompute_agency_verification (checked_at desc, ctid desc -- checked_at seul est à égalité pour deux lignes de la même transaction). Point de décision unique de « où en est ce check », interrogé par submit_agency_identity (faut-il reposer une demande de revue ?) et par admin_resolve_agency_id_document (cette ligne est-elle bien celle qui attend ?). Les deux DOIVENT lire le même ordre que le moteur, sans quoi une décision humaine pourrait porter sur une ligne que le moteur ne regarde pas. Interne : REVOKE de tous les rôles utilisateur, appelée depuis des SECURITY DEFINER appartenant à postgres.';

revoke all on function public._latest_person_verification_check(uuid, text) from public, anon, authenticated, service_role;

-- ─── (1) submit_agency_identity : reposer une demande après un verdict défavorable ──
--
-- Recopie intégrale de la version 20260729151400. SEULE la garde de l'étape 4 change ;
-- tout le reste (garde is_agency_admin, complétude, verrou FOR UPDATE, garde inter-agences,
-- garde « signataire actif », idempotence métier, journal, déclenchement net.http_post) est
-- identique, ligne pour ligne.
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

    -- ═══ LA SEULE MODIFICATION DE CETTE FONCTION (étape 7, tâche 2) ═══
    --
    -- Avant : `if not exists (une ligne id_document quelconque)`. Après un verdict
    -- défavorable, cette garde ne reposait plus jamais de demande de revue, et la pièce
    -- devenait irremplaçable À VIE.
    --
    -- Maintenant : on regarde la ligne LA PLUS RÉCENTE, et on repose une demande sauf dans
    -- les deux cas où ce serait faux :
    --   - elle est déjà `pending_manual_review` : une demande est OUVERTE, en reposer une
    --     seconde ferait deux lignes en attente pour une seule pièce (c'est l'idempotence
    --     que garantissait l'ancienne garde, et elle est préservée : double clic, retry
    --     réseau, appel ultérieur sans p_related_person_id puis avec) ;
    --   - elle vaut `match` : la question est TRANCHÉE en faveur, rejouer la RPC ne doit
    --     pas rouvrir une revue déjà gagnée.
    --
    -- Tout le reste repose une demande. Formulé en `not in` plutôt qu'en `in (mismatch,
    -- partial)` DÉLIBÉRÉMENT : le jour où une nouvelle valeur de résultat apparaîtrait, le
    -- comportement par défaut doit être « la pièce reste remplaçable », c'est-à-dire le
    -- côté RÉCUPÉRABLE de l'erreur. Une énumération positive enfermerait l'agence sur une
    -- valeur que personne n'a pensé à y ajouter -- exactement le mode de défaillance que
    -- cette migration corrige.
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
  update public.agencies
     set identity_submitted_at = now()
   where id = v_agency_id;

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
  'Le dirigeant déclare sa saisie d''identité KYB terminée (étape 2 onboarding). Vérifie la complétude (raison sociale, forme juridique, pays, signataire actif), pose agencies.identity_submitted_at, journalise dans activity_events (category=kyc), puis déclenche agency-verification-run via net.http_post best-effort (jamais bloquant). p_related_person_id (optionnel) : si fourni, pose une demande de revue de la pièce d''identité (agency_person_verification_checks, check_type=id_document, source=manual, result=pending_manual_review) APRÈS avoir vérifié (1) que la personne appartient à l''agence de l''appelant et (2) qu''elle porte un rôle signatory ACTIF -- 42501 avec un message distinct par cause sinon -- y compris lors d''un appel ULTÉRIEUR à une première soumission. ÉTAPE 7, TÂCHE 2 : la demande est reposée dès que la ligne LA PLUS RÉCENTE pour cette personne (_latest_person_verification_check, même départage que le moteur) n''est ni ''pending_manual_review'' (une demande est déjà ouverte) ni ''match'' (question tranchée en faveur) -- une pièce refusée redevient donc remplaçable, ce qu''elle n''était pas : la garde d''origine ne regardait que l''EXISTENCE d''une ligne, ce qui rendait un mismatch définitif. Concurrence : verrou FOR UPDATE sur la ligne agencies. Idempotente : un second appel ne re-timestampe ni ne re-journalise identity_submitted_at, ne pose jamais deux demandes de revue simultanées pour la même personne, et ne redéclenche jamais la vérification. Voir docs/superpowers/plans/2026-07-30-onboarding-kyb-etape-7-remediation.md.';

-- ─── (2) admin_resolve_agency_id_document : trancher la pièce REMPLACÉE ────────────
--
-- Recopie intégrale de la version 20260729151500. SEULE la garde « déjà résolue » change.
create or replace function public.admin_resolve_agency_id_document(p_agency_id uuid, p_check_id uuid, p_result text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_related_person_id   uuid;
  v_check_type          text;
  v_agency_id           uuid;
  v_status              text;
  v_agency_name         text;
  v_latest_check_id     uuid;
  v_latest_check_result text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  -- match/partial/mismatch : le vocabulaire de la table, MOINS unavailable et
  -- pending_manual_review -- ce ne sont pas des décisions humaines, ce sont des absences de
  -- décision. Le relecteur A le document sous les yeux.
  if p_result not in ('match', 'partial', 'mismatch') then
    raise exception 'invalid result: % (expected match, partial or mismatch)', p_result;
  end if;

  select apvc.related_person_id, apvc.check_type
    into v_related_person_id, v_check_type
    from public.agency_person_verification_checks apvc
   where apvc.id = p_check_id;

  if v_related_person_id is null then
    raise exception 'verification check not found';
  end if;

  if v_check_type <> 'id_document' then
    raise exception 'not an id_document check (check_type=%)', v_check_type;
  end if;

  select arp.agency_id into v_agency_id
    from public.agency_related_persons arp
   where arp.id = v_related_person_id;

  -- Garde inter-agences : p_agency_id est une ASSERTION de l'appelant (« je m'attends à
  -- résoudre une pièce de CETTE agence-ci »), vérifiée contre l'agence réelle du check --
  -- jamais un filtre dans le WHERE, qui resterait muet sur un écart. IS DISTINCT FROM
  -- couvre aussi le cas défensif où l'un des deux serait NULL.
  if v_agency_id is distinct from p_agency_id then
    raise exception 'verification check does not belong to the specified agency';
  end if;

  -- FOR UPDATE sur agencies : même discipline que validate/reject/relaunch. Un dossier
  -- jamais soumis ou déjà tranché ne se laisse pas amender après coup.
  select verification_status, coalesce(legal_name, name) into v_status, v_agency_name
    from public.agencies
   where id = v_agency_id
     for update;

  if v_status is null then
    raise exception 'agency not found';
  end if;

  if v_status <> 'manual_review' then
    raise exception 'agency is not awaiting review (status=%)', v_status;
  end if;

  -- Verrou au niveau PERSONNE : la ligne en attente n'est jamais modifiée (append-only),
  -- donc la verrouiller elle-même ne sérialiserait rien face à deux résolutions
  -- concurrentes. La lecture ci-dessous vient APRÈS ce verrou, et c'est ce qui la rend
  -- fiable : le perdant de la course relit la ligne la plus récente une fois que le
  -- gagnant a committé la sienne.
  perform 1 from public.agency_related_persons where id = v_related_person_id for update;

  -- ═══ LA SEULE MODIFICATION DE CETTE FONCTION (étape 7, tâche 2) ═══
  --
  -- Avant : `if exists (une ligne non-pending pour cette personne)` -> refus. Cette garde
  -- refusait de trancher une pièce REMPLACÉE après un premier verdict défavorable : elle
  -- voyait l'ancien mismatch et concluait « déjà résolue », alors que la question posée
  -- était celle de la NOUVELLE pièce.
  --
  -- Maintenant : on ne tranche que la ligne la plus récente, et seulement si elle attend.
  -- Deux refus distincts, parce qu'ils appellent deux gestes différents :
  --   - `superseded` : p_check_id désigne une ligne dépassée par une plus récente. C'est
  --     un écran périmé (onglet resté ouvert, décision prise entre-temps par un autre
  --     relecteur) -- il faut recharger le dossier, pas réessayer.
  --   - `already resolved` : p_check_id EST la plus récente mais porte déjà un verdict.
  --     C'est un double clic, ou l'id d'une ligne de verdict passé par erreur.
  select check_id, check_result
    into v_latest_check_id, v_latest_check_result
    from public._latest_person_verification_check(v_related_person_id, 'id_document');

  if v_latest_check_id is distinct from p_check_id then
    raise exception 'id_document check superseded: a more recent line exists for this person';
  end if;

  if v_latest_check_result <> 'pending_manual_review' then
    raise exception 'id_document check already resolved for this person';
  end if;

  insert into public.agency_person_verification_checks
    (related_person_id, check_type, source, result)
  values
    (v_related_person_id, 'id_document', 'manual', p_result);

  -- entity_type='agency' (pas 'agency_related_person') : convention du chantier KYB malgré
  -- une action person-scoped -- related_person_id et check_id vivent dans metadata.
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, object_label, metadata)
  values (
    v_agency_id, auth.uid(), 'user', 'agency_identity_document_resolved', 'agency', v_agency_id,
    'kyc', case when p_result = 'mismatch' then 'warn' else 'info' end, v_agency_name,
    jsonb_build_object('related_person_id', v_related_person_id, 'check_id', p_check_id, 'result', p_result)
  );
end;
$$;

comment on function public.admin_resolve_agency_id_document(uuid, uuid, text) is
  'Décision humaine (étape 5, tâche 2) : le relecteur qui a vu le document tranche si la pièce d''identité correspond à la personne déclarée. p_agency_id : assertion de l''appelant vérifiée contre l''agence RÉELLE du check -- erreur explicite si écart, pour écarter un écran de détail périmé. Exige verification_status=''manual_review'' : refuse un dossier jamais soumis ou déjà tranché. INSERT append-only (jamais UPDATE) -- l''historique complet reste lisible depuis get_admin_agency_review_detail. p_result in (match, partial, mismatch). Verrou FOR UPDATE sur agencies PUIS agency_related_persons (pas sur la ligne de check, qui ne change jamais d''état). ÉTAPE 7, TÂCHE 2 : ne tranche que la ligne LA PLUS RÉCENTE (_latest_person_verification_check, même départage que le moteur) et seulement si elle vaut ''pending_manual_review'' -- deux refus distincts, ''superseded'' (ligne dépassée : recharger le dossier) et ''already resolved'' (double clic). La garde d''origine refusait dès qu''UNE ligne non-pending existait, ce qui rendait une pièce REMPLACÉE après un mismatch impossible à trancher : combinée à la garde de submit_agency_identity, elle faisait d''un mismatch un verdict définitif sans voie de sortie. Journalise activity_events (category=kyc, actor_kind=user, entity_type=agency, object_label=nom agence). super_admin uniquement. Voir docs/superpowers/plans/2026-07-30-onboarding-kyb-etape-7-remediation.md.';

revoke all on function public.admin_resolve_agency_id_document(uuid, uuid, text) from public, anon, service_role;
grant execute on function public.admin_resolve_agency_id_document(uuid, uuid, text) to authenticated;
