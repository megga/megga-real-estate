-- Revue du Lot 3 — les défauts DORMANTS du geste « relancer un cron ».
--
-- Aucun de ceux-ci ne peut se déclencher aujourd'hui : `admin_cron_run_now` n'a aucun
-- consommateur, donc aucun ponctuel n'a jamais existé. Ils se déclencheraient TOUS au
-- premier clic. On les corrige avant de câbler l'écran, pas après.

-- ── 1. La liste des inertes avait un FAUX NÉGATIF ──────────────────────────────
--
-- `purge-chat-staging-daily` était classé « n'envoie rien à personne ». Sa commande fait
-- un `net.http_delete` sur l'API Storage et supprime jusqu'à 200 objets — donc relancer
-- ce job SANS confirmation était possible.
--
-- ⚠ CE N'EST PAS UNE FAUTE DE FRAPPE, C'EST LE PRÉDICAT QUI EST FAUX. Celui écrit en tête
-- de 20260802010000 rate ce job DEUX fois :
--   · son filtre ne connaît que `net\.http_post` — pas `http_delete`, `http_get`, `http_put` ;
--   · `substring(command from 'public\.([a-z0-9_]+)\s*\(')` ne capture que la PREMIÈRE
--     fonction citée dans la commande. Ici c'est `public.get_app_config`, un lecteur de
--     configuration inoffensif, pendant que la charge utile est ailleurs.
--
-- Le prédicat CORRIGÉ, à rejouer avant de toucher à cette liste — il couvre tous les
-- verbes et regarde TOUTES les fonctions citées, pas seulement la première :
--
--     select j.jobname
--       from cron.job j
--      where j.command ~* 'net\.http_'                        -- appel direct, tout verbe
--         or exists (                                          -- ou via une fonction citée
--            select 1
--              from regexp_matches(j.command, 'public\.([a-z0-9_]+)\s*\(', 'g') m
--              join pg_proc p on p.proname = m[1]
--              join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
--             where position('net.http_' in p.prosrc) > 0);
--
-- Rejoué le 02.08.2026 sur les 21 noms : `purge-chat-staging-daily` est le seul à sortir.
create or replace function public.admin_cron_job_is_inert(p_jobname text)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select p_jobname in (
    -- Purges et rétention : suppriment des lignes, n'écrivent à personne.
    -- ⚠ `purge-chat-staging-daily` N'EST PAS ICI : malgré son nom, il sort du réseau.
    'activity-events-retention', 'admin-ai-drift-purge-monthly', 'admin-socle-purge-hourly',
    'cleanup-orphan-property-drafts', 'import-raw-text-purge-daily',
    'knowledge-snippets-expire-weekly', 'purge-stale-matches',
    'whatsapp-async-jobs-purge-daily', 'whatsapp-daily-briefs-purge',
    'whatsapp-purge-raw-daily', 'whatsapp-recent-auto-actions-purge',
    -- Recalculs et rafraîchissements : idempotents, aucun effet sortant.
    'cantonal-medians-refresh', 'market-rent-stats-refresh',
    'contact-score-nightly', 'property-score-nightly', 'agency-activation-nightly',
    -- Contrôles internes qui ne sortent PAS du réseau (prédicat corrigé ci-dessus rejoué).
    'admin-log-chain-verify-hourly',
    'realadvisor-probe-collect', 'realadvisor-probe-sweep', 'realadvisor-revive-collect'
  );
$$;

comment on function public.admin_cron_job_is_inert(text) is
  'Vrai si relancer ce cron n''envoie rien et ne sort pas du réseau. Liste FERMÉE et fail-closed : tout job absent exige une confirmation. ⚠ Le prédicat qui la fonde doit couvrir TOUS les verbes net.http_* et TOUTES les fonctions citées par la commande — la première version ne voyait que net.http_post et que la première fonction, ce qui a laissé passer purge-chat-staging-daily (net.http_delete sur 200 objets Storage).';

