-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Rembourser la DETTE du registre — les huit gestes super-admin écrivent dans `admin_log`.
-- ═══════════════════════════════════════════════════════════════════════════════════════
--
-- POURQUOI. Le critère 2 du gate G2 exige « un geste par écran démontré de bout en bout :
-- UI → RPC → ligne visible dans Sécurité avec metadata ». L'écran Sécurité lit `admin_log`.
-- Or ces huit RPC journalisaient dans `activity_events` — l'AUTRE journal, celui qui raconte
-- ce que font les AGENCES, et qui n'a pas de chaîne d'empreintes. Une action de MEGGA *sur*
-- une agence (trancher un dossier KYB, changer un plan, un quota, un rôle) y était donc :
--   · hors de la chaîne d'empreintes ;
--   · invisible à l'écran Sécurité ;
--   · versée dans le flux propre de l'agence.
-- Le cliquet `tests/backend/admin-gestes-sweep.spec.ts` les nommait comme dette ; cette
-- migration la rembourse, et le cliquet retire les huit lignes dans le même commit (il
-- rougit DANS LES DEUX SENS — un remboursement laissé dans la liste échoue aussi).
--
-- ── CE QUI N'EST PAS TOUCHÉ, ET POURQUOI ──────────────────────────────────────────────
-- Les écritures `activity_events` RESTENT. Ce n'est pas un déplacement, c'est un ajout :
-- la fiche de revue KYB lit le motif d'un rejet ou d'une correction dans
-- `activity_events.metadata` (`decisionReasonFromEvent`, useLabGuard, AdminKybReviewPage),
-- et l'agence a le droit de voir ce qui lui arrive. Les deux journaux répondent à deux
-- questions différentes ; supprimer le premier casserait quatre surfaces pour rien.
--
-- Les GARDES et les REFUS ne bougent pas non plus. Chaque refus reste un `raise exception`,
-- jamais un `return admin_error(...)` : les cinq appelants front (`callRpc` de
-- useAdminKybReview, `supabase.rpc` de AdminPlansPage / AdminBillingCard /
-- useAdminAgencyUsage / useAdminUsers) ne lisent QUE `error` et jettent `data`. Une
-- enveloppe d'erreur rendue au lieu d'être levée deviendrait un échec SILENCIEUX à l'écran —
-- le geste paraîtrait réussi. §10.1 prévoit d'ailleurs explicitement le chemin levée : son
-- code `unauthorized` existe « pour que la couche de mapping puisse fabriquer la même
-- enveloppe à partir d'un 42501 ».
--
-- ── POURQUOI LE TYPE DE RETOUR CHANGE (void → jsonb) ──────────────────────────────────
-- Piège n° 11 du chantier, et il vise exactement cette tâche : faire journaliser une
-- fonction la fait ENTRER dans le périmètre des GESTES, qui se définit par une PROPRIÉTÉ
-- (« SECURITY DEFINER, joignable par `authenticated`, qui écrit au registre ») et non par
-- une liste. Le périmètre impose l'enveloppe §10.1 : `{ ok, … }` partagé, jamais une valeur
-- nue. Huit fonctions `void` y entrant d'un coup auraient cassé deux tests du balayage
-- (l'enveloppe, et le plafond d'exceptions qui passe de 1 à 9). L'issue honnête est de
-- rendre l'enveloppe, pas d'exempter huit noms — une liste d'exceptions qui s'allonge vide
-- le test de son sens.
--
-- Changer le type de retour EXIGE un DROP (42P13 sinon). Ce n'est PAS une surcharge : la
-- signature — nom + types d'arguments — est reconduite à l'identique, donc aucun `PGRST203`
-- et aucun appelant front à modifier. Mais un DROP emporte les GRANT : chaque fonction est
-- donc suivie du `revoke` puis des `grant` MESURÉS avant l'opération, jamais devinés.
--
-- ⛔ ET `revoke … from public` NE SUFFIT PAS. Piège payé en CI sur ce fichier même, puis
-- mesuré dans `pg_default_acl` : le projet porte un
-- `alter default privileges in schema public grant execute on functions to anon,
-- authenticated, service_role` posé par `postgres`. Tout `create function` accorde donc
-- EXECUTE à `anon` **explicitement** — et `PUBLIC` (`grantee = '-'`) et `anon` sont deux
-- bénéficiaires DIFFÉRENTS : révoquer le premier laisse le second intact. Le résultat est
-- une SECURITY DEFINER joignable sans authentification, attrapée par
-- `admin-rpc-guard-sweep.spec.ts`. D'où `from public, anon, service_role` :
--   · `anon`        — la faille ;
--   · `service_role` — pas une faille, mais une DÉRIVE : les cinq décisions KYB ne
--     l'avaient pas avant (mesuré), et le laisser leur élargirait la portée en silence.
-- Les trois fonctions qui l'avaient (`set_user_role`, `set_agency_plan`,
-- `set_agency_quotas`) se le voient re-accorder explicitement, juste en dessous.
--
-- ── ORDRE DES VERROUS (§10.2 amendé) ──────────────────────────────────────────────────
-- ⛔ Verrou d'ENTITÉ d'abord, verrou de CHAÎNE ensuite. L'ordre inverse a déjà produit un
-- interblocage `40P01` — au rétro-branchement des RPC KYB, c'est-à-dire précisément ce
-- geste-ci. `admin_log_write` prend la chaîne et la tient jusqu'au COMMIT : il est donc la
-- DERNIÈRE instruction de chaque fonction, après le `for update` sur l'entité, après les
-- écritures, et — pour `admin_relaunch_agency_review` — après l'appel au moteur.
--
-- ── p_metadata ────────────────────────────────────────────────────────────────────────
-- Tableau ORDONNÉ de paires `{l, v}`, jamais un objet. Aucun flottant (`22023`) : le hash de
-- chaîne porte sur le TEXTE du jsonb, et une re-sérialisation différente romprait la chaîne
-- sans qu'aucune donnée n'ait bougé. Toutes les valeurs sont extraites en `->>` ou castées
-- en `text` — y compris les quotas, dont `ai_monthly_cost_cap_usd` est un `numeric`.
--
-- Familles (FK vers `admin_log_family`, sinon `23503`) :
--   · `kyb`      — les cinq décisions de revue (étape 19b) ;
--   · `identity` — le changement de rôle (étape 18). PAS `lifecycle` : un rôle dit les
--     DROITS d'un compte, pas son cycle de vie (actif / suspendu), qui appartient aux deux
--     edge functions `admin-*-lifecycle`. Les mettre dans la même famille aurait mélangé
--     deux questions et laissé `identity` définitivement vide.
--   · `plans`    — plan et quotas d'agence (famille étape 17).
--
-- Idempotence : `drop … if exists` + `create or replace`, la migration est rejouée à chaque
-- déploiement de sa propre journée UTC.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────────────────
-- 1. Décisions KYB — famille `kyb` (étape 19b)
-- ───────────────────────────────────────────────────────────────────────────────────────

