-- Étape 7, tâche 5 : la boucle de remédiation. Un dossier cesse d'être un cul-de-sac.
--
-- LE DÉFAUT. `admin_reject_agency_review` (20260729151500) pose
-- verification_status='rejected' et NE TOUCHE PAS identity_submitted_at. Or le gate
-- d'onboarding (useIdentityGate) ne lit QUE cette colonne et rend 'done' dès qu'elle est
-- posée, et le moteur (20260729151200) refuse d'écraser 'rejected'. Résultat : le gate ne se
-- réouvre jamais, le wizard devient inatteignable, le garde LAB reste fermé, et AUCUNE des
-- quatre décisions humaines ne rouvre un dossier. Une agence rejetée par erreur, ou rejetée
-- pour une faute de saisie corrigeable, était bloquée à vie sans aucun chemin self-serve. Le
-- seul recours était un UPDATE manuel en base, hors de toute piste d'audit prévue.
--
-- LA DÉCISION PRODUIT (Thomas, 30.07.2026) : un CINQUIÈME statut, `correction_requested`,
-- distinct de `rejected` qui reste TERMINAL. Le choix entre ce statut et un simple retour à
-- 'pending' a été tranché en faveur du statut dédié, pour la même raison qui avait fait
-- ajouter `validated` à côté d'`auto_validated` : « qui a décidé, et pourquoi ce dossier est
-- revenu » est précisément ce qu'un audit LAB regarde. Un retour à 'pending' aurait rendu un
-- dossier renvoyé indiscernable d'un dossier neuf.
--
-- Cohérence de l'ensemble : `rejected` ne reste terminal QUE PARCE QUE
-- `correction_requested` existe. Un relecteur qui veut laisser une chance demande une
-- correction ; un relecteur qui rejette ferme le dossier. Deux gestes, deux sens. Un rejet
-- qui peut se défaire n'est plus un rejet.
--
-- QUATRE OBJETS TOUCHÉS, ET POURQUOI IL FAUT LES QUATRE :
--
--   1. La contrainte CHECK, sinon la nouvelle valeur ne peut pas être écrite.
--   2. La RPC `admin_request_agency_correction`, cinquième décision humaine.
--   3. `recompute_agency_verification`, RECOPIÉ à l'identique à une ligne près : le nouveau
--      statut rejoint la liste des verdicts humains que le moteur n'écrase jamais. Sans
--      cela, un recalcul effacerait la demande du relecteur. Aucun chemin ne déclenche le
--      moteur sur un dossier `correction_requested` aujourd'hui (le filet horaire ne ramasse
--      que 'pending', et `admin_relaunch_agency_review` exige identity_submitted_at posé),
--      mais « aucun chemin aujourd'hui » est exactement le raisonnement qui avait laissé
--      `pep_sanctions_screening` sans source pendant six étapes. La liste du moteur est un
--      ÉNONCÉ de ce qui est une décision humaine, pas une optimisation.
--   4. `submit_agency_identity`, RECOPIÉ à l'identique à un bloc près : une resoumission
--      rend la main au moteur en repassant le dossier en 'pending'. Sans ce point, le 3
--      ci-dessus enfermerait le dossier dans `correction_requested` pour toujours : le
--      relecteur aurait demandé une correction, l'agence l'aurait fournie, et rien ne serait
--      jamais recalculé. Les deux vont ensemble ou pas du tout.
--
-- Les deux fonctions recopiées l'ont été par EXTRACTION MÉCANIQUE de leur dernière version
-- (20260729151200 pour le moteur, 20260731121000 pour la soumission), puis substitution du
-- seul fragment concerné -- jamais retapées. Le moteur a été redéfini une fois, la soumission
-- quatre fois (20260729150800, 20260729151000, 20260729151400, 20260731121000) : une
-- transcription à la main y aurait perdu le déclenchement net.http_post ou la garde de
-- remplacement de la pièce d'identité, en silence.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS. Elle ne touche pas au garde LAB : sa liste blanche
-- (`auto_validated` ou `validated` seulement) bloque déjà `correction_requested` par
-- construction, sans rien à changer côté serveur. C'est le LIBELLÉ qui doit changer côté
-- écran (useLabGuard, nouveau cas 'blocked_correction_requested'), parce que dire « en
-- attente de vérification » à quelqu'un dont on attend LA correction serait faux.
--
-- Idempotente : DROP CONSTRAINT IF EXISTS avant ADD, CREATE OR REPLACE, REVOKE/GRANT
-- rejouables.