revoke all on function public.admin_cron_job_is_inert(text) from public, anon;
grant execute on function public.admin_cron_job_is_inert(text) to authenticated, service_role;

-- ── 2. Les ponctuels empoisonnaient l'alerting ─────────────────────────────────
--
-- `get_cron_health()` rendait TOUTES les lignes de `cron.job`, ponctuels compris. Or
-- `_shared/admin-alerts.ts` calcule `stale = !job.last_start` : entre `cron.schedule` et
-- le premier passage (60 à 120 s), un ponctuel a `last_start = null` et déclenche donc
-- « Cron … en retard — Dernier run : jamais » chez les super-admins. Pire, la clé de
-- déduplication est `cron:<jobname>` et le jobname contient l'epoch : elle est NEUVE à
-- chaque relance, donc le cooldown persisté dans `app_config.admin_alert_state` ne
-- l'étouffe jamais, et ce blob gagne une entrée définitive par relance alertée.
--
-- On filtre à la SOURCE plutôt que chez les deux appelants (`admin-alerts.ts` et
-- `useCronHealth`) : un ponctuel n'est pas un cron dont la santé veut dire quelque chose,
-- c'est l'artefact éphémère d'une relance manuelle. Son issue est journalisée au registre
-- par le balayeur, qui est l'endroit prévu pour la lire.
create or replace function public.get_cron_health()
returns table(jobname text, schedule text, active boolean, last_start timestamptz, last_status text)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
BEGIN
  -- Élargi (20260705160000) : l'alerting cron d'admin-monitoring lit la santé
  -- des jobs avec la service key.
  IF NOT (public.is_super_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT j.jobname::text, j.schedule::text, j.active,
           d.start_time, d.status::text
    FROM cron.job j
    LEFT JOIN LATERAL (
      SELECT r.start_time, r.status
      FROM cron.job_run_details r
      WHERE r.jobid = j.jobid
      ORDER BY r.start_time DESC
      LIMIT 1
    ) d ON true
    WHERE j.jobname !~ '^adhoc-\d+-'   -- passages ponctuels : éphémères, jamais « en retard »
    ORDER BY j.jobname;
END;
$$;

comment on function public.get_cron_health() is
  'Santé des crons PLANIFIÉS. Exclut les passages ponctuels `adhoc-<epoch>-<jobname>` : sans exécution pendant leurs 2 premières minutes, ils déclenchaient une fausse alerte « en retard » que le cooldown ne pouvait pas étouffer (leur nom, donc la clé de déduplication, change à chaque relance).';

-- ── 3. Le balayeur était tout-ou-rien ──────────────────────────────────────────
--
-- Sa boucle n'avait aucun bloc `exception` : une seule ligne empoisonnée avortait la
-- transaction entière et plus AUCUN ponctuel n'était retiré, à chaque passage, jusqu'à
-- intervention humaine. Deux causes réelles, pas hypothétiques :
--   · `split_part(jobname,'-',2)::bigint` — le motif `^adhoc-\d+-` garantit des chiffres,
--     PAS la plage de `bigint` : `adhoc-99999999999999999999-x` lève 22003 ;
--   · `admin_log_write` pose `set local lock_timeout = '3s'` et prend le verrou de chaîne :
--     55P03 sous contention d'`admin-log-chain-verify-hourly`.
--
-- ⚠ C'EST AUSSI LE SEUL REMPART CONTRE LA RÉCURRENCE ANNUELLE. L'expression d'un ponctuel
-- est `MI HH DD MM *` — cron n'a pas de champ année, donc « une seule fois » n'existe pas
-- dans l'objet planifié : elle vit ENTIÈREMENT ici. Un ponctuel resté en place repart à la
-- même date l'an prochain, y compris celui d'un cron SENSIBLE confirmé une seule fois.
-- D'où l'isolement par ligne : le retrait des autres ne doit dépendre d'aucune d'elles.
create or replace function public.admin_cron_adhoc_sweep()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_job     record;
  v_chiffres text;
  v_epoch   bigint;
  v_cible   text;
  v_statut  text;
  v_motif   text;
  v_fin     timestamptz;
  v_n       integer := 0;
  v_echecs  integer := 0;
begin
  if not public.pg_cron_installe() then
    return 0;   -- pg_cron absent (local/CI) : rien à balayer, et surtout rien à lever.
  end if;

  for v_job in select jobid, jobname from cron.job where jobname ~ '^adhoc-\d+-' loop
    begin
      -- Borné à 18 chiffres : `bigint` en accepte 19, et un nom forgé à la main pendant un
      -- incident ne doit pas pouvoir faire lever le cast.
      v_chiffres := substring(v_job.jobname from '^adhoc-(\d{1,18})-');
      if v_chiffres is null then
        v_echecs := v_echecs + 1;
        continue;   -- suite de chiffres hors plage : on laisse la ligne, on ne bloque pas
      end if;
      v_epoch := v_chiffres::bigint;

      if to_timestamp(v_epoch) >= now() - interval '15 minutes' then
        continue;  -- pas encore consommé : le worker peut être occupé
      end if;

      v_cible := substring(v_job.jobname from '^adhoc-\d+-(.*)$');
      -- `return_message` est le SEUL champ qui dise POURQUOI un passage a échoué, et la
      -- désinscription qui suit rend la ligne d'exécution définitivement inatteignable
      -- (get_admin_cron_runs joint cron.job en INTERNE). Le recopier ou le perdre.
      select d.status, d.end_time, d.return_message into v_statut, v_fin, v_motif
        from cron.job_run_details d
       where d.jobid = v_job.jobid
       order by d.start_time desc limit 1;

      perform public.admin_log_write(
        p_family => 'ops', p_action => 'cron_run_now_result',
        p_severity => case when v_statut = 'succeeded' then 'info' else 'warn' end,
        p_entity_type => 'cron_job', p_entity_label => coalesce(nullif(v_cible, ''), v_job.jobname),
        -- ⚠ Seul le SUCCÈS est routine. Un échec rangé en routine partait au pied replié de
        -- l'écran, dont le lecteur ne rend ni `metadata` ni `severity` : la relance ratée
        -- disparaissait pendant que « relance demandée » restait en vue.
        p_routine => (v_statut = 'succeeded'),
        p_metadata => jsonb_build_array(
          jsonb_build_object('l', 'Issue', 'v', coalesce(v_statut, 'aucune exécution')),
          jsonb_build_object('l', 'Terminé',
                             'v', coalesce(to_char(v_fin at time zone 'UTC', 'HH24:MI') || ' UTC', '—')),
          jsonb_build_object('l', 'Motif', 'v', coalesce(nullif(btrim(v_motif), ''), '—'))),
        -- La strate routine ne rend QUE `action_params` : sans ça, une ligne repliée n'a
        -- aucun contenu lisible.
        p_action_params => jsonb_build_object(
          'jobname', coalesce(nullif(v_cible, ''), v_job.jobname),
          'adhoc', v_job.jobname,
          'status', coalesce(v_statut, 'aucune exécution'),
          'return_message', v_motif));

      perform cron.unschedule(v_job.jobname);
      v_n := v_n + 1;
    exception when others then
      -- Une ligne empoisonnée ne doit pas empêcher le retrait des autres : c'est ce qui
      -- transformerait un incident local en relances annuelles silencieuses.
      v_echecs := v_echecs + 1;
    end;
  end loop;

  -- L'échec ne doit pas être muet : sans ça, un balayeur qui n'arrive plus à retirer une
  -- ligne rend simplement un compte plus petit, ce que personne ne regarde.
  if v_echecs > 0 then
    begin
      perform public.admin_log_write(
        p_family => 'ops', p_action => 'cron_adhoc_sweep_failed', p_severity => 'warn',
        p_entity_type => 'cron_job', p_entity_label => 'admin-adhoc-cron-sweep',
        p_metadata => jsonb_build_array(
          jsonb_build_object('l', 'Ponctuels non retirés', 'v', v_echecs::text),
          jsonb_build_object('l', 'Retirés', 'v', v_n::text)),
        p_action_params => jsonb_build_object('echecs', v_echecs, 'retires', v_n));
    exception when others then
      null;  -- le registre lui-même est en cause : le compte rendu reste la valeur de retour
    end;
  end if;

  return v_n;
end;
$$;

comment on function public.admin_cron_adhoc_sweep() is
  'Recopie l''issue de chaque passage ponctuel au registre PUIS le retire. La recopie n''est pas cosmétique : get_admin_cron_runs joint cron.job en INTERNE, donc désinscrire un ponctuel rendrait son exécution invisible pour toujours. Isolé par ligne : c''est le SEUL rempart contre la récurrence annuelle (cron n''a pas de champ année), donc une ligne fautive ne doit jamais bloquer le retrait des autres.';

revoke all on function public.admin_cron_adhoc_sweep() from public, anon, authenticated;

-- ── 4. Le rejeu rendait une enveloppe muette ───────────────────────────────────
--
-- `admin_receipt_try` ne fait clé que sur `idempotency_key` : ni la RPC ni le job visé ne
-- sont comparés (vérifié en base : `on conflict (idempotency_key) do nothing`). Une clé
-- déjà consommée pour un AUTRE cron rendait donc `{ok:true, already_done:true}` — un
-- succès affiché pour une relance qui n'a pas eu lieu, et rien dans la réponse ne
-- permettait de s'en apercevoir.
--
-- ⚠ Le correctif de fond — clé portant (clé, rpc) — touche une primitive partagée par tous
-- les gestes des lots 1 et 2 : c'est un changement transverse, pas un correctif local. Ici
-- on rend le décalage DÉTECTABLE, ce qui est la moitié qui coûte une ligne. `scheduled_for`
-- reste irrécupérable par construction : le reçu ne garde qu'un sha256, pas un cache.
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

  if not public.pg_cron_installe() then
    return public.admin_error('precondition_failed',
      'pg_cron n''est pas installé sur cette base : la relance n''est possible qu''en production.');
  end if;

  perform public.admin_lock_entity('cron_job', md5(p_jobname)::uuid);

  -- ⚠ TOUS LES CONTRÔLES PRÉCÈDENT LA RÉSERVATION DE LA CLÉ. Un `return admin_error`
  -- COMMITTE la transaction : réserver avant, c'est laisser un refus métier consommer la
  -- clé, et le réessai — même corrigé — rendre un faux « already_done » sans rien faire.
  -- Défaut réel du Lot 1 (#1049). La porte qui le surveille est STATIQUE et coupe le corps
  -- à la première occurrence du nom de la primitive de réservation : ce commentaire évite
  -- donc de l'écrire, sinon il ferait rougir une implémentation correcte.
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
    return public.admin_error('precondition_failed',
      'Ce cron peut envoyer des messages à des clients ou des agents : confirmez la relance.',
      jsonb_build_object('needs_confirm', true, 'jobname', p_jobname));
  end if;

  if not public.admin_receipt_try(p_idempotency_key, 'admin_cron_run_now') then
    -- `jobname` DANS le rejeu : c'est ce qui permet à l'appelant de voir que la clé a servi
    -- pour un autre cron, au lieu d'afficher un succès pour une relance fantôme.
    return public.admin_ok(jsonb_build_object('already_done', true, 'jobname', p_jobname));
  end if;

  v_quand := date_trunc('minute', now()) + interval '2 minutes';
  v_quand_s := to_char(v_quand at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_adhoc   := 'adhoc-' || extract(epoch from v_quand)::bigint || '-' || p_jobname;
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

  return public.admin_ok(jsonb_build_object(
    'requested', true, 'scheduled_for', v_quand_s, 'jobname', p_jobname));
end;
$$;

revoke all on function public.admin_cron_run_now(text, text, boolean) from public, anon;
grant execute on function public.admin_cron_run_now(text, text, boolean) to authenticated, service_role;