drop function if exists public.admin_validate_agency_review(uuid);

create or replace function public.admin_validate_agency_review(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status       text;
  v_agency_name  text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  -- FOR UPDATE : même discipline que submit_agency_identity / recompute_agency_verification
  -- (verrouille la ligne le temps de la décision, sérialise un double-clic ou deux
  -- relecteurs simultanés sur le même dossier). C'est AUSSI le verrou d'entité qu'exige
  -- l'ordre §10.2 — il doit précéder la chaîne du registre, prise tout en bas.
  select verification_status, coalesce(legal_name, name) into v_status, v_agency_name
    from public.agencies
   where id = p_agency_id
     for update;

  if v_status is null then
    raise exception 'agency not found';
  end if;

  if v_status <> 'manual_review' then
    raise exception 'agency is not awaiting review (status=%)', v_status;
  end if;

  -- 'validated', jamais 'auto_validated' : seule une décision HUMAINE pose cette valeur
  -- (conception de référence §6). verified_at suit la même règle que pour une conclusion
  -- positive du moteur (20260728130000) -- « vérifié depuis » reste vrai quel que soit
  -- qui a vérifié.
  update public.agencies
     set verification_status = 'validated',
         verified_at = now()
   where id = p_agency_id;

  -- object_label : convention dépôt pour les actions administratives auditées (texte
  -- lisible, pas seulement entity_id -- cf. object_label sur admin_create_agency,
  -- 20260726005000). CORRECTIF REVUE point 4 : les quatre événements de cette tâche
  -- laissaient ce champ vide, contrairement à la convention.
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, object_label, metadata)
  values (
    p_agency_id, auth.uid(), 'user', 'agency_verification_validated', 'agency', p_agency_id,
    'kyc', 'info', v_agency_name, jsonb_build_object('previous_status', v_status)
  );

  -- Registre MEGGA, EN DERNIER (§10.2 amendé) : admin_log_write prend le verrou de chaîne
  -- et le tient jusqu'au COMMIT.
  perform public.admin_log_write(
    p_family => 'kyb', p_action => 'agency_verification_validated', p_severity => 'info',
    p_entity_type => 'agency', p_entity_id => p_agency_id, p_entity_label => v_agency_name,
    p_agency_id => p_agency_id,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Décision', 'v', 'Validée'),
      jsonb_build_object('l', 'Statut précédent', 'v', v_status),
      jsonb_build_object('l', 'Statut', 'v', 'validated')));

  return public.admin_ok(jsonb_build_object('verification_status', 'validated'));