begin;

-- ─── 1. La contrainte accueille le cinquième statut ─────────────────────────────────
alter table public.agencies drop constraint if exists agencies_verification_status_chk;
alter table public.agencies
  add constraint agencies_verification_status_chk
  check (verification_status in
    ('pending', 'auto_validated', 'validated', 'manual_review', 'rejected', 'correction_requested'));

comment on column public.agencies.verification_status is
  'État de la vérification KYB. pending = soumis, pas encore calculé. auto_validated = décision du MOTEUR. validated = décision d''un HUMAIN (la distinction est ce qu''un audit LAB regarde). manual_review = en attente d''un relecteur. rejected = refusé, TERMINAL. correction_requested = renvoyé au dirigeant pour correction (étape 7, tâche 5) : identity_submitted_at est remis à NULL par la même RPC, donc le gate d''onboarding se réouvre et la saisie se dégèle ; la resoumission repasse le dossier en pending et rend la main au moteur.';

-- ─── 2. La cinquième décision humaine ──────────────────────────────────────────────
--
-- Mêmes droits et mêmes gardes que les quatre autres (patron P3 : EXECUTE authenticated,
-- garde interne is_super_admin(), verrou FOR UPDATE) -- un relecteur ne doit pas avoir à
-- apprendre une seconde grammaire pour la cinquième action de la même file.
--
-- Exige `manual_review`, comme validate et reject : on ne demande une correction que sur un
-- dossier qui attend une décision. Refuser un dossier jamais soumis évite qu'une demande de
-- correction serve à contourner l'ordre du parcours ; refuser un dossier déjà tranché évite
-- de rouvrir après coup un dossier clos, ce que la piste d'audit ne doit pas laisser faire.
--
-- Le motif est OBLIGATOIRE, contrairement à celui du rejet qui est déjà nommé par le statut
-- lui-même : « corrigez » sans dire quoi renverrait le dirigeant au wizard sans savoir quelle
-- ligne reprendre, et le ferait resoumettre à l'identique. Il vit dans metadata, comme celui
-- du rejet -- aucune colonne dédiée.
create or replace function public.admin_request_agency_correction(p_agency_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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
end;
$$;

comment on function public.admin_request_agency_correction(uuid, text) is
  'Cinquième décision humaine de la file de revue (étape 7, tâche 5) : renvoie le dossier au dirigeant pour correction, au lieu de le rejeter. Pose verification_status=''correction_requested'', remet identity_submitted_at à NULL -- ce qui rouvre le gate d''onboarding ET dégèle les colonnes d''identité légale, les deux tenant à cette seule colonne -- et remet verified_at à NULL. Exige verification_status=''manual_review'' (même règle que validate/reject : ni un dossier jamais soumis, ni un dossier déjà tranché). Motif OBLIGATOIRE, dans metadata : « corrigez » sans dire quoi ferait resoumettre à l''identique. Journalise activity_events (category=kyc, actor_kind=user, severity=warn, object_label=nom agence). La resoumission repasse le dossier en ''pending'' (submit_agency_identity) et rend la main au moteur, qui n''écrase jamais ''correction_requested'' de lui-même. super_admin uniquement. Voir docs/superpowers/plans/2026-07-30-onboarding-kyb-etape-7-remediation.md.';

revoke all on function public.admin_request_agency_correction(uuid, text) from public, anon, service_role;
grant execute on function public.admin_request_agency_correction(uuid, text) to authenticated;

-- ─── 3. Le moteur n'écrase jamais une décision humaine ─────────────────────────────
--
-- RECOPIE MÉCANIQUE de 20260729151200, une seule ligne modifiée : `correction_requested`
-- rejoint `rejected` et `validated` dans la liste des verdicts que le moteur laisse
-- intacts. Tout le reste -- le départage par ctid, les checks de personne scorables, le
-- JOIN LATERAL contre une table de configuration sale -- est identique caractère pour
-- caractère.
create or replace function public.recompute_agency_verification(p_agency_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_status               text;
  v_cfg                  jsonb;
  v_auto_validate_min    numeric;
  v_score                numeric;
  v_veto_failed          boolean;
  v_has_pending          boolean;
  v_has_active_signatory boolean;
  v_needs_review         boolean;
  v_new_status           text;
begin
  -- 0. Verrou + lecture du statut courant. Un verdict humain (rejected/validated) ne se
  -- retourne jamais tout seul au prochain passage du moteur, même si le score recalculé
  -- suggérerait une autre conclusion : on sort AVANT tout calcul — ni le score, ni
  -- verified_at, ni un événement d'audit ne bougent pour un dossier déjà tranché.
  -- FOR UPDATE sérialise deux appels concurrents sur la même agence (même discipline que
  -- submit_agency_identity, 20260728108000).
  select verification_status into v_status
    from public.agencies
   where id = p_agency_id
     for update;

  if v_status is null then
    return; -- agence inexistante : rien à calculer, RPC silencieuse plutôt que bruyante
  end if;

  if v_status in ('rejected', 'validated', 'correction_requested') then
    return;
  end if;

  -- 1. Barème courant (tâche 1).
  v_cfg := public.get_agency_verification_config();
  v_auto_validate_min := (v_cfg ->> 'auto_validate_min')::numeric;

  -- 2. Score, vétos et « en attente de revue » — une seule requête combinée sur les
  -- checks ENTITÉ (dernier par type) et les checks des SIGNATAIRES ACTIFS (dernier par
  -- personne et par type).
  with latest_agency_checks as (
    -- append-only : une ré-exécution ajoute une ligne, on ne garde que la plus récente.
    -- Départage `ctid desc` INDISPENSABLE : checked_at vaut now() par défaut, l'heure de
    -- DÉBUT DE TRANSACTION — deux lignes du même type écrites dans la même transaction
    -- (un connecteur qui rejoue un check, étape 4) portent donc un checked_at identique.
    -- Sans départage, `distinct on` retient une ligne non spécifiée parmi les ex æquo ;
    -- constaté en revue : un registry_lookup en mismatch inséré après coup se faisait
    -- écarter au profit du match plus ancien — direction inverse de ce qu'exige la
    -- conformité. `ctid` (emplacement physique de la ligne) croît avec l'ordre
    -- d'insertion au sein d'une même transaction : c'est la ligne la plus récemment
    -- insérée qui l'emporte, jamais une ligne arbitraire.
    select distinct on (check_type) check_type, result, checked_at
    from public.agency_verification_checks
    where agency_id = p_agency_id
    order by check_type, checked_at desc, ctid desc
  ),
  active_signatories as (
    select arp.id
    from public.agency_related_persons arp
    join public.agency_person_roles apr on apr.related_person_id = arp.id
    where arp.agency_id = p_agency_id
      and apr.role = 'signatory'
      and (apr.valid_to is null or apr.valid_to > current_date)
  ),
  latest_person_checks as (
    -- Même départage `ctid desc` et pour la même raison que latest_agency_checks
    -- ci-dessus : checked_at seul ne distingue pas deux lignes de la même transaction.
    select distinct on (apvc.related_person_id, apvc.check_type)
      apvc.related_person_id, apvc.check_type, apvc.result, apvc.checked_at
    from public.agency_person_verification_checks apvc
    where apvc.related_person_id in (select id from active_signatories)
    order by apvc.related_person_id, apvc.check_type, apvc.checked_at desc, apvc.ctid desc
  ),
  -- Score : moyenne pondérée sur les checks non-véto (ENTITÉ **et** PERSONNE scorables),
  -- poids ET statut de véto lus dans la configuration EN VIGUEUR À LA DATE DU CHECK
  -- (jointure temporelle) — c'est ce qui permet de rejustifier un score passé avec le
  -- barème d'alors, jamais avec le barème courant. unavailable et pending_manual_review
  -- sont exclus du numérateur ET du dénominateur : ni pénalisés ni crédités, seulement
  -- moins confirmés/pas encore tranchés.
  --
  -- Checks de PERSONNE : le plan de l'étape 3 (« Les deux niveaux comptent ») simplifiait
  -- en écrivant que seuls les checks d'agence alimentent le score. C'est faux — arbitrage
  -- tranché en faveur de la conception de référence, docs/agency-kyb-verification.md §2 B,
  -- qui liste explicitement « signataire listé comme organe au registre »
  -- (signatory_registry_match) parmi les signaux moyens qui CONTRIBUENT AU SCORE, aux
  -- côtés de poa_document_review. Revue (23 % du poids du catalogue ignoré en silence) :
  -- les deux en mismatch, tout le reste parfait, l'agence se retrouvait auto-validée avec
  -- un score de 1.000. latest_person_checks est déjà restreint aux SIGNATAIRES ACTIFS et
  -- dédupliqué par (personne, type) : mêmes règles que côté entité, sans rien changer aux
  -- vétos de personne ci-dessous, qui continuent de lire la même CTE indépendamment.
  --
  -- JOIN LATERAL … LIMIT 1 plutôt qu'un JOIN plat : l'index unique sur
  -- verification_check_config ne protège que les lignes OUVERTES (where valid_to is
  -- null), rien n'empêche deux lignes FERMÉES du même check_type de se chevaucher dans le
  -- temps (correction de données, rejeu de migration). Un JOIN plat compterait alors le
  -- même check deux fois, une fois par ligne de config chevauchante — constaté en revue :
  -- score de 0.800 au lieu de 0.667. Le moteur ne suppose plus la table propre : il ne
  -- retient qu'UNE SEULE ligne de config par check (la plus récente par valid_from, id en
  -- dernier départage), quel que soit l'état de la table.
  scored as (
    select lac.result, cfg.weight
    from latest_agency_checks lac
    join lateral (
      select c.weight
      from public.verification_check_config c
      where c.check_type = lac.check_type
        and c.valid_from <= lac.checked_at
        and (c.valid_to is null or c.valid_to > lac.checked_at)
        and not c.is_veto
      order by c.valid_from desc, c.id desc
      limit 1
    ) cfg on true
    where lac.result not in ('unavailable', 'pending_manual_review')
    union all
    select lpc.result, cfg.weight
    from latest_person_checks lpc
    join lateral (
      select c.weight
      from public.verification_check_config c
      where c.check_type = lpc.check_type
        and c.valid_from <= lpc.checked_at
        and (c.valid_to is null or c.valid_to > lpc.checked_at)
        and not c.is_veto
      order by c.valid_from desc, c.id desc
      limit 1
    ) cfg on true
    where lpc.result not in ('unavailable', 'pending_manual_review')
  ),
  -- Vétos : la politique EN VIGUEUR MAINTENANT (valid_to is null) dit QUELS types
  -- gatent — un type absent de la table de checks n'a pas de checked_at auquel ancrer
  -- une jointure temporelle, donc pas d'autre référence possible que la config active
  -- pour savoir ce qu'on doit y trouver. Ne passe que sur 'match' : absent, mismatch,
  -- partial, unavailable et pending_manual_review échouent tous le véto de la même
  -- façon — IS DISTINCT FROM capture aussi bien la ligne manquante (résultat NULL après
  -- le LEFT JOIN) que le résultat défavorable.
  veto_types_agency as (
    select t.code
    from public.verification_check_types t
    join public.verification_check_config c on c.check_type = t.code and c.valid_to is null
    where t.scope = 'agency' and c.is_veto
  ),
  veto_types_person as (
    select t.code
    from public.verification_check_types t
    join public.verification_check_config c on c.check_type = t.code and c.valid_to is null
    where t.scope = 'person' and c.is_veto
  ),
  veto_agency_gap as (
    select 1
    from veto_types_agency vt
    left join latest_agency_checks lac on lac.check_type = vt.code
    where lac.result is distinct from 'match'
  ),
  veto_person_gap as (
    -- Chaque signataire actif doit individuellement passer chaque véto personne — un
    -- second signataire (signature_power='joint') non blanchi ne doit pas se cacher
    -- derrière le premier.
    select 1
    from active_signatories s
    cross join veto_types_person vt
    left join latest_person_checks lpc
      on lpc.related_person_id = s.id and lpc.check_type = vt.code
    where lpc.result is distinct from 'match'
  ),
  pending_gap as (
    select 1 from latest_agency_checks where result = 'pending_manual_review'
    union all
    select 1 from latest_person_checks where result = 'pending_manual_review'
  )
  select
    (select case when sum(weight) > 0
                 then round(
                        sum(weight * case result
                                       when 'match'    then 1
                                       when 'partial'  then 0.5
                                       when 'mismatch' then 0
                                     end) / sum(weight), 3)
                 else null
            end
       from scored),
    exists (select 1 from veto_agency_gap) or exists (select 1 from veto_person_gap),
    exists (select 1 from pending_gap)
  into v_score, v_veto_failed, v_has_pending;

  -- 3. Signataire actif — condition SUPPLÉMENTAIRE au mécanisme de véto : une entité
  -- dont on ignore qui l'engage ne se valide pas, même vétos et score par ailleurs
  -- parfaits. Même requête que _agency_identity_completeness_error (20260728108000).
  select exists (
    select 1
      from public.agency_person_roles apr
      join public.agency_related_persons arp on arp.id = apr.related_person_id
     where arp.agency_id = p_agency_id
       and apr.role = 'signatory'
       and (apr.valid_to is null or apr.valid_to > current_date)
  ) into v_has_active_signatory;

  -- 4. Décision. auto_validated SEULEMENT si rien ne s'y oppose. Toute autre combinaison
  -- part en manual_review — pas de second statut pour la priorité, qui vient du tri de
  -- la file admin sur le score (étape 5), jamais d'une colonne dérivée.
  v_needs_review :=
    v_veto_failed
    or v_has_pending
    or not v_has_active_signatory
    or v_score is null
    or v_score < v_auto_validate_min;

  v_new_status := case when v_needs_review then 'manual_review' else 'auto_validated' end;

  update public.agencies
     set verification_score  = v_score,
         verification_status = v_new_status,
         -- verified_at ne vaut que pour une conclusion POSITIVE du moteur : un passage
         -- qui redescend en manual_review (nouveau check défavorable, config modifiée)
         -- efface la confirmation précédente plutôt que de la laisser mentir sur l'état
         -- courant du dossier.
         verified_at = case when v_new_status = 'auto_validated' then now() else null end
   where id = p_agency_id;

  -- 5. Audit LAB : category='kyc' (jamais 'compliance', hors CHECK), actor_kind='system'
  -- impose actor_id NULL (contrainte activity_events_actor_kind_coherence) — c'est le
  -- moteur qui agit, pas un humain. metadata sans PII (score/statut/booléens seulement).
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, metadata)
  values (
    p_agency_id, null, 'system', 'agency_verification_recomputed', 'agency', p_agency_id,
    'kyc', case when v_new_status = 'auto_validated' then 'info' else 'warn' end,
    jsonb_build_object(
      'score', v_score,
      'status', v_new_status,
      'veto_failed', v_veto_failed,
      'has_pending', v_has_pending,
      'has_active_signatory', v_has_active_signatory
    )
  );
