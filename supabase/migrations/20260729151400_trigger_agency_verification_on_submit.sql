-- Étape 4 du chantier KYB, tâche 4 — le déclenchement.
--
-- Le socle existe depuis la tâche 1 (agency-verification-run, 20260728140000) et les
-- connecteurs depuis les tâches 2-3 (RDAP, VIES, recherche-entreprises, Mapbox), mais
-- personne n'appelait cette Edge Function : submit_agency_identity() posait
-- identity_submitted_at et s'arrêtait là (useAgencyIdentity.ts `submit()` n'appelle QUE
-- cette RPC, jamais l'edge function — vérifié en lisant le hook avant d'écrire cette
-- migration). Un dirigeant soumettait son dossier et rien ne se passait ensuite.
--
-- ─── Le motif retenu, et pourquoi pas un autre ─────────────────────────────────────
--
-- submit_agency_identity() est une RPC Postgres ; Postgres n'appelle pas d'Edge
-- Function nativement. Trois options existaient (cf. le plan de cette tâche) :
--   1. Un appel depuis le CLIENT après la soumission (useAgencyIdentity.ts).
--   2. `net.http_post` depuis PL/pgSQL (pg_net).
--   3. Un cron qui ramasse les dossiers soumis non encore vérifiés.
--
-- Ce dépôt utilise DÉJÀ (2), abondamment, des deux côtés :
--   - Depuis des triggers PL/pgSQL de la baseline (trigger_matching_on_new_search,
--     trigger_matching_on_price_change, trigger_matching_on_property_active,
--     trigger_matching_on_search_updated) : `net.http_post` avec
--     get_app_config('supabase_url'|'service_role_key'), déclenché par une écriture
--     applicative — exactement la forme de cette tâche (une écriture — ici
--     identity_submitted_at — doit faire partir un appel réseau).
--   - Depuis des jobs pg_cron (realadvisor-*, whatsapp-*, admin-monitoring,
--     flatfox-sync…) : même `net.http_post`, même paire get_app_config, appelant
--     `/functions/v1/<nom>`.
--
-- (1) aurait été un TROISIÈME motif — introduit nulle part ailleurs dans ce dépôt pour
-- ce genre de déclenchement, et le hook client actuel (useAgencyIdentity.ts submit())
-- n'a aucune raison de porter une responsabilité qu'une RPC SECURITY DEFINER peut
-- assumer elle-même, atomiquement, sans dépendre d'un second aller-retour réseau que
-- le navigateur pourrait ne jamais faire (onglet fermé, erreur JS). On aligne donc sur
-- (2), déjà établi — voir plus bas la fonction modifiée. (3) seul aurait fonctionné
-- mais retardé CHAQUE dossier d'au moins un cycle de cron — inutile quand (2) permet
-- un départ immédiat ; (3) reste néanmoins ajouté ci-dessous en FILET, cf. section
-- dédiée, car (2) peut échouer silencieusement (voir son en-tête).
--
-- ─── La contrainte d'expérience : ne jamais faire attendre l'utilisateur ──────────
--
-- `net.http_post` MET LA REQUÊTE EN FILE (table net.http_request_queue, vidée par un
-- worker en tâche de fond) plutôt que de la jouer en ligne : l'appelant (ici,
-- submit_agency_identity) reçoit le contrôle dès l'INSERT dans la file, sans jamais
-- attendre la réponse HTTP réelle d'agency-verification-run — qui, elle, interroge 5
-- sources externes et peut prendre plusieurs secondes. C'est déjà documenté ainsi
-- ailleurs dans ce dépôt : 20260714170000 (purge chat-staging) — « pg_net est
-- asynchrone (fire-and-forget, comme les autres crons net.http_*) » ; 20260705180000
-- (whatsapp-morning-brief) — le "tick FILET" existe précisément parce qu'un appel
-- pg_net peut ne jamais aboutir sans que l'appelant original en sache quoi que ce
-- soit. Exactement la contrainte visée ici : le dossier est soumis, la vérification
-- suit — jamais l'inverse.
--
-- `timeout_milliseconds := 15000` (ni 10000, ni 30000) sur les deux `net.http_post`
-- ci-dessous — corrigé en revue (étape 4/tâche 4, point 2) : voir cette section pour
-- le raisonnement complet, et _shared/kyb-sources.ts pour le budget cité.
--
-- Pourquoi pas 10000 (valeur d'origine) : c'est EXACTEMENT `DEFAULT_SOURCE_TIMEOUT_MS`
-- (_shared/kyb-sources.ts), le budget accordé à CHAQUE connecteur — et
-- agency-verification-run les exécute tous en PARALLÈLE (runAgencyKybSources ->
-- Promise.all), jamais en série. Le pire cas réel de l'Edge Function est donc déjà
-- d'environ 10s (le connecteur le plus lent, pas leur somme) AVANT même le travail
-- séquentiel qui suit (lecture de l'agence, appel à record_agency_verification_run,
-- sérialisation de la réponse) — un aller-retour Postgres supplémentaire, plus la
-- marge habituelle d'un cold start Deno. Sans marge, pg_net peut cesser d'attendre
-- au moment précis où les connecteurs finissent tout juste, PENDANT que l'Edge
-- Function fait encore ce travail-là : un faux dépassement de délai enregistré pour
-- une vérification qui, elle, aboutit bel et bien (l'Edge Function continue de
-- tourner jusqu'à son terme côté Deno quel que soit le moment où Postgres cesse
-- d'attendre sa réponse — seule la CONSTATATION du résultat par pg_net, jamais lue
-- par cette RPC, est concernée). 15000 laisse ~5s de marge sur ce pire cas des 10s.
--
-- Pourquoi pas une valeur plus large, par ex. 30000 (la toute première version de
-- cette migration) : constaté en vérifiant cette migration contre le worker pg_net
-- local — une requête qui n'aboutit qu'au bout de son propre délai (ex. cible
-- injoignable) occupe le worker jusqu'à ce délai, et RETARDE D'AUTANT le traitement
-- des requêtes voisines encore en file (le worker traite ses requêtes en lot ; un
-- lot ne se libère qu'une fois son membre le plus lent réglé) — la revue a confirmé
-- que 30000 aggravait cette contagion entre requêtes. Une valeur trop généreuse ici
-- referait, à l'échelle de la base entière, ce que cette tâche cherche justement à
-- éviter pour l'utilisateur : une attente. 15000 reste loin des 30000 initiaux tout
-- en couvrant le vrai pire cas ci-dessus.
--
-- ─── Le point délicat : un échec de vérification ne doit jamais faire échouer la
-- soumission ────────────────────────────────────────────────────────────────────────
--
-- Même leçon que le chemin d'inscription (handle_new_user -> provision_solo_agency,
-- 20260728105000) : « Best-effort sur l'agence, un échec ne bloque jamais
-- l'inscription. » Un dirigeant qui vient de remplir correctement son dossier ne doit
-- jamais voir sa soumission rejetée parce qu'un registre externe, un GUC ou pg_net
-- lui-même est en panne. Double garde reprise ici :
--   (a) get_app_config renvoie NULL/'' quand la config n'est pas posée (env local/CI
--       non seedé, ou rotation de clé en cours) -- on saute alors le dispatch plutôt
--       que de heurter la contrainte NOT NULL de net.http_request_queue.url. Même
--       garde que trigger_matching_on_property_active (20260526180000 : « Defensive:
--       skip the dispatch if the config isn't set rather than blowing up the INSERT
--       with a NOT NULL on http_request_queue.url »).
--   (b) même configuré, tout l'appel est encapsulé dans un bloc exception -- pg_net
--       lui-même, un GUC manquant ou toute autre surprise ne remonte jamais plus haut
--       qu'un simple `raise warning` dans les logs Postgres, jamais une exception qui
--       annulerait la transaction (donc la soumission) déjà en cours.
--
-- ─── Le filet de rattrapage ─────────────────────────────────────────────────────────
--
-- `net.http_post` peut échouer SILENCIEUSEMENT du point de vue de l'appelant : la
-- requête part dans la file, un worker en tâche de fond la traite plus tard, et RIEN
-- ne relie cette RPC à l'issue de cet appel (elle ne lit jamais net._http_response).
-- Un redémarrage de la base entre l'insertion en file et son traitement, une Edge
-- Function qui timeout ou crashe avant d'écrire sa propre trace, ou simplement un
-- worker pg_net qui ne tourne pas — laissent un dossier définitivement à
-- verification_status='pending' sans que personne ne le sache. Un dispositif LAB ne
-- peut pas se permettre ce trou : d'où sweep_pending_agency_verifications ci-dessous,
-- un filet planifié (pg_cron) qui ramasse ce que le déclenchement primaire aurait pu
-- perdre. Ce dépôt connaît déjà ce motif : 20260714170000 (purge chat-staging) —
-- « un échec HTTP ponctuel est rattrapé la nuit suivante » ; 20260705180000
-- (whatsapp-morning-brief) — un tick FILET dédié à un tick primaire manqué.
--
-- Filet, pas urgence : aucun filet existant dans ce dépôt ne rattrape en quelques
-- minutes ce qu'il peut rattraper en une heure ou un jour (le tick filet
-- whatsapp-morning-brief attend une heure pleine ; purge-chat-staging, le lendemain).
-- Une vérification KYB en retard d'une heure ne coûte rien de plus qu'en retard de
-- cinq minutes — le dossier reste simplement en 'pending', visible et non trompeur.
-- Planifié toutes les heures : voir la section dédiée plus bas pour la grâce de 15
-- minutes (évite la course avec le déclenchement primaire) et le reste du
-- raisonnement.
--
-- Idempotente : CREATE OR REPLACE FUNCTION, REVOKE/GRANT rejouables, CREATE INDEX IF
-- NOT EXISTS, cron.unschedule tolérant puis cron.schedule (upsert par nom).