end;
$function$;

revoke all on function public.admin_validate_agency_review(uuid) from public, anon, service_role;
grant execute on function public.admin_validate_agency_review(uuid) to authenticated;


drop function if exists public.admin_reject_agency_review(uuid, text);

create or replace function public.admin_reject_agency_review(p_agency_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status       text;
  v_agency_name  text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  -- Motif obligatoire : un rejet sans motif est irrecevable dans un dossier de conformité
  -- (qui le relira dans deux ans doit savoir pourquoi). btrim() attrape aussi une chaîne
  -- blanche, pas seulement NULL ou vide -- un bug d'écran qui soumettrait "   " ne doit
  -- pas passer pour un motif.
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'rejection reason is required';
  end if;

  select verification_status, coalesce(legal_name, name) into v_status, v_agency_name
    from public.agencies
   where id = p_agency_id
     for update;

  if v_status is null then
    raise exception 'agency not found';
  end if;

  if v_status <> 'manual_review' then
    raise exception 'agency is not awaiting review (status=%)', v_status;
  end if;

  -- verified_at remis à NULL explicitement : un dossier rejeté n'est jamais « vérifié
  -- depuis » (défensif -- en pratique déjà NULL pour tout dossier manual_review, cf.
  -- recompute_agency_verification, mais une décision de conformité ne doit dépendre
  -- d'aucune hypothèse sur l'état antérieur de la ligne).
  update public.agencies
     set verification_status = 'rejected',
         verified_at = null
   where id = p_agency_id;

  -- Le motif vit dans metadata (voir en-tête de section) -- aucune colonne dédiée.
  -- object_label : convention dépôt (voir admin_validate_agency_review ci-dessus ;
  -- CORRECTIF REVUE point 4).
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, object_label, metadata)
  values (
    p_agency_id, auth.uid(), 'user', 'agency_verification_rejected', 'agency', p_agency_id,
    'kyc', 'warn', v_agency_name, jsonb_build_object('previous_status', v_status, 'reason', p_reason)
  );

  -- Le motif est repris ici, et ce n'est pas une redondance : le registre MEGGA doit se
  -- suffire à lui-même — un auditeur qui lit `admin_log` n'a pas à joindre le journal de
  -- l'agence pour savoir POURQUOI un dossier a été rejeté.
  perform public.admin_log_write(
    p_family => 'kyb', p_action => 'agency_verification_rejected', p_severity => 'warn',
    p_entity_type => 'agency', p_entity_id => p_agency_id, p_entity_label => v_agency_name,
    p_agency_id => p_agency_id,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Décision', 'v', 'Rejetée'),
      jsonb_build_object('l', 'Motif', 'v', btrim(p_reason)),
      jsonb_build_object('l', 'Statut précédent', 'v', v_status),
      jsonb_build_object('l', 'Statut', 'v', 'rejected')));

  return public.admin_ok(jsonb_build_object('verification_status', 'rejected'));