end;
$$;
-- ─── 4. Une resoumission rend la main au moteur ────────────────────────────────────
--
-- RECOPIE MÉCANIQUE de 20260731121000, un seul bloc ajouté (voir son commentaire en place).
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
  --
  -- ETAPE 7, TACHE 5 : une resoumission apres correction demandee REND LA MAIN AU MOTEUR.
  -- Le moteur refuse d'ecraser 'correction_requested' (c'est une decision humaine, comme
  -- 'rejected' et 'validated'), donc si personne ne remettait le dossier en 'pending', il
  -- resterait bloque dans cet etat pour toujours : le relecteur aurait demande une
  -- correction, l'agence l'aurait fournie, et rien ne serait jamais recalcule. C'est ICI que
  -- la main se rend, dans la MEME UPDATE que l'horodatage, parce que c'est le meme
  -- evenement -- la resoumission -- et qu'une seconde ecriture laisserait une fenetre ou
  -- l'horodatage est pose et le statut encore 'correction_requested'.
  --
  -- Seul 'correction_requested' est concerne : ni 'rejected' (terminal, decision assumee)
  -- ni 'validated' ne doivent redevenir 'pending' parce qu'un dirigeant a rappele cette RPC.
  -- Un dossier a sa PREMIERE soumission vaut deja 'pending' par defaut : la clause est donc
  -- sans effet sur le cas nominal.
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