-- ─── (1) submit_agency_identity() : ajoute le déclenchement (étape 8) ──────────────
--
-- Corps intégralement repris de 20260728110000_submit_agency_identity_id_document.sql
-- (étapes 1 à 7 inchangées) — seules les deux nouvelles variables locales et l'étape 8
-- sont ajoutées, en toute fin de fonction, dans la branche de PREMIÈRE soumission
-- réelle uniquement (après le retour anticipé de l'étape 5 : un second appel, déjà
-- soumis, ne doit jamais redéclencher la vérification, pas plus qu'il ne re-timestampe
-- ou ne re-journalise).
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
  v_base_url         text;
  v_svc_key          text;
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
  -- l'appelant, la soumission a déjà réussi. Ce retour anticipé couvre aussi l'étape 8
  -- (déclenchement, tâche 4 ci-dessous) : un dossier déjà soumis ne redéclenche jamais
  -- la vérification à chaque rejeu de cette RPC.
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

  -- 8. Déclenchement de la vérification KYB (étape 4, tâche 4 — voir l'en-tête de ce
  -- fichier pour l'analyse complète : motif aligné sur les triggers matching-engine de
  -- la baseline et les crons de ce dépôt, jamais un troisième motif ; net.http_post met
  -- la requête en file, cette RPC ne l'attend jamais ; best-effort à deux niveaux, un
  -- échec ne doit jamais faire échouer la soumission déjà committée ci-dessus).
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
  'Le dirigeant déclare sa saisie d''identité KYB terminée (étape 2 onboarding). Vérifie la complétude (raison sociale, forme juridique, pays, signataire actif), pose agencies.identity_submitted_at, journalise dans activity_events (category=kyc), puis déclenche agency-verification-run (étape 4/tâche 4) via net.http_post best-effort (jamais bloquant, jamais susceptible de faire échouer la soumission — cf. en-tête de la migration 20260728150000). p_related_person_id (optionnel) : si fourni, pose aussi la ligne agency_person_verification_checks (check_type=id_document, source=manual, result=pending_manual_review) pour cette personne, APRÈS avoir vérifié (1) qu''elle appartient à l''agence de l''appelant et (2) qu''elle porte un rôle signatory ACTIF (valid_to nul ou futur) — 42501 avec un message distinct pour chaque cause sinon — y compris lors d''un appel ULTÉRIEUR à une première soumission sans argument (jamais neutralisé par le retour anticipé). Concurrence : verrou FOR UPDATE sur la ligne agencies. Idempotente : un second appel ne re-timestampe ni ne re-journalise jamais identity_submitted_at, ne repose jamais un second check id_document pour la même personne, et ne redéclenche jamais la vérification. Voir docs/agency-kyb-verification.md et docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-4.md (tâche 4).';

