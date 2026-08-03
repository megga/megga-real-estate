-- Étape 28 du Lot 3 — le geste d'exploitation « relancer un cron maintenant ».
--
-- POURQUOI CE GESTE EXISTE ALORS QUE LES TROIS AUTRES DE §5.8 SONT MURÉS.
-- `function_replay` n'a rien à rejouer (aucune trace d'invocation d'edge function),
-- `wa_deadletter_replay` n'a pas de bouton dans la maquette, `calendar_resync` n'a pas
-- de destinataire défini. `cron_run_now`, lui, a TOUT : mesuré le 01.08.2026, 46 jobs
-- actifs dans `cron.job` et 206 030 exécutions tracées dans `cron.job_run_details`.
-- L'asymétrie est la clé : les crons ont la trace qui manque aux edge functions.
--
-- POURQUOI ON PROGRAMME UN JOB PONCTUEL AU LIEU D'EXÉCUTER LA COMMANDE EN LIGNE.
-- Trois mesures l'imposent, et aucune n'était dans le plan :
--   1. Deux jobs sont des `REFRESH MATERIALIZED VIEW CONCURRENTLY`
--      (cantonal-medians-refresh, market-rent-stats-refresh). CONCURRENTLY est interdit
--      dans une transaction, et un corps plpgsql en est une : ces deux-là ne peuvent
--      PAS être exécutés depuis une RPC, jamais.
--   2. `market-rent-stats-refresh` dure 10,7 s en moyenne (44 exécutions relues, 0 échec)
--      alors que `authenticated` porte `statement_timeout = 8s`.
--   3. Un job ponctuel laisse une trace dans `cron.job_run_details`, avec son propre
--      statut. Rejouer un `net.http_post` en ligne n'en laisse aucune — et « succeeded »
--      n'y prouve que l'ENFILAGE de la requête, jamais son départ (incident du
--      29-30 juillet, nœud `megga/pgnet-request-loss`).
--
-- POURQUOI « RELANCE DEMANDÉE » ET NON « RELANCÉ ». La granularité de pg_cron est la
-- MINUTE : le ponctuel part au prochain tour d'horloge, pas à l'instant du clic. Le
-- libellé de la maquette — « Relance demandée — prochain passage 15:12 » — est donc
-- littéralement exact, et c'est le mot « replay » du plan qui était faux.

-- ── Le verrou, sans surcharge ──────────────────────────────────────────────────
--
-- `admin_lock_entity(text, uuid)` exige un uuid, ce qu'un jobname n'a pas — le chantier
-- avait rangé ça parmi les murs. C'en est un faux : le corps de la fonction fait
-- `hashtext(p_entity_id::text)`, l'uuid est reconverti en texte à la ligne suivante, et
-- `md5(jobname)::uuid` est stable (mesuré). On dérive donc, et le verrou reste unique.
--
-- ⛔ UNE SURCHARGE `(text, text)` A ÉTÉ ESSAYÉE PUIS RETIRÉE. Elle était plus élégante et
-- elle a cassé la CI : `PGRST203`. Les six appelants SQL passent tous une variable typée,
-- donc la résolution restait non ambiguë EN SQL — mais PostgREST envoie du JSON SANS
-- types, si bien que TOUT appel REST à une fonction surchargée devient ambigu. La spec du
-- socle appelle justement `admin_lock_entity` par REST, et ses deux tests sont tombés.
-- Leçon : vérifier les appelants SQL ne suffit pas ; le chemin PostgREST est un appelant
-- à part entière, et il n'a pas les mêmes règles de résolution.