end;
$function$;

revoke all on function public.admin_reject_agency_review(uuid, text) from public, anon, service_role;
grant execute on function public.admin_reject_agency_review(uuid, text) to authenticated;


drop function if exists public.admin_request_agency_correction(uuid, text);

create or replace function public.admin_request_agency_correction(p_agency_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status      text;
  v_agency_name text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a correction request must say what to correct';
  end if;

  select verification_status, coalesce(legal_name, name) into v_status, v_agency_name
    from public.agencies
   where id = p_agency_id
     for update;

  if v_status is null then
    raise exception 'agency not found';
  end if;

  if v_status <> 'manual_review' then
    raise exception 'agency is not awaiting review (status=%)', v_status;
  end if;

  -- Les trois écritures qui rouvrent le dossier, et chacune compte :
  --   verification_status : ferme le garde LAB (liste blanche) et dit POURQUOI ;
  --   identity_submitted_at = null : rouvre le gate d'onboarding (useIdentityGate ne lit que
  --     cette colonne) ET dégèle les colonnes d'identité légale
  --     (agencies_guard_identity_columns, 20260731130000, qui gèle sur cette même colonne) --
  --     un seul fait porte les deux, ce n'est pas une coïncidence mais la charnière voulue ;
  --   verified_at = null : un dossier renvoyé n'est jamais « vérifié depuis » (défensif, comme
  --     le fait déjà admin_reject_agency_review).
  update public.agencies
     set verification_status = 'correction_requested',
         identity_submitted_at = null,
         verified_at = null
   where id = p_agency_id;

  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, object_label, metadata)
  values (
    p_agency_id, auth.uid(), 'user', 'agency_verification_correction_requested', 'agency', p_agency_id,
    'kyc', 'warn', v_agency_name,
    jsonb_build_object('previous_status', v_status, 'reason', p_reason)
  );

  perform public.admin_log_write(
    p_family => 'kyb', p_action => 'agency_verification_correction_requested', p_severity => 'warn',
    p_entity_type => 'agency', p_entity_id => p_agency_id, p_entity_label => v_agency_name,
    p_agency_id => p_agency_id,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Décision', 'v', 'Correction demandée'),
      jsonb_build_object('l', 'Motif', 'v', btrim(p_reason)),
      jsonb_build_object('l', 'Statut précédent', 'v', v_status),
      jsonb_build_object('l', 'Statut', 'v', 'correction_requested'),
      -- Ce fait-là ne se déduit pas du statut : la demande de correction ROUVRE le parcours
      -- d'onboarding et dégèle les colonnes d'identité. C'est ce qui la distingue d'un rejet.
      jsonb_build_object('l', 'Dossier rouvert', 'v', 'oui')));

  return public.admin_ok(jsonb_build_object('verification_status', 'correction_requested'));
end;
$function$;

revoke all on function public.admin_request_agency_correction(uuid, text) from public, anon, service_role;
grant execute on function public.admin_request_agency_correction(uuid, text) to authenticated;


drop function if exists public.admin_relaunch_agency_review(uuid);