-- ─── 5. Les deux commentaires que la recopie ne portait pas ─────────────────────────
--
-- `create or replace function` conserve les privilèges (contrairement à DROP + CREATE) : les
-- GRANT posés par 20260729151200 et 20260731121000 restent en place, rien à redonner. Les
-- COMMENT, eux, survivraient PÉRIMÉS -- ils décrivent un comportement qui vient de changer.
comment on function public.recompute_agency_verification(uuid) is
  'Moteur de scoring KYB (étape 3). Calcule agencies.verification_score (moyenne pondérée sur le dernier check de chaque type, ENTITÉ et PERSONNE scorable — signatory_registry_match, poa_document_review — des seuls signataires actifs, poids et statut de véto lus dans la configuration en vigueur À LA DATE DU CHECK, jamais la configuration courante) et verification_status (auto_validated seulement si aucun véto entité/personne en échec ou absent, aucun check en pending_manual_review, un signataire actif identifié, et un score >= auto_validate_min ; manual_review sinon, y compris score NULL). Les vétos personne portent sur les signataires actifs uniquement. Un VERDICT HUMAIN n''est jamais posé ni écrasé par cette fonction — retour anticipé sans effet de bord : rejected, validated, et depuis l''étape 7/tâche 5 correction_requested. Cette liste est un ÉNONCÉ de ce qui relève de l''humain, pas une optimisation : aucun chemin ne déclenche le moteur sur un dossier correction_requested aujourd''hui, mais « aucun chemin aujourd''hui » est le raisonnement qui avait laissé pep_sanctions_screening sans source pendant six étapes. Journalise un activity_events (category=kyc) à chaque passage effectif. service_role uniquement.';