-- ── Quels jobs partent sans confirmation ───────────────────────────────────────
--
-- ⚠ RÈGLE FERMÉE ET FAIL-CLOSED : tout job ABSENT de cette liste exige une confirmation.
-- On ne classe pas « sensible » par détection, on classe « inerte » par preuve — parce
-- que la détection se trompe dans la mauvaise direction. Mesuré : un grep sur
-- `graph.facebook.com` déclarait `whatsapp-morning-brief` inoffensif alors qu'il envoie,
-- via une abstraction de provider. Un faux négatif coûte un message parti chez un vrai
-- client ; un faux positif coûte un clic.
--
-- ⚠ ET LA PREUVE A ÉTÉ REFAITE, parce que la première version de cette liste était FAUSSE.
-- Le prédicat qui la fonde, à rejouer avant d'ajouter le moindre nom :
--
--     select j.jobname, substring(j.command from 'public\.([a-z0-9_]+)\s*\(') as fn
--       from cron.job j where j.command !~* 'net\.http_post'
--     -- puis, pour chaque fn : position('net.http_' in prosrc) > 0  ⇒ SORT DU RÉSEAU
--
-- Il a rendu cinq jobs sortants parmi les non-http_post : agency-verification-sweep-hourly,
-- weekly-digest-friday, et surtout realadvisor-health-daily, realadvisor-probe-fire et
-- realadvisor-revive-fire — que la première rédaction rangeait sous « contrôles internes,
-- n'envoient rien ». `realadvisor_health_check()` poste vers `/functions/v1/send-email`
-- dès qu'il compte une anomalie (12 passages en `alert` sur 30 jours), avec le kill-switch
-- ouvert : relancer ce contrôle pendant l'incident qui donne envie de le relancer
-- ré-émettrait l'alerte.
--
-- ⚠ OBJECTION EXAMINÉE ET ÉCARTÉE, pour qu'elle ne soit pas re-litigée : aujourd'hui cet
-- e-mail N'ARRIVE PAS. Le template `realadvisor_health_alert` n'est pas dans
-- `PUBLIC_TEMPLATES` de l'edge `send-email`, donc `requireAgentAuth` s'exécute, et
-- l'en-tête porte `app_config.service_role_key` — une clé `sb_secret_…` de 41 caractères,
-- pas un JWT : la garde refuse. Le canal est donc mort. Ce n'est PAS une raison de classer
-- le job inerte : la sûreté dépendrait d'une panne que personne ne maintient, et le jour
-- où quelqu'un répare l'envoi, la classification deviendrait fausse en silence. On classe
-- sur ce que la commande FAIT, pas sur ce qui l'empêche d'aboutir.
--
-- Les deux `*-fire` ne parlent, eux, à aucun humain : ils sondent l'API RealAdvisor. Ils
-- restent hors de la liste parce qu'une relance manuelle y consomme un quota tiers — le
-- clic de confirmation est le bon prix pour ça.
--
-- Les `*-collect` restent inertes : eux ne font que ramasser des réponses déjà arrivées.
create or replace function public.admin_cron_job_is_inert(p_jobname text)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select p_jobname in (
    -- Purges et rétention : suppriment des lignes, n'écrivent à personne.
    'activity-events-retention', 'admin-ai-drift-purge-monthly', 'admin-socle-purge-hourly',
    'cleanup-orphan-property-drafts', 'import-raw-text-purge-daily',
    'knowledge-snippets-expire-weekly', 'purge-chat-staging-daily', 'purge-stale-matches',
    'whatsapp-async-jobs-purge-daily', 'whatsapp-daily-briefs-purge',
    'whatsapp-purge-raw-daily', 'whatsapp-recent-auto-actions-purge',
    -- Recalculs et rafraîchissements : idempotents, aucun effet sortant.
    'cantonal-medians-refresh', 'market-rent-stats-refresh',
    'contact-score-nightly', 'property-score-nightly', 'agency-activation-nightly',
    -- Contrôles internes qui ne sortent PAS du réseau (prédicat ci-dessus rejoué).
    'admin-log-chain-verify-hourly',
    'realadvisor-probe-collect', 'realadvisor-probe-sweep', 'realadvisor-revive-collect'
  );
$$;