create or replace function public.admin_relaunch_agency_review(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_submitted_at timestamptz;
  v_agency_name  text;
  v_status_avant text;
  v_status_apres text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  -- FOR UPDATE : même discipline que validate/reject ci-dessus (verrouille la ligne le
  -- temps de la décision). Lit identity_submitted_at, PAS verification_status : voir
  -- l'en-tête de section pour pourquoi relancer n'exige pas manual_review mais exige quand
  -- même d'avoir été soumis -- un dossier jamais soumis est en 'pending' comme un dossier
  -- normalement en attente de saisie, rien ne les distingue par le statut seul.
  -- (Le statut est lu quand même, pour le registre : le « avant » d'une relance est ce qui
  -- rend le « après » lisible.)
  select identity_submitted_at, coalesce(legal_name, name), verification_status
    into v_submitted_at, v_agency_name, v_status_avant
    from public.agencies
   where id = p_agency_id
     for update;

  if not found then
    raise exception 'agency not found';
  end if;

  -- CORRECTIF REVUE point 1 (CRITIQUE) : voir l'en-tête de section pour le scénario
  -- complet. Sans cette garde, un dossier 'pending' jamais soumis atteignait
  -- 'manual_review' au premier appel (tous ses vétos entité échouent faute du moindre
  -- check), puis 'validated' au second (admin_validate_agency_review) -- deux appels
  -- authentifiés légitimes en apparence. Prouvé rouge par agency-review-queue.spec.ts
  -- avant ce correctif.
  if v_submitted_at is null then
    raise exception 'agency has not submitted its identity yet';
  end if;

  -- Trace la DEMANDE humaine avant d'appeler le moteur : même si recompute_agency_verification
  -- ressort aussitôt sans rien faire (dossier déjà tranché, voir son retour anticipé), le
  -- fait qu'un super-admin ait cliqué « relancer » reste, lui, un fait digne d'audit.
  -- object_label : convention dépôt pour les actions administratives auditées (texte
  -- lisible, pas seulement entity_id -- cf. object_label sur admin_create_agency,
  -- 20260726005000).
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, object_label)
  values (
    p_agency_id, auth.uid(), 'user', 'agency_verification_relaunch_requested', 'agency', p_agency_id,
    'kyc', 'info', v_agency_name
  );

  -- Appel imbriqué : s'exécute avec les privilèges du PROPRIÉTAIRE de cette fonction (le
  -- rôle qui joue les migrations), jamais avec ceux de l'appelant authenticated d'origine
  -- -- voir l'arbitrage en tête de section. recompute_agency_verification reste, à elle
  -- seule, EXACTEMENT ce que documente 20260728130000 : GRANT service_role uniquement,
  -- aucune garde interne ajoutée, aucune ligne de son corps touchée.
  perform public.recompute_agency_verification(p_agency_id);

  -- Relu APRÈS le moteur : c'est le seul moyen de dire au registre ce que la relance a
  -- effectivement produit plutôt que ce qu'elle a demandé.
  select verification_status into v_status_apres from public.agencies where id = p_agency_id;

  -- EN DERNIER, donc APRÈS le moteur : admin_log_write tient le verrou de chaîne jusqu'au
  -- COMMIT, et recompute_agency_verification n'est pas une instruction brève. L'appeler
  -- avant aurait fait tenir la chaîne pendant tout le recalcul -- c'est exactement le
  -- croisement d'ordre qui a produit un 40P01 (§10.2 amendé).
  perform public.admin_log_write(
    p_family => 'kyb', p_action => 'agency_verification_relaunch_requested', p_severity => 'info',
    p_entity_type => 'agency', p_entity_id => p_agency_id, p_entity_label => v_agency_name,
    p_agency_id => p_agency_id,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Décision', 'v', 'Relance du moteur'),
      jsonb_build_object('l', 'Statut avant', 'v', coalesce(v_status_avant, '—')),
      jsonb_build_object('l', 'Statut après', 'v', coalesce(v_status_apres, '—')),
      jsonb_build_object('l', 'Effet', 'v',
        case when v_status_avant is distinct from v_status_apres
             then 'statut modifié' else 'aucun changement de statut' end)));

  return public.admin_ok(jsonb_build_object('verification_status', v_status_apres));
end;
$function$;

revoke all on function public.admin_relaunch_agency_review(uuid) from public, anon, service_role;
grant execute on function public.admin_relaunch_agency_review(uuid) to authenticated;


drop function if exists public.admin_resolve_agency_id_document(uuid, uuid, text);