comment on function public.submit_agency_identity(uuid) is
  'Le dirigeant déclare sa saisie d''identité KYB terminée (étape 2 onboarding). Vérifie la complétude (raison sociale, forme juridique, pays, signataire actif), pose agencies.identity_submitted_at, journalise dans activity_events (category=kyc), puis déclenche agency-verification-run via net.http_post best-effort (jamais bloquant). p_related_person_id (optionnel) : pose une demande de revue de la pièce d''identité après avoir vérifié que la personne appartient à l''agence de l''appelant ET porte un rôle signatory ACTIF. ÉTAPE 7, TÂCHE 2 : la demande est reposée dès que la ligne LA PLUS RÉCENTE pour cette personne (_latest_person_verification_check, même départage que le moteur) n''est ni pending_manual_review ni match — une pièce refusée redevient donc remplaçable. ÉTAPE 7, TÂCHE 5 : une resoumission d''un dossier en correction_requested le repasse en pending et remet verification_sweep_attempts à 0, dans la MÊME UPDATE que l''horodatage — c''est ce qui rend la main au moteur, qui refuse d''écraser ce statut de lui-même. Ni rejected ni validated ne sont concernés. Concurrence : verrou FOR UPDATE sur la ligne agencies. Idempotente : un second appel ne re-timestampe ni ne re-journalise, ne pose jamais deux demandes de revue simultanées pour la même personne, et ne redéclenche jamais la vérification. Voir docs/superpowers/plans/2026-07-30-onboarding-kyb-etape-7-remediation.md.';

commit;
