-- Etape 5 du chantier KYB, tache 1 -- la couche de donnees de la file de revue.
--
-- Contexte (docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-5.md, « Pourquoi
-- cette etape est le chemin critique » ; docs/agency-kyb-handoff.md §7bis) : aucune
-- agence, d'aucun pays, ne peut etre auto-validee aujourd'hui -- deux des quatre
-- vetos d'entite n'ont aucun connecteur, et la piece d'identite reste en
-- pending_manual_review de facon permanente tant que rien ne la resout. La revue
-- humaine n'est donc pas une voie de secours pour les cas douteux : c'est l'UNIQUE
-- voie. Tant que cette file n'existe pas, aucun dossier soumis ne peut aboutir.
--
-- Deux fonctions, lecture seule, reservees au super-admin (console admin.megga.ch) :
--   - get_admin_agency_review_queue()            -- la liste des dossiers a trancher.
--   - get_admin_agency_review_detail(p_agency_id) -- le detail d'un dossier, check
--     par check, avec le poids EN VIGUEUR A LA DATE DU CHECK (jointure temporelle).
--
-- Patron P3 (20260726001000/20260726002000, « EXECUTE authenticated, la garde
-- interne filtre ») : GRANT a authenticated -- la console admin appelle depuis un
-- navigateur, sous un jeton authenticated, jamais service_role -- gardee par
-- is_super_admin() A L'INTERIEUR du corps. Un SECURITY DEFINER ne rejoue jamais les
-- policies RLS des tables qu'il touche : la garde doit donc etre explicite, pas
-- deleguee a la RLS de agencies / agency_verification_checks.
--
-- Idempotente : CREATE OR REPLACE FUNCTION, CREATE INDEX IF NOT EXISTS, REVOKE/GRANT
-- rejouables sans effet de bord.