create or replace function public.admin_resolve_agency_id_document(p_agency_id uuid, p_check_id uuid, p_result text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

  -- On ne tranche que la ligne la plus récente, et seulement si elle attend. Deux refus
  -- distincts, parce qu'ils appellent deux gestes différents :
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

  -- Même convention d'entité que ci-dessus : la ligne du registre porte l'AGENCE, et
  -- nomme la personne et le contrôle dans ses paires -- l'écran Sécurité recherche sur
  -- l'entité, et un auditeur cherche un dossier avant de chercher une pièce.
  perform public.admin_log_write(
    p_family => 'kyb', p_action => 'agency_identity_document_resolved',
    p_severity => case when p_result = 'mismatch' then 'warn' else 'info' end,
    p_entity_type => 'agency', p_entity_id => v_agency_id, p_entity_label => v_agency_name,
    p_agency_id => v_agency_id,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Verdict', 'v', p_result),
      jsonb_build_object('l', 'Pièce', 'v', 'id_document'),
      jsonb_build_object('l', 'Personne', 'v', v_related_person_id::text),
      jsonb_build_object('l', 'Contrôle', 'v', p_check_id::text),
      jsonb_build_object('l', 'Source', 'v', 'manual')));

  return public.admin_ok(jsonb_build_object('result', p_result));
end;
$function$;

revoke all on function public.admin_resolve_agency_id_document(uuid, uuid, text) from public, anon, service_role;
grant execute on function public.admin_resolve_agency_id_document(uuid, uuid, text) to authenticated;


-- ───────────────────────────────────────────────────────────────────────────────────────
-- 2. Rôle d'un compte — famille `identity` (étape 18)
-- ───────────────────────────────────────────────────────────────────────────────────────

drop function if exists public.admin_set_user_role(uuid, text);

create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_target_email  text;
  v_old_role      text;
  v_target_agency uuid;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin required' using errcode = '42501';
  end if;
  if p_role not in ('super_admin', 'admin', 'manager', 'agent', 'assistant', 'seller', 'buyer', 'particulier') then
    raise exception 'invalid role: %', p_role;
  end if;

  select u.email, p.role, p.agency_id
    into v_target_email, v_old_role, v_target_agency
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = p_user_id;

  if v_old_role is null then
    raise exception 'target profile not found';
  end if;

  -- Allowlist : 'super_admin' réservé aux emails allowlistés (20260705160000).
  if p_role = 'super_admin' and not public.super_admin_allowlist_match(v_target_email) then
    raise exception 'forbidden: super_admin restricted to allowlisted emails' using errcode = '42501';
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  -- role_changed est dans SENSIBLE_ACTIONS côté UI mais n'était jamais journalisé.
  if p_role is distinct from v_old_role then
    insert into public.activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    values (
      v_target_agency, auth.uid(), 'user', 'role_changed', 'profile', p_user_id,
      'auth', 'warn', v_target_email,
      jsonb_build_object('old_role', v_old_role, 'new_role', p_role, 'via', 'admin_set_user_role')
    );
  end if;

  -- ⚠ INCONDITIONNEL, contrairement à l'événement d'agence ci-dessus, et c'est voulu : le
  -- registre MEGGA répond à « qu'a fait le super-admin », pas à « qu'est-il arrivé au
  -- compte ». Un geste sur un rôle déjà en place reste un geste posé sur un compte, et son
  -- absence du registre laisserait un trou inexplicable entre deux lignes. La paire
  -- « Effet » dit lequel des deux cas on lit.
  perform public.admin_log_write(
    p_family => 'identity', p_action => 'role_changed', p_severity => 'warn',
    p_entity_type => 'profile', p_entity_id => p_user_id, p_entity_label => v_target_email,
    p_agency_id => v_target_agency,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Rôle précédent', 'v', v_old_role),
      jsonb_build_object('l', 'Nouveau rôle', 'v', p_role),
      jsonb_build_object('l', 'Compte', 'v', coalesce(v_target_email, '—')),
      jsonb_build_object('l', 'Effet', 'v',
        case when p_role is distinct from v_old_role then 'rôle modifié' else 'rôle inchangé' end)));

  return public.admin_ok(jsonb_build_object('role', p_role, 'previous_role', v_old_role));
end;
$function$;

revoke all on function public.admin_set_user_role(uuid, text) from public, anon, service_role;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to service_role;


-- ───────────────────────────────────────────────────────────────────────────────────────
-- 3. Réglages d'agence — famille `plans` (famille étape 17)
-- ───────────────────────────────────────────────────────────────────────────────────────

drop function if exists public.admin_set_agency_plan(uuid, text, text, text);