comment on function public.admin_cron_job_is_inert(text) is
  'Vrai si relancer ce cron n''envoie rien à personne. Liste FERMÉE et fail-closed : tout job absent exige une confirmation. Fondée sur un prédicat mesuré (aucun net.http_* dans la fonction appelée), pas sur une intuition.';

revoke all on function public.admin_cron_job_is_inert(text) from public, anon;
grant execute on function public.admin_cron_job_is_inert(text) to authenticated, service_role;

-- ── Le geste ───────────────────────────────────────────────────────────────────

create or replace function public.admin_cron_run_now(
  p_jobname         text,
  p_idempotency_key text,
  p_confirm         boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_command  text;
  v_active   boolean;
  v_inert    boolean;
  v_quand    timestamptz;
  v_quand_s  text;
  v_adhoc    text;
  v_cron     text;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  if coalesce(btrim(p_jobname), '') = '' then
    return public.admin_error('precondition_failed', 'Nom du cron manquant.');
  end if;
  if coalesce(btrim(p_idempotency_key), '') = '' then
    return public.admin_error('precondition_failed', 'Clé d''idempotence manquante.');
  end if;

  -- pg_cron n'est PAS installé en local ni en CI (il exige shared_preload_libraries, on
  -- ne peut donc pas l'y créer). Toucher `cron.job` sans cette garde lève 42P01 et fait
  -- échouer la suite entière. Le dépôt a déjà l'idiome, sur les migrations comme sur
  -- `get_cron_health` : tester la présence du schéma, puis dégrader.
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    return public.admin_error('precondition_failed',
      'pg_cron n''est pas installé sur cette base : la relance n''est possible qu''en production.');
  end if;

  -- Verrou d'entité AVANT toute lecture d'état (§10.2, amendé : verrou d'entité puis
  -- verrou de chaîne — l'ordre inverse provoquait un interblocage 40P01).
  -- uuid dérivé du nom : la primitive n'accepte que ce type, et le hachage est stable.
  perform public.admin_lock_entity('cron_job', md5(p_jobname)::uuid);

  -- ⚠ TOUS LES CONTRÔLES PRÉCÈDENT LA RÉSERVATION DE LA CLÉ. Un `return admin_error`
  -- COMMITTE la transaction : si la clé était prise avant, un refus métier la
  -- consommerait, et le réessai — même corrigé — rendrait un faux « already_done » sans
  -- rien faire. Défaut réel du Lot 1 (#1049), et la porte qui le surveille est STATIQUE :
  -- elle coupe le corps à la première occurrence du nom de la primitive de réservation.
  -- Ce commentaire évite donc d'écrire ce nom ici — sinon il ferait rougir la porte sur
  -- une implémentation pourtant correcte. C'est le piège n°10 du §6, et il se déclenche
  -- au moment du correctif.
  select j.command, j.active into v_command, v_active
    from cron.job j where j.jobname = p_jobname;

  if v_command is null then
    return public.admin_error('not_found', 'Ce cron n''existe pas.');
  end if;
  if not v_active then
    return public.admin_error('precondition_failed',
      'Ce cron est désactivé : le réactiver est un geste distinct.');
  end if;

  v_inert := public.admin_cron_job_is_inert(p_jobname);
  if not v_inert and not coalesce(p_confirm, false) then
    -- Le mur est ICI, en base, pas seulement dans la modale : une confirmation qui ne
    -- vit que dans l'écran se contourne par un appel direct à la RPC.
    return public.admin_error('precondition_failed',
      'Ce cron peut envoyer des messages à des clients ou des agents : confirmez la relance.',
      jsonb_build_object('needs_confirm', true, 'jobname', p_jobname));
  end if;

  if not public.admin_receipt_try(p_idempotency_key, 'admin_cron_run_now') then
    return public.admin_ok(jsonb_build_object('already_done', true));
  end if;

  -- Prochain tour d'horloge, avec une minute de marge : programmer la minute COURANTE
  -- perdrait la relance si la seconde est déjà passée, et le geste mentirait.
  v_quand := date_trunc('minute', now()) + interval '2 minutes';

  -- ⚠ TOUT CE QUI EST SCELLÉ, JOURNALISÉ OU AFFICHÉ SE FORMATE EN UTC EXPLICITE. Un
  -- `timestamptz` NU dans du jsonb se sérialise selon le GUC `TimeZone` de la session :
  -- `admin_receipt_seal` en fait un sha256, donc deux appelants produisant le MÊME effet
  -- scelleraient deux empreintes différentes. C'est le défaut corrigé par #1054 sur le
  -- registre (« 84c3ff3e… en UTC contre c01b7b0d… en Europe/Zurich ») ; il se réintroduit
  -- silencieusement, et une base de recette en UTC ne peut pas le voir.
  v_quand_s := to_char(v_quand at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_adhoc   := 'adhoc-' || extract(epoch from v_quand)::bigint || '-' || p_jobname;

  -- Modificateurs `FM` : sans eux `to_char` rend « 05 09 05 08 », et les 46 planifications
  -- déjà en production s'écrivent TOUTES sans zéro de tête (« 30 5 * * * »). On s'aligne
  -- sur la forme établie plutôt que de parier sur la tolérance du parseur — une expression
  -- refusée ferait échouer la relance en silence, ce que l'écran annoncerait comme demandée.
  v_cron := to_char(v_quand at time zone 'UTC', 'FMMI FMHH24 FMDD FMMM') || ' *';

  perform cron.schedule(v_adhoc, v_cron, v_command);
  perform public.admin_receipt_seal(p_idempotency_key,
    jsonb_build_object('scheduled_for', v_quand_s, 'adhoc', v_adhoc));

  perform public.admin_log_write(
    p_family => 'ops', p_action => 'cron_run_now', p_severity => 'warn',
    p_entity_type => 'cron_job', p_entity_label => p_jobname,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Prochain passage',
                         'v', to_char(v_quand at time zone 'UTC', 'HH24:MI') || ' UTC'),
      jsonb_build_object('l', 'Envoi possible', 'v', case when v_inert then 'non' else 'OUI' end)),
    p_action_params => jsonb_build_object('jobname', p_jobname, 'adhoc', v_adhoc));

  -- « demandée », jamais « effectuée » : à cette seconde le job n'a pas encore tourné, et
  -- pour les 14 crons qui délèguent à `net.http_post`, même son succès ne prouverait que
  -- l'enfilage de la requête.
  return public.admin_ok(jsonb_build_object(
    'requested', true, 'scheduled_for', v_quand_s, 'jobname', p_jobname));
end;
$$;

comment on function public.admin_cron_run_now(text, text, boolean) is
  'Étape 28 §5.8 — programme un passage ponctuel du cron nommé (pg_cron, granularité minute). Ne l''exécute PAS en ligne : deux jobs sont des REFRESH CONCURRENTLY et un dure 10,7 s contre 8 s de statement_timeout.';

revoke all on function public.admin_cron_run_now(text, text, boolean) from public, anon;
grant execute on function public.admin_cron_run_now(text, text, boolean) to authenticated, service_role;

-- ── Le balayeur des ponctuels ──────────────────────────────────────────────────
--
-- Un ponctuel ne se retire pas tout seul : lui faire appeler `cron.unschedule` en tête de
-- sa propre commande le ferait annuler par le ROLLBACK de sa propre erreur, et casserait
-- les deux REFRESH (CONCURRENTLY refuse de partager une transaction).
--
-- ⚠ ET IL RECOPIE L'ISSUE AVANT DE RETIRER LE JOB. Sans ça, tout le design se mentait à
-- lui-même : `get_admin_cron_runs` fait `cron.job_run_details JOIN cron.job USING (jobid)`,
-- une jointure INTERNE. Retirer le ponctuel rend sa ligne d'exécution invisible à la
-- console — définitivement (14 347 lignes déjà orphelines en production le prouvent). La
-- « vraie trace » promise en tête de fichier n'aurait donc jamais atteint un écran.
create or replace function public.admin_cron_adhoc_sweep()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_job    record;
  v_epoch  bigint;
  v_cible  text;
  v_statut text;
  v_fin    timestamptz;
  v_n      integer := 0;
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    return 0;   -- pg_cron absent (local/CI) : rien à balayer, et surtout rien à lever.
  end if;

  -- Le filtre porte le format DANS la clause : un job nommé à la main « adhoc-manuel »
  -- pendant un incident ferait lever le cast et le balayage entier s'arrêterait, laissant
  -- en place des ponctuels de crons SENSIBLES — ceux qu'on a confirmés à la main.
  for v_job in select jobid, jobname from cron.job where jobname ~ '^adhoc-\d+-' loop
    v_epoch := split_part(v_job.jobname, '-', 2)::bigint;
    if to_timestamp(v_epoch) >= now() - interval '15 minutes' then
      continue;  -- pas encore consommé : le worker peut être occupé
    end if;

    -- Le vrai jobname est tout ce qui suit le deuxième tiret (les jobnames en contiennent).
    v_cible := substring(v_job.jobname from '^adhoc-\d+-(.*)$');
    select d.status, d.end_time into v_statut, v_fin
      from cron.job_run_details d
     where d.jobid = v_job.jobid
     order by d.start_time desc limit 1;

    perform public.admin_log_write(
      p_family => 'ops', p_action => 'cron_run_now_result',
      p_severity => case when coalesce(v_statut, 'inconnu') = 'succeeded' then 'info' else 'warn' end,
      p_entity_type => 'cron_job', p_entity_label => coalesce(v_cible, v_job.jobname),
      p_routine => true,
      p_metadata => jsonb_build_array(
        jsonb_build_object('l', 'Issue', 'v', coalesce(v_statut, 'aucune exécution')),
        jsonb_build_object('l', 'Terminé',
                           'v', coalesce(to_char(v_fin at time zone 'UTC', 'HH24:MI') || ' UTC', '—'))));

    perform cron.unschedule(v_job.jobname);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

comment on function public.admin_cron_adhoc_sweep() is
  'Recopie l''issue de chaque passage ponctuel au registre (famille ops, routine) PUIS le retire. La recopie n''est pas cosmétique : get_admin_cron_runs joint cron.job en INTERNE, donc désinscrire un ponctuel rendrait son exécution invisible pour toujours.';

revoke all on function public.admin_cron_adhoc_sweep() from public, anon, authenticated;

-- ⚠ Planification GARDÉE par la présence du schéma `cron` : pg_cron exige
-- shared_preload_libraries, il est donc absent en local et en CI, où `cron.job` n'existe
-- pas du tout. Sans cette garde, la migration lève 42P01 et fait échouer `supabase start`,
-- donc TOUTE la suite backend et l'E2E — avant qu'un seul test ait tourné. C'est l'idiome
-- déjà employé par une dizaine de migrations du dépôt.
do $do$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    -- Rejeu le jour même : deploy.yml ré-applique toute migration dont le stamp est
    -- >= TODAY, donc l'unschedule doit tolérer un job absent. On teste l'existence plutôt
    -- que d'avaler l'exception : un `when others then null` masquerait aussi un refus de
    -- droits, et le balayeur ne serait jamais planifié sans que rien ne le dise.
    if exists (select 1 from cron.job where jobname = 'admin-adhoc-cron-sweep') then
      perform cron.unschedule('admin-adhoc-cron-sweep');
    end if;
    perform cron.schedule('admin-adhoc-cron-sweep', '*/10 * * * *',
                          $cron$ select public.admin_cron_adhoc_sweep(); $cron$);
  else
    raise notice 'pg_cron absent (local/CI) — admin-adhoc-cron-sweep non planifié';
  end if;
end
$do$;
