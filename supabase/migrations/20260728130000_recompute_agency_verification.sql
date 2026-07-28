-- Étape 3 du chantier KYB, tâche 2 — moteur de scoring et de statut de vérification.
--
-- RPC Postgres (pas une Edge Function) : tous les moteurs de score de ce projet vivent
-- en base (calculate_property_scores, scoring contacts, focus radar), et l'agrégation
-- pondérée sur des lignes de checks est du SQL naturel — atomique avec la donnée, sans
-- aller-retour réseau, testable par le harnais backend existant. Les Edge Functions
-- restent nécessaires pour les CONNECTEURS (réseau), pas pour ce calcul. Voir
-- docs/agency-kyb-handoff.md §7 et docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-3.md.
--
-- Consomme get_agency_verification_config() (tâche 1, 20260728120000) plutôt que de
-- relire app_config directement — même discipline que le reste du chantier : un seul
-- point de lecture du barème. Seul auto_validate_min pilote une branche de CE calcul ;
-- review_priority_min ne distingue aucun statut ici (« Pas de colonne de priorité » —
-- la file admin de l'étape 5 triera sur le score lui-même), il est lu ailleurs, jamais
-- consommé par cette fonction.
--
-- Portée des vétos PERSONNE (pep_sanctions_screening, id_document) : limitée aux
-- SIGNATAIRES ACTIFS de l'agence, jamais aux UBO. Ce n'est pas un raccourci du moteur :
-- c'est ce que le reste du chantier produit déjà. submit_agency_identity()
-- (20260728110000) refuse explicitement de poser un check id_document sur une personne
-- qui ne porte pas un rôle signatory actif. Exiger un check PEP/pièce d'identité sur un
-- UBO passif — qui n'a par construction aucun chemin applicatif pour en recevoir un —
-- bloquerait en revue humaine, à perpétuité, toute agence ayant un UBO déclaré, non pas
-- pour une vraie raison de conformité mais pour une incohérence de périmètre entre le
-- moteur et le wizard. À revisiter le jour où l'étape 4 câble un screening PEP des UBO.
--
-- Idempotente : CREATE OR REPLACE FUNCTION, REVOKE/GRANT rejouables sans effet de bord.

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

  if v_status in ('rejected', 'validated') then
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
  scored as (
    select lac.result, cfg.weight
    from latest_agency_checks lac
    join public.verification_check_config cfg
      on cfg.check_type = lac.check_type
     and cfg.valid_from <= lac.checked_at
     and (cfg.valid_to is null or cfg.valid_to > lac.checked_at)
    where not cfg.is_veto
      and lac.result not in ('unavailable', 'pending_manual_review')
    union all
    select lpc.result, cfg.weight
    from latest_person_checks lpc
    join public.verification_check_config cfg
      on cfg.check_type = lpc.check_type
     and cfg.valid_from <= lpc.checked_at
     and (cfg.valid_to is null or cfg.valid_to > lpc.checked_at)
    where not cfg.is_veto
      and lpc.result not in ('unavailable', 'pending_manual_review')
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

comment on function public.recompute_agency_verification(uuid) is
  'Moteur de scoring KYB (étape 3). Calcule agencies.verification_score (moyenne pondérée sur le dernier check de chaque type, ENTITÉ et PERSONNE scorable — signatory_registry_match, poa_document_review — des seuls signataires actifs, poids et statut de véto lus dans la configuration en vigueur à la date du check — jamais la configuration courante) et verification_status (auto_validated seulement si aucun véto entité/personne en échec ou absent, aucun check en pending_manual_review, un signataire actif identifié, et un score >= auto_validate_min ; manual_review sinon, y compris score NULL). Les vétos personne portent sur les signataires actifs uniquement. Un statut rejected ou validated (verdict humain) n''est jamais posé ni écrasé par cette fonction : retour anticipé sans effet de bord. Journalise un activity_events (category=kyc) à chaque passage effectif. service_role uniquement — voir docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-3.md.';

revoke all on function public.recompute_agency_verification(uuid) from public, anon, authenticated;
grant execute on function public.recompute_agency_verification(uuid) to service_role;