create or replace function public.admin_set_agency_plan(
  p_agency_id uuid,
  p_plan text,
  p_status text default 'active',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old_plan    text;
  v_agency_name text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin required' using errcode = '42501';
  end if;
  if p_plan not in ('starter', 'pro', 'entreprise') then
    raise exception 'invalid plan: %', p_plan;
  end if;
  if p_status not in ('active', 'trialing', 'past_due', 'canceled') then
    raise exception 'invalid status: %', p_status;
  end if;

  -- Le nom est lu ICI, dans la lecture qui existait déjà : l'écran Sécurité affiche une
  -- entité lisible, pas un uuid (admin-security.jsx). `name` est NOT NULL, donc le
  -- coalesce ne rend jamais NULL -- et `plan` l'est aussi, d'où le test d'existence
  -- inchangé sur v_old_plan.
  select plan, coalesce(legal_name, name) into v_old_plan, v_agency_name
    from public.agencies where id = p_agency_id;
  if v_old_plan is null then
    raise exception 'agency not found';
  end if;

  -- `agencies.plan` est désormais du text avec le MÊME CHECK que `subscriptions.plan` :
  -- plus aucun cast, et les deux tables ne peuvent plus diverger de vocabulaire.
  update public.agencies set plan = p_plan where id = p_agency_id;

  -- Upsert de la ligne subscriptions. ⚠ Limitation documentée : un webhook
  -- Stripe ultérieur pour cette agence réécrira cette ligne — l'override
  -- manuel est pensé pour les comptes SANS abonnement Stripe (comp/partenaire).
  insert into public.subscriptions (agency_id, stripe_customer_id, plan, status)
  values (p_agency_id, 'manual_' || p_agency_id, p_plan, p_status)
  on conflict (agency_id) do update
    set plan = excluded.plan,
        status = excluded.status,
        updated_at = now();

  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  values (
    p_agency_id, auth.uid(), 'user', 'subscription_changed', 'agency', p_agency_id,
    'settings', 'warn', p_plan,
    jsonb_build_object('old_plan', v_old_plan, 'new_plan', p_plan, 'status', p_status,
                       'note', p_note, 'manual_override', true)
  );

  -- `Override manuel` est nommé dans la ligne parce que c'est la vraie information de
  -- conformité : cette RPC contourne Stripe, et un webhook ultérieur peut la défaire.
  perform public.admin_log_write(
    p_family => 'plans', p_action => 'subscription_changed', p_severity => 'warn',
    p_entity_type => 'agency', p_entity_id => p_agency_id, p_entity_label => v_agency_name,
    p_agency_id => p_agency_id,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Plan précédent', 'v', v_old_plan),
      jsonb_build_object('l', 'Nouveau plan', 'v', p_plan),
      jsonb_build_object('l', 'Statut abonnement', 'v', p_status),
      jsonb_build_object('l', 'Override manuel', 'v', 'oui'),
      jsonb_build_object('l', 'Note', 'v', coalesce(nullif(btrim(coalesce(p_note, '')), ''), '—'))));

  return public.admin_ok(jsonb_build_object('plan', p_plan, 'previous_plan', v_old_plan, 'status', p_status));
end;
$function$;

revoke all on function public.admin_set_agency_plan(uuid, text, text, text) from public, anon, service_role;
grant execute on function public.admin_set_agency_plan(uuid, text, text, text) to authenticated;
grant execute on function public.admin_set_agency_plan(uuid, text, text, text) to service_role;


drop function if exists public.admin_set_agency_quotas(uuid, jsonb, text);