revoke all on function public.submit_agency_identity(uuid) from public, anon;
grant execute on function public.submit_agency_identity(uuid) to authenticated;

-- ─── (2) Filet de rattrapage : sweep_pending_agency_verifications() ────────────────
--
-- verification_status='pending' est le signal fiable de « jamais vérifié » : la
-- colonne vaut 'pending' par défaut (20260728101000) et le moteur
-- (recompute_agency_verification, 20260728130000) la fait TOUJOURS sortir de 'pending'
-- dès son premier passage — vers 'auto_validated' ou 'manual_review', jamais un retour
-- à 'pending' (vérifié en lisant tout le corps de la fonction : la seule affectation de
-- verification_status choisit entre ces deux valeurs, il n'existe aucune branche qui
-- réécrive 'pending'). Un dossier soumis (identity_submitted_at posé) mais encore
-- 'pending' longtemps après n'a donc, par construction, jamais été traité par le
-- moteur — que la cause soit un net.http_post jamais parti, un worker pg_net en panne,
-- ou une Edge Function qui a crashé avant d'écrire sa propre trace.
--
-- ─── Correctif revue (étape 4/tâche 4, point 1) : la boucle silencieuse ────────────
--
-- Tel quel, ce filet reprenait le MÊME dossier à chaque passage, indéfiniment, sans
-- compteur ni borne : si l'Edge Function ou pg_net tombe durablement, le dossier
-- reste 'pending' pour toujours, retenté toutes les heures, sans qu'aucun humain ne
-- le sache autrement qu'en lisant les journaux Postgres (le `raise warning`
-- ci-dessous). Angle mort réel pour un dispositif LAB : le dirigeant, lui, croit son
-- dossier en cours de traitement.
--
-- Remède : verification_sweep_attempts (colonne ajoutée ci-dessous) compte les
-- passages de CE filet pour un dossier donné — jamais le déclenchement primaire de
-- submit_agency_identity (étape 8 ci-dessus), qui n'incrémente pas cette colonne :
-- un dossier vérifié du premier coup (cas nominal) n'y touche jamais. Bornée à
-- v_max_attempts (5, soit jusqu'à 5 passages horaires en plus de la grâce de 15
-- minutes déjà en place — assez de marge pour qu'une panne TRANSITOIRE de
-- pg_net/Edge Function, ex. un redeploy, se résorbe seule sans solliciter un humain
-- à tort, mais borné pour qu'un dossier ne reste jamais indéfiniment invisible).
-- Même idiome que retry_count < 3 (claim_whatsapp_jobs, 20260602090000) : un
-- compteur seul ne suffit jamais, toujours une borne à côté.
--
-- Au-delà de la borne (la tentative qui porte le compteur à v_max_attempts part
-- encore, cf. plus bas -- mais aucune suivante ne part plus jamais), le dossier
-- bascule verification_status='manual_review' -- jamais un troisième statut. C'est
-- la file de revue humaine DÉJÀ établie (idx_agencies_verification_review,
-- 20260728101000, « File de revue manuelle (console admin.megga.ch) »), donc son
-- consommateur naturel : la file de l'étape 5 y trouvera ce dossier sans qu'il
-- faille rien construire de plus. recompute_agency_verification ne traite
-- 'manual_review' à aucun titre spécial (seuls 'rejected'/'validated' sont
-- terminaux pour lui — voir son étape 0) : si le dossier finit par se vérifier
-- malgré tout (la toute dernière tentative aboutit après coup), le moteur écrase
-- cette bascule provisoire par sa propre conclusion, sans qu'aucun état ne reste
-- durablement faux. Un activity_events dédié
-- (action=agency_verification_sweep_exhausted, category=kyc, actor_kind=system donc
-- actor_id NULL) explique la bascule pour qui relit le dossier -- distinct de
-- agency_verification_recomputed (le moteur), jamais confondu avec un verdict
-- humain ou automatique.
--
-- Défense en profondeur : le filtre de la requête ci-dessous exclut LUI-MÊME
-- verification_sweep_attempts >= v_max_attempts, indépendamment de la bascule
-- manual_review -- un dossier qui, par un chemin futur non prévu aujourd'hui,
-- redeviendrait 'pending' malgré un compteur déjà à la borne ne serait pas repris
-- pour autant.
alter table public.agencies
  add column if not exists verification_sweep_attempts smallint not null default 0;

comment on column public.agencies.verification_sweep_attempts is
  'Nombre de passages de sweep_pending_agency_verifications pour ce dossier -- jamais incrémentée par le déclenchement primaire (submit_agency_identity), qui reste hors de ce décompte. Reste à 0 dans le cas nominal (vérification qui aboutit avant le premier passage du filet). Bornée à 5 (v_max_attempts, voir sweep_pending_agency_verifications) : au-delà, verification_status bascule ''manual_review'' plutôt que d''être retenté indéfiniment.';

create or replace function public.sweep_pending_agency_verifications()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_base_url     text := public.get_app_config('supabase_url');
  v_svc_key      text := public.get_app_config('service_role_key');
  v_max_attempts constant smallint := 5;
  v_attempts     smallint;
  v_agency       record;
begin
  -- Même garde défensive que le déclenchement primaire ci-dessus : environnement non
  -- configuré (local/CI sans app_config seedé) -> no-op silencieux plutôt qu'une
  -- violation NOT NULL sur http_request_queue.url.
  if v_base_url is null or v_base_url = '' or v_svc_key is null or v_svc_key = '' then
    return;
  end if;

  -- Grâce de 15 minutes avant qu'un dossier soumis ne soit considéré « jamais
  -- vérifié » : même ordre de grandeur que le délai déjà retenu ailleurs dans ce dépôt
  -- pour un appel pg_net sans réponse (realadvisor_probe_pgnet.sql, « inflight
  -- orphelins (>15 min sans réponse pg_net) = timeout »). Sans cette grâce, ce filet
  -- courrait en concurrence avec le déclenchement primaire (étape 8 ci-dessus) et le
  -- redéclencherait inutilement pour un dossier dont la vérification est simplement
  -- en cours. LIMIT 25 par passage : borne défensive (même idiome que le LIMIT 200 de
  -- la purge chat-staging, 20260714170000) — un backlog plus large repart au passage
  -- suivant, une heure plus tard, jamais un souci en usage normal.
  --
  -- `verification_sweep_attempts < v_max_attempts` : voir l'en-tête de cette section
  -- pour le raisonnement complet (correctif revue étape 4/tâche 4, point 1) — un
  -- dossier qui a déjà épuisé sa borne ne doit plus jamais être repris, quel que soit
  -- son verification_status au moment de cette requête (défense en profondeur).
  for v_agency in
    select id
      from public.agencies
     where identity_submitted_at is not null
       and verification_status = 'pending'
       and identity_submitted_at < now() - interval '15 minutes'
       and verification_sweep_attempts < v_max_attempts
     order by identity_submitted_at
     limit 25
  loop
    -- Compte CETTE tentative avant de la lancer -- un compteur qui ne compterait
    -- qu'après coup manquerait précisément les tentatives qui échouent avant
    -- d'écrire quoi que ce soit, le cas même que ce correctif vise. UPDATE seul
    -- (jamais lu puis réécrit depuis PL/pgSQL) : atomique et correct sous
    -- concurrence (deux passages entrelacés de ce filet, cron + relance manuelle
    -- par exemple) -- chacun applique son propre +1 sur la valeur déjà committée
    -- par l'autre, jamais une mise à jour perdue.
    update public.agencies
       set verification_sweep_attempts = verification_sweep_attempts + 1
     where id = v_agency.id
    returning verification_sweep_attempts into v_attempts;

    if v_attempts >= v_max_attempts then
      -- Borne atteinte : cette tentative est la DERNIÈRE autorisée (elle part quand
      -- même juste après, best-effort -- rien n'empêche qu'elle réussisse). On rend
      -- DÈS MAINTENANT le dossier visible plutôt que d'attendre un hypothétique
      -- passage suivant : le filtre ci-dessus ne le ramassera de toute façon plus
      -- jamais. Garde `and verification_status = 'pending'` : ne jamais écraser un
      -- verdict que le moteur aurait posé entretemps (une tentative précédente qui
      -- aboutit pendant qu'on traite celle-ci).
      update public.agencies
         set verification_status = 'manual_review'
       where id = v_agency.id
         and verification_status = 'pending';

      insert into public.activity_events
        (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, metadata)
      values (
        v_agency.id, null, 'system', 'agency_verification_sweep_exhausted', 'agency', v_agency.id,
        'kyc', 'warn', jsonb_build_object('attempts', v_attempts, 'max_attempts', v_max_attempts)
      );
    end if;

    -- Best-effort PAR AGENCE : une source qui échoue pour l'une ne doit jamais
    -- empêcher les suivantes d'être ramassées dans la même passe.
    begin
      perform net.http_post(
        url := v_base_url || '/functions/v1/agency-verification-run',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_svc_key
        ),
        body := jsonb_build_object('agency_id', v_agency.id),
        timeout_milliseconds := 15000
      );
    exception when others then
      raise warning 'sweep_pending_agency_verifications: dispatch echoue pour %: %', v_agency.id, sqlerrm;
    end;
  end loop;
end;
$$;

comment on function public.sweep_pending_agency_verifications() is
  'Filet de rattrapage (étape 4, tâche 4) : ramasse les agences dont identity_submitted_at est posé depuis plus de 15 minutes mais dont verification_status vaut encore ''pending'' (jamais recalculé -- net.http_post est fire-and-forget, sans garantie de livraison ni de traitement par le worker pg_net) et relance agency-verification-run pour chacune (best-effort par agence, jamais bloquant). Correctif revue point 1 : chaque tentative incrémente verification_sweep_attempts, bornée à 5 -- au-delà, le dossier bascule verification_status=''manual_review'' (file de revue humaine déjà établie, idx_agencies_verification_review) et un activity_events (category=kyc, action=agency_verification_sweep_exhausted) explique pourquoi, plutôt que d''être retenté indéfiniment en silence. Plafonnée à 25 dossiers ÉLIGIBLES par passage (verification_sweep_attempts >= 5 exclu du filtre). Planifiée toutes les heures via cron.schedule si pg_cron est présent (absent en local/CI) -- aucune urgence à rattraper en quelques minutes ce qui peut l''être en une heure. service_role uniquement.';

revoke all on function public.sweep_pending_agency_verifications() from public, anon, authenticated;
grant execute on function public.sweep_pending_agency_verifications() to service_role;

-- Partial index couvrant le filtre du filet (règle perf CLAUDE.md §7 : toujours un
-- partial index pour un filtre fréquent) -- même patron que
-- idx_agencies_verification_review et idx_agencies_identity_never_submitted
-- (20260728107000) : la colonne qui varie (identity_submitted_at) porte l'index,
-- verification_status='pending' filtre dans le WHERE. La très grande majorité des
-- agences n'y figurera jamais (verification_status en sort dès le premier passage du
-- moteur).
create index if not exists idx_agencies_verification_sweep
  on public.agencies (identity_submitted_at)
  where identity_submitted_at is not null and verification_status = 'pending';

-- ─── (3) Planification du filet ─────────────────────────────────────────────────────
--
-- Gardé par la présence de pg_cron, comme tous les autres jobs de ce dépôt (absent en
-- local/CI -- schéma "cron" inexistant, cf. 20260625160000). Minute 25 : décalée des
-- jobs déjà connus (platform-metrics-hourly à :15) pour ne pas les faire concourir
-- pour les mêmes ressources au même instant -- sans que ça ait d'importance
-- fonctionnelle, les deux jobs sont indépendants.
do $$ begin perform cron.unschedule('agency-verification-sweep-hourly'); exception when others then null; end $$;
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('agency-verification-sweep-hourly', '25 * * * *',
      $cron$ select public.sweep_pending_agency_verifications(); $cron$);
  end if;
end $$;