-- ─── (1) get_admin_agency_review_queue() : la liste ─────────────────────────────────
--
-- Un seul filtre : verification_status = 'manual_review'. Volontairement SANS colonne
-- de priorite derivee (decision de conception d'Antoine, docs/superpowers/specs/
-- 2026-07-26-onboarding-kyb-design.md §10) : le tri sur le score suffit.
--
-- Ce seul filtre fait AUSSI remonter, sans logique dediee, les dossiers que
-- sweep_pending_agency_verifications() (20260728150000) a abandonnes apres avoir
-- epuise ses 5 tentatives : ce filet bascule lui-meme verification_status vers
-- 'manual_review' quand la borne est atteinte (voir son en-tete). Sans cette etape,
-- ces dossiers resteraient invisibles indefiniment -- exactement le trou que ce filet
-- vient de creuser cote moteur et que cette file doit combler.
--
-- ORDER BY verification_score ASC NULLS FIRST : un score NULL (aucun check scorable
-- pour l'instant -- cas nominal d'un dossier jamais traite par le moteur, dont le
-- filet epuise ci-dessus est un exemple precis) est le cas le PLUS opaque, pas le
-- moins urgent -- on n'a meme pas un score bas a se mettre sous la dent. Le classer
-- APRES les scores connus (comportement par defaut de Postgres pour ASC) l'enterrerait
-- en bas de file alors qu'il merite le meme traitement prioritaire qu'un score
-- catastrophique. NULLS FIRST rend ce choix explicite plutot que de dependre d'un
-- comportement par defaut que le lecteur devrait deviner.
create or replace function public.get_admin_agency_review_queue()
returns table (
  agency_id                   uuid,
  agency_name                 text,
  country                     text,
  verification_status         text,
  verification_score          numeric,
  identity_submitted_at       timestamptz,
  verification_sweep_attempts smallint
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    coalesce(a.legal_name, a.name),
    a.country,
    a.verification_status,
    a.verification_score,
    a.identity_submitted_at,
    a.verification_sweep_attempts
  from public.agencies a
  where a.verification_status = 'manual_review'
  order by a.verification_score asc nulls first, a.identity_submitted_at asc;
end;
$$;

comment on function public.get_admin_agency_review_queue() is
  'File de revue KYB (etape 5) : dossiers en manual_review, tries par verification_score croissant (NULLS FIRST -- un score jamais calcule est le cas le plus opaque, pas le moins urgent), les plus douteux en tete. Sans colonne de priorite derivee : le tri suffit. Fait remonter, par le seul jeu de ce filtre, les dossiers que sweep_pending_agency_verifications() a bascules en manual_review apres avoir epuise ses tentatives (20260728150000). super_admin uniquement (patron P3 : EXECUTE authenticated, garde interne is_super_admin()). Voir docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-5.md.';

-- Partial index couvrant EXACTEMENT le WHERE + ORDER BY ci-dessus (regle perf
-- CLAUDE.md §7). Distinct de idx_agencies_verification_review (20260728101000, sur
-- verified_at -- un filtre different pour un autre usage) : verified_at ne sert a
-- rien ici, il vaut TOUJOURS NULL pour un dossier manual_review (pose uniquement sur
-- une conclusion positive du moteur -- recompute_agency_verification, 20260728130000,
-- etape 4). NULLS FIRST pose explicitement dans l'index pour correspondre AU TRI
-- DEMANDE et rester utilisable sans tri supplementaire en memoire.
create index if not exists idx_agencies_review_queue_score
  on public.agencies (verification_score asc nulls first)
  where verification_status = 'manual_review';

-- ─── (2) get_admin_agency_review_detail(agency_id) : le detail ──────────────────────
--
-- Chaque check, ENTITE et PERSONNE confondus, avec le poids et le statut de veto EN
-- VIGUEUR A LA DATE DU CHECK -- jointure temporelle reprise TERME A TERME de
-- recompute_agency_verification (20260728130000, CTE `scored`) : meme predicat
-- (valid_from <= checked_at and (valid_to is null or valid_to > checked_at)), meme
-- departage (valid_from desc, id desc -- la ligne de config la plus recemment ouverte
-- l'emporte si, par correction de donnees, deux fenetres fermees se chevauchent). Un
-- dossier douteux d'hier doit rester justifiable avec le bareme d'hier, jamais
-- reinterprete avec le bareme d'aujourd'hui -- voir l'en-tete de 20260728130000 pour
-- le raisonnement complet et les deux regressions qu'il documente.
--
-- DEUX differences DELIBEREES avec la jointure du moteur, jamais une approximation :
--   1. LEFT JOIN LATERAL, jamais un JOIN (INNER) : le moteur peut legitimement
--      IGNORER un check qui ne rejoint aucune config. Un detail d'AUDIT ne le peut
--      pas -- un check sans ligne de config retrouvee doit rester visible (poids
--      NULL, explicite), jamais disparaitre silencieusement du dossier.
--   2. AUCUN filtre `and not c.is_veto` dans la sous-requete laterale : le moteur
--      l'ajoute pour EXCLURE les vetos du calcul de score. Ce detail affiche au
--      contraire TOUS les checks, vetos compris -- un veto echoue est tres
--      probablement LA RAISON pour laquelle le dossier est en revue ; le cacher
--      viderait l'ecran de sa reponse la plus importante. `is_veto` (lu sur la meme
--      ligne de config, sans cout supplementaire) accompagne toujours le poids : un
--      poids a 0.00 sans cet indicateur se lirait a tort comme « un signal qui n'a
--      pese pour rien », alors qu'un veto est hors score par construction.
--
-- AUCUNE restriction aux signataires actifs cote personne (contrairement au moteur,
-- qui ne score que les signataires actifs -- 20260728130000, CTE `active_signatories`) :
-- ce detail retourne les checks de TOUTE personne liee a l'agence (UBO compris,
-- signataire radie compris). Un dossier peut etre en revue precisement PARCE QU'aucun
-- signataire actif n'est identifie (recompute_agency_verification, v_has_active_signatory)
-- -- restreindre le detail au perimetre du moteur cacherait alors la seule piste
-- utile : « voici les personnes declarees, et voici pourquoi aucune ne compte comme
-- signataire actif ».
--
-- UNION ALL plutot que deux appels separes cote client : un seul aller-retour, un seul
-- tri chronologique unifie (checked_at desc) -- l'historique COMPLET, pas seulement le
-- dernier check par type (contrairement au moteur, qui deduplique via distinct on pour
-- le SCORE ; un AUDIT veut voir qu'un registry_lookup a d'abord echoue avant de
-- reussir, pas seulement son dernier etat).
create or replace function public.get_admin_agency_review_detail(p_agency_id uuid)
returns table (
  check_id          uuid,
  related_person_id uuid,
  check_type        text,
  source            text,
  result            text,
  raw_response      jsonb,
  checked_at        timestamptz,
  applicable_weight numeric,
  is_veto           boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
  select
    avc.id as check_id,
    null::uuid as related_person_id,
    avc.check_type,
    avc.source,
    avc.result,
    avc.raw_response,
    avc.checked_at,
    cfg.weight as applicable_weight,
    cfg.is_veto
  from public.agency_verification_checks avc
  left join lateral (
    select c.weight, c.is_veto
    from public.verification_check_config c
    where c.check_type = avc.check_type
      and c.valid_from <= avc.checked_at
      and (c.valid_to is null or c.valid_to > avc.checked_at)
    order by c.valid_from desc, c.id desc
    limit 1
  ) cfg on true
  where avc.agency_id = p_agency_id

  union all

  select
    apvc.id,
    apvc.related_person_id,
    apvc.check_type,
    apvc.source,
    apvc.result,
    apvc.raw_response,
    apvc.checked_at,
    cfg.weight,
    cfg.is_veto
  from public.agency_person_verification_checks apvc
  join public.agency_related_persons arp on arp.id = apvc.related_person_id
  left join lateral (
    select c.weight, c.is_veto
    from public.verification_check_config c
    where c.check_type = apvc.check_type
      and c.valid_from <= apvc.checked_at
      and (c.valid_to is null or c.valid_to > apvc.checked_at)
    order by c.valid_from desc, c.id desc
    limit 1
  ) cfg on true
  where arp.agency_id = p_agency_id

  order by checked_at desc, check_id desc;
end;
$$;

comment on function public.get_admin_agency_review_detail(uuid) is
  'Detail d''un dossier KYB (etape 5) : chaque check, ENTITE et PERSONNE confondus (toute personne liee, pas seulement les signataires actifs), avec type, source, resultat, reponse brute et applicable_weight -- le poids EN VIGUEUR A LA DATE DU CHECK (jointure temporelle reprise de recompute_agency_verification, 20260728130000), jamais le poids courant. LEFT JOIN (jamais INNER) et sans filtre is_veto dans la sous-requete : contrairement au moteur de score, ce detail n''omet et n''exclut aucun check, vetos compris -- is_veto accompagne toujours applicable_weight pour une lecture correcte. Historique complet (pas de deduplication au dernier check par type), trie checked_at desc. super_admin uniquement (patron P3). Voir docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-5.md.';

-- ── Grants (patron P3 : EXECUTE authenticated, la garde interne filtre) ──────────────
revoke all on function public.get_admin_agency_review_queue() from public, anon;
revoke all on function public.get_admin_agency_review_detail(uuid) from public, anon;
grant execute on function public.get_admin_agency_review_queue() to authenticated, service_role;
grant execute on function public.get_admin_agency_review_detail(uuid) to authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Étape 5, tâche 2 -- la décision humaine. Quatre actions, toutes déclenchées depuis la
-- console admin (navigateur, jeton authenticated) : valider, rejeter avec motif, relancer
-- le moteur, résoudre une pièce d'identité. Sans elles, un dossier qui atterrit dans
-- get_admin_agency_review_queue() n'a AUCUN moyen d'en sortir -- cette file serait un
-- cul-de-sac. Voir docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-5.md, tâche 2.
--
-- ── Arbitrage : comment « relancer » atteint un moteur réservé au service_role ────────
--
-- recompute_agency_verification() (20260728130000) n'accorde EXECUTE qu'à service_role --
-- délibéré, documenté dans son propre commentaire (« Droits : service_role uniquement »,
-- spec §8). « Relancer » doit pourtant partir d'un clic dans la console, donc d'un jeton
-- authenticated. Deux options posées par le plan de cette étape :
--   (a) une Edge Function relais (vérifie is_super_admin, puis appelle la RPC en
--       service_role) ;
--   (b) un élargissement de la RPC elle-même, gardé par is_super_admin() en interne.
--
-- Choix : (b), l'élargissement -- mais IMPLÉMENTÉ comme une fonction relais SQL
-- (admin_relaunch_agency_review ci-dessous), jamais par une modification du GRANT de
-- recompute_agency_verification ni de son corps (fichier 20260728130000, hors périmètre
-- de cette tâche -- consigne du brief : cette migration-ci se modifie sur place, pas
-- celle du moteur). Ce choix fonctionne parce qu'un appel émis DEPUIS une fonction
-- SECURITY DEFINER s'exécute avec les privilèges de son PROPRIÉTAIRE, pas de l'appelant
-- d'origine (règle Postgres standard) : le relais et le moteur partagent le même
-- propriétaire (le rôle qui a joué les migrations), donc l'appel imbriqué
-- `perform recompute_agency_verification(...)` réussit sans jamais toucher au GRANT du
-- moteur, qui reste EXACTEMENT ce que documente 20260728130000 -- « service_role
-- uniquement » demeure vrai au sens propre : aucun rôle Postgres autre que service_role
-- n'obtient EXECUTE dessus.
--
-- Pourquoi pas l'Edge Function relais : la console appelle déjà les deux lectures de
-- cette même migration (get_admin_agency_review_queue/detail) et les trois autres
-- actions de cette tâche (valider/rejeter/résoudre) en RPC pur. Une seule des quatre
-- actions en Edge Function casserait l'uniformité de l'écran (deux conventions d'appel,
-- deux formes d'erreur, un aller-retour réseau de plus) pour un gain de sécurité nul :
-- admin_relaunch_agency_review n'est rien d'autre qu'une garde -- aucune logique de
-- score n'y est dupliquée, tout est délégué à recompute_agency_verification, dont le
-- comportement (vétos, score, protection d'un verdict humain) reste testé une seule fois
-- par agency-verification-engine.spec.ts. Le seul risque d'un élargissement -- oublier la
-- garde interne -- est ici confiné à une unique fonction de quelques lignes, plutôt que
-- dupliqué ou étalé sur le corps entier du moteur.
--
-- ── Où vit le motif de rejet ───────────────────────────────────────────────────────────
--
-- Aucune colonne rejection_reason sur agencies : même discipline que la file elle-même
-- (« pas de colonne de priorité dérivée », tâche 1) -- le §6 de la conception de
-- référence n'ajoute qu'une valeur d'énumération ('validated'), rien d'autre au modèle de
-- données. Le motif vit dans activity_events.metadata, à côté de l'identité du décideur :
-- c'est déjà la source de vérité pour « qui a décidé quoi et pourquoi » sur ce chantier,
-- et l'historique complet (get_admin_agency_review_detail, tâche 1) y renvoie déjà.
--
-- ── validate/reject/resolve : is_super_admin() SEUL, jamais is_service_role() ─────────
--
-- Contrairement aux deux lectures ci-dessus et à la relance, ces trois actions POSENT
-- une décision humaine et journalisent auth.uid() comme décideur (actor_kind='user').
-- Un appel service_role n'a pas de session -- auth.uid() y vaut NULL -- et y autoriser
-- l'accès permettrait à un script d'auto-valider un dossier sans qu'un humain ne l'ait
-- jamais vu, exactement ce que ce chantier existe pour empêcher (validation KYC sans
-- action humaine = interdit). La garde reste donc délibérément plus étroite que le
-- patron P3 des lectures.
--
-- ── validate/reject exigent manual_review ; relaunch exige seulement d'avoir été soumis ──
--
-- Valider et rejeter résolvent une entrée de LA FILE (get_admin_agency_review_queue, dont
-- le seul filtre est verification_status = 'manual_review') : agir sur un dossier jamais
-- soumis ('pending'), ou déjà tranché ('validated'/'rejected'/'auto_validated'), n'a pas
-- de sens métier et signale un bug d'appelant ou un écran périmé -- refusé explicitement
-- plutôt que toléré en silence.
--
-- « Relancer » n'exige PAS manual_review -- ce serait trop étroit : sa raison d'être est
-- justement de débloquer un dossier SOUMIS mais resté 'pending' plus de 15 minutes parce
-- que le déclenchement automatique (net.http_post fire-and-forget depuis
-- submit_agency_identity, 20260728150000) n'est jamais parti ou a échoué -- exactement
-- l'état que sweep_pending_agency_verifications() rattrape une fois par heure ; un
-- super-admin doit pouvoir forcer ce même rattrapage sans attendre le prochain passage du
-- filet. Déléguer à recompute_agency_verification la distinction tranché/pas-tranché
-- reste correct (retour anticipé sur rejected/validated, 20260728130000) -- imposer
-- manual_review ici ferait double emploi avec une règle qui vit déjà, correctement, dans
-- le moteur.
--
-- « Relancer » exige en revanche identity_submitted_at (CORRECTIF REVUE étape 5/tâche 2,
-- point 1, CRITIQUE, reproduit en base par le chemin réel) : recompute_agency_verification
-- ne sait rejeter que les dossiers déjà TRANCHÉS (rejected/validated), jamais un dossier
-- 'pending' -- et un dossier 'pending' JAMAIS SOUMIS (aucun check, aucun signataire) échoue
-- quand même tous ses vétos entité (aucun check ne peut valoir 'match'), donc atterrit en
-- 'manual_review' au lieu d'y rester insensible. Sans cette garde, deux appels
-- authentifiés parfaitement légitimes -- relancer puis valider -- suffisaient à faire
-- passer une agence de 'pending' à 'validated' sans la moindre pièce, exactement le statut
-- qui ouvre les gardes LAB en aval (ouverture de dossiers KYC clients, signature
-- électronique). Ce relais était le PREMIER appelant de recompute_agency_verification sans
-- précondition de soumission -- toutes les autres voies vers manual_review (validate/
-- reject ci-dessus) exigent déjà manual_review, donc de facto un dossier déjà passé au
-- moins une fois par le moteur. Prouvé rouge (agence jamais soumise validée en deux
-- appels) puis vert par agency-review-queue.spec.ts, describe admin_relaunch_agency_review.
--
-- Idempotente : CREATE OR REPLACE FUNCTION, REVOKE/GRANT rejouables sans effet de bord.

-- ─── (3) admin_validate_agency_review(agency_id) ─────────────────────────────────────
create or replace function public.admin_validate_agency_review(p_agency_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_status       text;
  v_agency_name  text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  -- FOR UPDATE : même discipline que submit_agency_identity / recompute_agency_verification
  -- (verrouille la ligne le temps de la décision, sérialise un double-clic ou deux
  -- relecteurs simultanés sur le même dossier).
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
end;
$$;

comment on function public.admin_validate_agency_review(uuid) is
  'Décision humaine (étape 5, tâche 2) : pose verification_status=''validated'' sur un dossier en manual_review -- jamais ''auto_validated'', réservé au moteur (recompute_agency_verification). Journalise activity_events (category=kyc, actor_kind=user, actor_id=auth.uid(), object_label=nom agence). super_admin uniquement, jamais service_role (une validation exige une décision humaine identifiable). 42501 si hors allowlist super-admin ; erreur explicite si le dossier n''existe pas ou n''est pas en manual_review. Voir docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-5.md.';

revoke all on function public.admin_validate_agency_review(uuid) from public, anon, service_role;
grant execute on function public.admin_validate_agency_review(uuid) to authenticated;

-- ─── (4) admin_reject_agency_review(agency_id, reason) ───────────────────────────────
create or replace function public.admin_reject_agency_review(p_agency_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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
end;
$$;

comment on function public.admin_reject_agency_review(uuid, text) is
  'Décision humaine (étape 5, tâche 2) : pose verification_status=''rejected'' sur un dossier en manual_review, motif OBLIGATOIRE (NULL ou blanc -> erreur), conservé dans activity_events.metadata.reason -- aucune colonne dédiée (même discipline que la file : pas de champ dérivé quand l''audit trail suffit). verified_at remis à NULL. Journalise category=kyc, severity=warn, actor_kind=user, actor_id=auth.uid(), object_label=nom agence. super_admin uniquement. Voir docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-5.md.';

revoke all on function public.admin_reject_agency_review(uuid, text) from public, anon, service_role;
grant execute on function public.admin_reject_agency_review(uuid, text) to authenticated;

-- ─── (5) admin_relaunch_agency_review(agency_id) -- l'élargissement gardé ────────────
create or replace function public.admin_relaunch_agency_review(p_agency_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_submitted_at timestamptz;
  v_agency_name  text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  -- FOR UPDATE : même discipline que validate/reject ci-dessus (verrouille la ligne le
  -- temps de la décision). Lit identity_submitted_at, PAS verification_status : voir
  -- l'en-tête de section pour pourquoi relancer n'exige pas manual_review mais exige quand
  -- même d'avoir été soumis -- un dossier jamais soumis est en 'pending' comme un dossier
  -- normalement en attente de saisie, rien ne les distingue par le statut seul.
  select identity_submitted_at, coalesce(legal_name, name) into v_submitted_at, v_agency_name
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
end;
$$;

comment on function public.admin_relaunch_agency_review(uuid) is
  'Décision humaine (étape 5, tâche 2) : déclenche recompute_agency_verification() (20260728130000, GRANT service_role uniquement et INCHANGÉ) depuis un jeton authenticated, via un appel imbriqué qui hérite des privilèges du propriétaire de CETTE fonction -- élargissement gardé par is_super_admin(), voir l''arbitrage en tête de section pour le choix face à une Edge Function relais. Exige identity_submitted_at posé (dossier SOUMIS) -- erreur explicite sinon ; PAS manual_review (relancer un dossier ''pending'' encore non traité par le moteur, ex. net.http_post jamais parti, est l''usage nominal -- voir sweep_pending_agency_verifications, 20260728150000). CORRECTIF REVUE point 1 (CRITIQUE) : sans cette garde, un dossier jamais soumis atteignait ''validated'' en deux appels authentifiés légitimes (relancer puis valider). Journalise systématiquement la demande humaine (category=kyc, actor_kind=user, object_label=nom agence) AVANT l''appel, y compris quand le moteur ressort sans effet sur un dossier déjà tranché (validated/rejected -- son propre retour anticipé, jamais dupliqué ici). super_admin uniquement. Voir docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-5.md.';

revoke all on function public.admin_relaunch_agency_review(uuid) from public, anon, service_role;
grant execute on function public.admin_relaunch_agency_review(uuid) to authenticated;

-- ─── (6) admin_resolve_agency_id_document(agency_id, check_id, result) ───────────────
--
-- La seule voie qui fait sortir un check id_document de pending_manual_review (posé par
-- submit_agency_identity_id_document, 20260728110000, et RIEN d'autre ne le résout
-- aujourd'hui -- voir le §« trois obstacles » du plan de cette étape). Sans cette
-- fonction, CE SEUL fait bloque l'auto-validation de tout dossier, même un dossier par
-- ailleurs parfait (docs/agency-kyb-handoff.md §7bis).
--
-- Append-only, comme le reste des tables de checks (20260728103000) : la ligne
-- pending_manual_review n'est JAMAIS mise à jour, une NOUVELLE ligne est insérée avec le
-- verdict du relecteur. C'est ce qui permet à get_admin_agency_review_detail (tâche 1) de
-- montrer l'historique complet -- « en attente, puis résolu en tel sens, à telle heure,
-- par tel décideur » -- plutôt qu'un dernier état qui effacerait la trace du passage en
-- revue. Conséquence directe : verrouiller la ligne pending elle-même ne sérialiserait
-- RIEN (elle ne change jamais d'état) -- le verrou porte donc sur la PERSONNE, qui, elle,
-- existe une seule fois.
--
-- p_check_id (pas p_related_person_id) : cible la ligne PRÉCISE que le relecteur vient de
-- regarder dans le détail du dossier (tâche 1), pas « la » pièce de cette personne -- une
-- personne ne peut de toute façon en avoir qu'une en attente à la fois (garde `not
-- exists` de submit_agency_identity_id_document), mais ancrer l'action sur l'id exact
-- écarte toute ambiguïté si cette hypothèse change un jour.
--
-- CORRECTIF REVUE étape 5/tâche 2, point 3 -- deux défauts dans cette même fonction :
--
--   1. p_agency_id (paramètre AJOUTÉ) : pas un filtre de résolution -- p_check_id seul
--      suffit à retrouver la ligne -- mais une ASSERTION de l'appelant, vérifiée avant
--      tout effet de bord : « je m'attends à résoudre une pièce de CETTE agence-ci ».
--      Avant ce correctif, rien ne distinguait un check_id légitime d'un check_id d'une
--      AUTRE agence : un écran de détail périmé (onglet resté ouvert, agence changée
--      entre-temps côté client) pouvait résoudre la pièce de n'importe quel dossier sans
--      le moindre obstacle. Refusé explicitement (mismatch) plutôt que toléré en silence,
--      même discipline que le reste de cette tâche.
--
--   2. Statut manual_review exigé : même règle que validate/reject ci-dessus, pour la
--      même raison -- résoudre une pièce sur un dossier déjà TRANCHÉ
--      (rejected/validated/auto_validated) ou jamais soumis (pending) ferait entrer une
--      preuve nouvelle dans un dossier CLOS, après le verdict, ce qui n'a pas de sens
--      métier et corrompt la piste d'audit (un dossier rejeté doit rester rejeté POUR LES
--      RAISONS consignées à ce moment-là, jamais amendé après coup). Avant ce correctif,
--      résoudre une pièce sur une agence déjà rejetée réussissait sans la moindre garde --
--      reproduit en base par agency-review-queue.spec.ts avant ce correctif.
--
-- Signature élargie (uuid, text) -> (uuid, uuid, text) : aucun appelant existant en dehors
-- de cette migration et de son spec (grep confirmé) -- DROP explicite de l'ancien
-- surcharge ci-dessous pour rester idempotent même si un déploiement antérieur avait posé
-- la version à deux arguments.
drop function if exists public.admin_resolve_agency_id_document(uuid, text);

create or replace function public.admin_resolve_agency_id_document(p_agency_id uuid, p_check_id uuid, p_result text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_related_person_id uuid;
  v_check_type         text;
  v_agency_id          uuid;
  v_status             text;
  v_agency_name        text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  -- match/partial/mismatch : le vocabulaire du reste du dispositif (CHECK de la table),
  -- MOINS unavailable et pending_manual_review -- ce ne sont pas des décisions humaines,
  -- ce sont des absences de décision. Le relecteur A le document sous les yeux : il ne
  -- peut pas conclure « unavailable », et reposer « pending_manual_review » serait un
  -- no-op déguisé en action.
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

  -- CORRECTIF point 3, défaut 2 (garde inter-agences) : voir l'en-tête de section. Une
  -- comparaison directe (jamais via p_agency_id dans le WHERE ci-dessus, qui resterait
  -- muet sur un mismatch) -- IS DISTINCT FROM couvre aussi le cas défensif où l'un des
  -- deux serait NULL.
  if v_agency_id is distinct from p_agency_id then
    raise exception 'verification check does not belong to the specified agency';
  end if;

  -- FOR UPDATE sur agencies : même discipline que validate/reject/relaunch ci-dessus.
  -- CORRECTIF point 3, défaut 1 (dossier clos) : voir l'en-tête de section.
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

  -- Verrou au niveau PERSONNE (voir en-tête de section) : la ligne en attente n'est
  -- jamais modifiée, donc la verrouiller elle-même ne sérialiserait rien face à deux
  -- résolutions concurrentes sur le même check_id.
  perform 1 from public.agency_related_persons where id = v_related_person_id for update;

  if exists (
    select 1 from public.agency_person_verification_checks
     where related_person_id = v_related_person_id
       and check_type = 'id_document'
       and result <> 'pending_manual_review'
  ) then
    raise exception 'id_document check already resolved for this person';
  end if;

  insert into public.agency_person_verification_checks
    (related_person_id, check_type, source, result)
  values
    (v_related_person_id, 'id_document', 'manual', p_result);

  -- entity_type='agency' (pas 'agency_related_person') : même convention que le reste du
  -- chantier KYB (108000/110000/130000/140000/150000) malgré une action person-scoped --
  -- related_person_id et check_id vivent dans metadata, comme le fait déjà
  -- submit_agency_identity_id_document pour ce même check_type. object_label : convention
  -- dépôt (voir admin_validate_agency_review ci-dessus ; CORRECTIF REVUE point 4).
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
  'Décision humaine (étape 5, tâche 2) : le relecteur qui a vu le document tranche si la pièce d''identité correspond à la personne déclarée. p_agency_id : assertion de l''appelant (pas un filtre de résolution) vérifiée contre l''agence RÉELLE du check -- erreur explicite (pas 42501, réservé aux refus de rôle) si elles ne correspondent pas, pour écarter un écran de détail périmé qui résoudrait la pièce d''une autre agence (CORRECTIF REVUE point 3). Exige verification_status=''manual_review'' sur cette agence, même règle que validate/reject : refuse un dossier jamais soumis ou déjà tranché (rejected/validated/auto_validated), qui ferait entrer une preuve nouvelle dans un dossier clos (CORRECTIF REVUE point 3). INSERT append-only (jamais UPDATE) dans agency_person_verification_checks -- la ligne pending_manual_review d''origine (posée par submit_agency_identity_id_document, 20260728110000) reste intacte, l''historique complet reste lisible depuis get_admin_agency_review_detail (tâche 1). p_result in (match, partial, mismatch) -- jamais unavailable ni pending_manual_review, qui ne sont pas des décisions humaines. Verrou FOR UPDATE sur agencies PUIS agency_related_persons (pas sur la ligne de check, qui ne change jamais d''état) : une pièce déjà résolue ne se laisse pas résoudre deux fois. Journalise activity_events (category=kyc, actor_kind=user, entity_type=agency -- même convention que le reste du chantier KYB malgré une action person-scoped, object_label=nom agence). super_admin uniquement. Voir docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-5.md et son §"trois obstacles" (pièce bloquée en permanence sans cette fonction).';

revoke all on function public.admin_resolve_agency_id_document(uuid, uuid, text) from public, anon, service_role;
grant execute on function public.admin_resolve_agency_id_document(uuid, uuid, text) to authenticated;