create or replace function public.admin_set_agency_quotas(
  p_agency_id uuid,
  p_quotas jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old         jsonb;
  v_threshold   integer;
  v_agency_name text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin required' using errcode = '42501';
  end if;

  -- `not found` remplace le `if not exists (…)` d'origine : STRICTEMENT le même verdict
  -- (`name` est NOT NULL, donc le coalesce ne peut pas rendre NULL sur une ligne présente),
  -- en une lecture au lieu de deux, et le nom sert ensuite au registre.
  select coalesce(legal_name, name) into v_agency_name
    from public.agencies where id = p_agency_id;
  if not found then
    raise exception 'agency not found';
  end if;

  -- Seuil : 80 par défaut, borné 50-100 (le CHECK protège aussi, mais on
  -- veut un message clair plutôt qu'une violation de contrainte).
  v_threshold := coalesce((p_quotas->>'alert_threshold_pct')::integer, 80);
  if v_threshold < 50 or v_threshold > 100 then
    raise exception 'alert_threshold_pct must be between 50 and 100';
  end if;

  select to_jsonb(q) - 'updated_at' - 'updated_by'
    into v_old
  from public.agency_usage_quotas q
  where q.agency_id = p_agency_id;

  insert into public.agency_usage_quotas (
    agency_id, ai_monthly_cost_cap_usd, active_properties_cap,
    whatsapp_monthly_cap, storage_cap_mb, alert_threshold_pct, note,
    updated_by, updated_at
  )
  values (
    p_agency_id,
    nullif(p_quotas->>'ai_monthly_cost_cap_usd', '')::numeric,
    nullif(p_quotas->>'active_properties_cap', '')::integer,
    nullif(p_quotas->>'whatsapp_monthly_cap', '')::integer,
    nullif(p_quotas->>'storage_cap_mb', '')::integer,
    v_threshold,
    nullif(p_note, ''),
    auth.uid(),
    now()
  )
  on conflict (agency_id) do update
    set ai_monthly_cost_cap_usd = excluded.ai_monthly_cost_cap_usd,
        active_properties_cap   = excluded.active_properties_cap,
        whatsapp_monthly_cap    = excluded.whatsapp_monthly_cap,
        storage_cap_mb          = excluded.storage_cap_mb,
        alert_threshold_pct     = excluded.alert_threshold_pct,
        note                    = excluded.note,
        updated_by              = excluded.updated_by,
        updated_at              = now();

  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  values (
    p_agency_id, auth.uid(), 'user', 'quota_changed', 'agency', p_agency_id,
    'settings', 'info', 'usage_quotas',
    jsonb_build_object('old', v_old, 'new', p_quotas, 'note', p_note)
  );

  -- ⚠ TOUTES les valeurs sont extraites en `->>`, donc en TEXTE. `ai_monthly_cost_cap_usd`
  -- est un `numeric` : le passer tel quel produirait un flottant dans le jsonb, refusé par
  -- admin_log_write (`22023`) parce que le hash de chaîne porte sur le TEXTE du jsonb et
  -- qu'une re-sérialisation différente romprait la chaîne sans qu'aucune donnée n'ait bougé.
  perform public.admin_log_write(
    p_family => 'plans', p_action => 'quota_changed', p_severity => 'info',
    p_entity_type => 'agency', p_entity_id => p_agency_id, p_entity_label => v_agency_name,
    p_agency_id => p_agency_id,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Plafond IA (USD/mois)', 'v',
        coalesce(nullif(p_quotas->>'ai_monthly_cost_cap_usd', ''), '—')),
      jsonb_build_object('l', 'Biens actifs', 'v',
        coalesce(nullif(p_quotas->>'active_properties_cap', ''), '—')),
      jsonb_build_object('l', 'WhatsApp / mois', 'v',
        coalesce(nullif(p_quotas->>'whatsapp_monthly_cap', ''), '—')),
      jsonb_build_object('l', 'Stockage (Mo)', 'v',
        coalesce(nullif(p_quotas->>'storage_cap_mb', ''), '—')),
      jsonb_build_object('l', 'Seuil d’alerte (%)', 'v', v_threshold::text),
      jsonb_build_object('l', 'Quotas antérieurs', 'v',
        case when v_old is null then 'aucun (première pose)' else 'remplacés' end),
      jsonb_build_object('l', 'Note', 'v', coalesce(nullif(btrim(coalesce(p_note, '')), ''), '—'))));

  return public.admin_ok(jsonb_build_object('alert_threshold_pct', v_threshold));
end;
$function$;

revoke all on function public.admin_set_agency_quotas(uuid, jsonb, text) from public, anon, service_role;
grant execute on function public.admin_set_agency_quotas(uuid, jsonb, text) to authenticated;
grant execute on function public.admin_set_agency_quotas(uuid, jsonb, text) to service_role;
