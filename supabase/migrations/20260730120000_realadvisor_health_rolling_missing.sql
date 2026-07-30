-- realadvisor_health_check : surveille enfin le rolling crawl.
--   · `realadvisor-rolling-daily` entre dans la liste des crons surveillés (règle cron_inactive).
--   · Nouvelle règle I (`rolling_stopped`) : aucun run `cron-rolling` sur 26h.
--
-- L'INCIDENT QUI LA MOTIVE (nuit du 29 au 30/07/2026)
-- -----------------------------------------------------------------------------
-- Le rolling du 29/07 22:00 n'a produit AUCUNE ligne dans realadvisor_sync_runs,
-- et aucune annonce n'a été touchée : `market_listings.updated_at` reste collé à
-- la ligne de base de la sonde horaire (~1 420/h) sur les huit heures autour de
-- 22:00, là où la nuit précédente laissait une signature de 23 461 lignes. Zéro
-- création sur 24h, alors que le sweep retirait 1 075 biens la même nuit.
--
-- Le diagnostic a écarté une à une toutes les causes documentées : le cron avait
-- bien tiré (`cron.job_run_details` = succeeded), `realadvisor_rolling_enabled`
-- valait 'true', le bucket du jour contenait 8 cantons (index 2), aucune ligne
-- 'running' ne tenait le verrou, la file pg_net était vide. Rejoué à la main le
-- 30/07 sur un canton témoin, le chemin complet a fonctionné des deux bouts —
-- appel HTTP direct ET `net.http_post` monté comme le cron : 202 en moins d'une
-- seconde, ligne de run créée, 42 vues / 42 écrites. L'échec était transitoire,
-- vraisemblablement une requête pg_net mise en file puis jamais émise.
--
-- CE QUI REND CE MODE DE PANNE INVISIBLE
-- -----------------------------------------------------------------------------
-- Rien ne le journalise. Côté fonction, les quatre sorties précoces de
-- runBackground() (kill-switch, cantons vide, verrou pris, verrou non acquis)
-- font un `return` sec AVANT la création de la ligne de run, et le `catch` du
-- bloc appelle finalizeRun(runId=undefined) qui commence par `if (!runId)
-- return`. Côté transport, une requête perdue par pg_net ne laisse ni réponse ni
-- entrée de file. Dans les deux familles de panne, la base ne garde aucune trace
-- et le seul `console.warn` s'efface avec la rétention des logs edge.
--
-- La conséquence n'est pas théorique : le cron avait déjà été retiré le 21/06
-- (migration 20260621140000) et son absence a passé un mois inaperçue, jusqu'à ce
-- que le vivier se mette à décroître. La règle ci-dessous attrape les deux
-- familles d'un coup — cron supprimé/désactivé par cron_inactive, cron muet par
-- rolling_stopped — sans rien changer à la fonction edge.
--
-- POURQUOI 26 HEURES
-- -----------------------------------------------------------------------------
-- Même fenêtre que les règles F et G du revive. Le rolling tourne à 22:00, le
-- health check à 09:00 : 11h d'écart, donc une nuit manquée est détectée le
-- lendemain matin et deux nuits consécutives (35h) ne peuvent pas se glisser
-- dessous. Sur cet incident, l'alerte serait partie le 30/07 à 09:00.
--
-- ⚠ La fenêtre porte sur `coalesce(ended_at, started_at)`, pas sur `ended_at`
-- seul comme les règles F et G. Un run de rolling vit 30 à 40 minutes et peut
-- déborder bien plus (celui du 28/07 a tenu ~3h) : tant qu'il tourne, `ended_at`
-- est NULL et un test sur cette seule colonne compterait zéro — l'alerte
-- partirait sur un crawl en pleine santé. Le revive, lui, finit en une passe et
-- n'a pas ce risque.
--
-- ⚠ Seul `trigger_source = 'cron-rolling'` compte. Un rattrapage manuel
-- (`manual-*`) ingère les mêmes biens mais ne prouve PAS que le cron fonctionne,
-- et le compter masquerait précisément la panne qu'on surveille.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS
-- -----------------------------------------------------------------------------
-- Elle n'alerte pas sur un rolling qui tourne et ÉCHOUE (`failed`, `throttled`).
-- Ce cas-là écrit déjà sa ligne de run — il est visible dans le journal et dans
-- le rapport quotidien, contrairement au silence total traité ici. Une règle sur
-- le modèle de F (liste blanche de statuts sains) le couvrirait ; elle demande de
-- décider du sort de `partial`, qui est un statut normal en mode chunk, et ça se
-- tranche sur des mesures qu'on n'a pas encore.

create or replace function public.realadvisor_health_check()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_alerts  text[] := array[]::text[];
  v_lines   text[] := array[]::text[];
  v_missing text[] := array[]::text[];
  v_n int; v_email text; v_subject text; v_body text; r record;
  v_due text; v_last_status text;
  v_seen int; v_revived int; v_rate numeric;
begin
  if public.get_app_config('realadvisor_alert_enabled') = 'false' then
    return jsonb_build_object('status', 'disabled');
  end if;

  -- A) Capping persistant : >=3 sweeps 'capped' sur 74h.
  select count(*) into v_n from realadvisor_sync_runs
  where trigger_source='cron-probe-sweep' and status='capped' and ended_at > now()-interval '74 hours';
  if v_n >= 3 then
    v_alerts := array_append(v_alerts, 'sweep_capped_persistent');
    v_lines := array_append(v_lines, '⚠️ Sweep plafonné (capped) ' || v_n || '× sur 74h : l''inflow d''absents confirmés dépasse durablement le plafond nocturne. Cause probable = vague de churn RealAdvisor OU faux absents (IP pg_net re-flaggée) — re-passer le gate empirique (id_in sur un échantillon) avant de laisser drainer.');
  end if;

  select count(*) into v_n from realadvisor_sync_runs
  where trigger_source='cron-fresh' and status='completed' and ended_at > now()-interval '28 hours';
  if v_n = 0 then
    v_alerts := array_append(v_alerts, 'fresh_stalled');
    v_lines := array_append(v_lines, '🛑 Ingestion « fresh » : aucun run complété depuis >28h — l''ajout des nouveaux biens achat est à l''arrêt.');
  end if;

  select count(*) into v_n from realadvisor_sync_runs
  where trigger_source='cron-probe' and ended_at > now()-interval '3 hours';
  if v_n = 0 then
    v_alerts := array_append(v_alerts, 'probe_stopped');
    v_lines := array_append(v_lines, '🛑 Probe : aucun cycle depuis >3h — le pipeline probe-fire/probe-collect ne tourne plus.');
  end if;

  select count(*) into v_n from (
    select status from realadvisor_sync_runs where trigger_source='cron-probe' order by ended_at desc nulls last limit 6
  ) t where status='throttled';
  if v_n >= 6 then
    v_alerts := array_append(v_alerts, 'probe_throttled');
    v_lines := array_append(v_lines, '⚠️ Probe throttlé : les 6 derniers cycles sont 100% ambigus (ok=0). IP pg_net probablement flaggée → détection en pause (aucune fausse écriture).');
  end if;

  -- La règle cron_inactive ne s'évalue que si pg_cron est installé. Sans le garde,
  -- `cron.job` est résolu à l'exécution et la fonction ENTIÈRE lève « relation
  -- "cron.job" does not exist » sur toute base qui n'a pas l'extension — c'est le
  -- cas de la base de CI, et de toute reconstruction d'environnement. Le health
  -- check devenait alors inappelable, donc intestable, au lieu de dégrader.
  -- Même motif que get_cron_health(), qui se garde déjà ainsi.
  -- En prod le schéma existe : comportement inchangé.
  --
  -- `realadvisor-rolling-daily` ajouté le 30/07/2026 : il alimente le vivier (un
  -- bucket de cantons par nuit, rotation à 3 jours) et il manquait à cette liste,
  -- alors même qu'il avait déjà été supprimé une fois — le 21/06, sans que rien
  -- ne le signale pendant un mois.
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    for r in
      select v.jobname from (values ('realadvisor-fresh-daily'),('realadvisor-probe-fire'),('realadvisor-probe-collect'),('realadvisor-probe-sweep'),('realadvisor-revive-fire'),('realadvisor-revive-collect'),('realadvisor-rolling-daily')) as v(jobname)
      where not exists (select 1 from cron.job j where j.jobname = v.jobname and j.active)
    loop
      v_missing := array_append(v_missing, r.jobname);
    end loop;
    if coalesce(array_length(v_missing,1),0) > 0 then
      v_alerts := array_append(v_alerts, 'cron_inactive');
      v_lines := array_append(v_lines, '🛑 Cron(s) RealAdvisor désactivé(s)/absent(s) : ' || array_to_string(v_missing, ', ') || '.');
    end if;
  end if;

  -- NOUVEAU (#901 bis) — F) Revive en échec : le cron a tourné mais la nuit n'a
  -- rien produit de sain. LISTE BLANCHE des états sains, PAS liste noire d'un
  -- seul état. La v1 de cette règle filtrait `status='stalled'` et laissait donc
  -- passer en silence TOTAL une nuit entièrement throttlée : 'throttled' n'est pas
  -- 'stalled' (règle F muette) et la ligne existe quand même (règle G muette
  -- aussi, elle compte toutes les lignes cron-revive). Le comble : le message
  -- invitait à vérifier un throttle RealAdvisor, cause que la règle ne pouvait
  -- structurellement pas détecter. Le throttle n'a rien d'hypothétique sur cet
  -- endpoint — 25 cycles cron-probe 'throttled' les 21-22/06, même IP pg_net.
  -- La liste blanche couvre en prime tout statut ajouté plus tard.
  --
  -- L'alerte dépend du STATUT, jamais du parsing : `due=` n'est que de
  -- l'habillage. Conditionner le déclenchement à la regex ferait mourir l'alerte
  -- en silence le jour où le format du message change — le travers même que ce
  -- chantier corrige. D'où le coalesce à '?'.
  --
  -- array_agg(... order by ended_at desc)[1] et non max() : max() sur du texte est
  -- un maximum de COLLATION, pas chronologique — 'due=9' l'emporterait sur
  -- 'due=1200'. Inatteignable sur le chemin automatique (une seule ligne dans la
  -- fenêtre), mais un rejeu manuel du collect en met deux, et le tri correct est
  -- gratuit ici.
  select count(*),
         coalesce(substring((array_agg(error_message order by ended_at desc))[1] from 'due=([0-9]+)'), '?'),
         coalesce((array_agg(status order by ended_at desc))[1], '?')
  into v_n, v_due, v_last_status
  from realadvisor_sync_runs
  where trigger_source='cron-revive'
    and status not in ('completed','idle','paused')
    and ended_at > now()-interval '26 hours';
  if v_n > 0 then
    v_alerts := array_append(v_alerts, 'revive_stalled');
    v_lines := array_append(v_lines, '🛑 Revive en échec (statut « ' || v_last_status || ' ») : ' || v_due || ' bien(s) étaient dus au re-check et la nuit n''a rien produit de sain. Vérifier pg_net (net.http_request_queue / net._http_response), le cron 02:30 et un éventuel throttle RealAdvisor. Tant que ça dure, les biens revenus en ligne sur RA restent invisibles au matching.');
  end if;

  -- NOUVEAU (#901 bis) — G) Revive muet : aucune ligne de run sur 26h. Ce signal
  -- ne vaut QUE depuis le heartbeat : avant, une nuit sans candidat n'écrivait
  -- rien et l'absence était le cas normal (fausse alerte du 19/07). Désormais une
  -- nuit calme écrit 'idle', donc plus rien du tout = le collect ne s'exécute pas
  -- ou meurt avant son insert (le heartbeat est en fin de fonction).
  -- Supprimé si cron_inactive a déjà signalé le job : une cause, une alerte.
  if not ('realadvisor-revive-collect' = any(v_missing)) then
    select count(*) into v_n from realadvisor_sync_runs
    where trigger_source='cron-revive' and ended_at > now()-interval '26 hours';
    if v_n = 0 then
      v_alerts := array_append(v_alerts, 'revive_stopped');
      v_lines := array_append(v_lines, '🛑 Revive muet : aucun run depuis >26h alors que le cron est actif. Depuis le heartbeat, une nuit sans candidat écrit quand même une ligne « idle » — l''absence TOTALE de ligne pointe donc le collect lui-même (exception silencieuse avant son insert), pas un vivier vide.');
    end if;
  end if;

  -- E) Retrait massif — RETIRÉE (29/07/2026). Seuil absolu de 1000 sur une
  -- grandeur bornée par un plafond qui suit le vivier : elle est passée sous le
  -- régime normal quand le live a grossi, et doublonnait la règle A. Détail et
  -- chiffres en tête de la migration 20260729170000.

  -- NOUVEAU — H) Taux de résurrection du revive. Le VRAI symptôme des faux
  -- absents : la part des `removed` que RA ressert vivants au re-check. Lit
  -- `total_updated` (= revived, colonne structurée), jamais le message.
  -- Plancher de 200 sondés : en dessous, le ratio est du bruit — et les nuits
  -- `idle` (total_seen = 0) sortent par la même clause, sans division par zéro.
  select total_seen, total_updated
  into v_seen, v_revived
  from realadvisor_sync_runs
  where trigger_source='cron-revive' and status='completed'
    and ended_at > now()-interval '26 hours'
  order by ended_at desc limit 1;
  if coalesce(v_seen,0) >= 200 then
    v_rate := round(100.0 * v_revived / v_seen, 2);
    if v_rate > 3 then
      v_alerts := array_append(v_alerts, 'resurrection_rate_high');
      v_lines := array_append(v_lines, '⚠️ Taux de résurrection anormal : ' || v_rate || '% des biens re-vérifiés cette nuit (' || v_revived || '/' || v_seen || ') étaient de nouveau en ligne sur RealAdvisor, contre ~1% attendu. Symptôme de FAUX ABSENTS — le sweep retire des biens encore vivants. Vérifier la sonde (net.http_request_queue / net._http_response), un throttle RA qui ferait passer des présents pour des absents, et le prédicat de realadvisor_probe_sweep.');
    end if;
  end if;

  -- NOUVEAU (30/07/2026) — I) Rolling muet : aucun run `cron-rolling` sur 26h.
  -- C'est le seul signal disponible pour cette panne : ni une requête pg_net
  -- perdue, ni une sortie précoce de runBackground() n'écrit quoi que ce soit en
  -- base (motif détaillé en tête de cette migration).
  --
  -- Supprimée si cron_inactive a déjà signalé le job, comme la règle G : une
  -- cause, une alerte. La distinction porte le diagnostic — cron_inactive dit
  -- « le job n'existe plus », rolling_stopped dit « il existe et n'a rien fait ».
  --
  -- `coalesce(ended_at, started_at)` : un rolling en cours a `ended_at` à NULL et
  -- serait compté zéro, ce qui ferait partir l'alerte sur un crawl sain.
  if not ('realadvisor-rolling-daily' = any(v_missing)) then
    select count(*) into v_n from realadvisor_sync_runs
    where trigger_source='cron-rolling'
      and coalesce(ended_at, started_at) > now()-interval '26 hours';
    if v_n = 0 then
      v_alerts := array_append(v_alerts, 'rolling_stopped');
      v_lines := array_append(v_lines, '🛑 Rolling muet : aucun run depuis >26h alors que le cron 22:00 est actif. L''ingestion passe surtout par lui (un bucket de cantons par nuit), donc le vivier ne se renouvelle plus pendant que le sweep continue de retirer ~1 000 biens par nuit. Une requête pg_net perdue ou une sortie précoce de la fonction ne laissent AUCUNE trace en base : vérifier cron.job_run_details pour le job realadvisor-rolling-daily, app_config.realadvisor_rolling_enabled, et le bucket du jour dans realadvisor_shard_map. Rejouable à la main par un POST mode:chunk scopé sur les cantons manqués.');
    end if;
  end if;

  insert into realadvisor_sync_runs(offer_type, trigger_source, status, ended_at, error_message)
  values ('buy','cron-health', case when coalesce(array_length(v_alerts,1),0) > 0 then 'alert' else 'completed' end, now(),
    'health: ' || case when coalesce(array_length(v_alerts,1),0) > 0 then 'ALERT ['||array_to_string(v_alerts,',')||']' else 'OK' end);

  if coalesce(array_length(v_alerts,1),0) = 0 then
    return jsonb_build_object('status','ok','alerts',0);
  end if;

  v_email := coalesce(nullif(public.get_app_config('realadvisor_alert_email'),''), nullif(public.get_app_config('realadvisor_contact_email'),''), 'tech@megga.ch');
  v_subject := '🚨 RealAdvisor — ' || array_length(v_alerts,1) || ' anomalie(s) : ' || array_to_string(v_alerts, ', ');
  v_body := '<strong>Surveillance RealAdvisor — ingestion achat</strong><br/><br/>' || array_to_string(v_lines, '<br/><br/>')
    || '<br/><br/>— Détecté le ' || to_char(now(),'DD.MM.YYYY HH24:MI') || ' UTC.<br/>Kill-switch : app_config.realadvisor_alert_enabled = ''false''.';

  perform net.http_post(
    url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || public.get_app_config('service_role_key')),
    body := jsonb_build_object('to', v_email, 'subject', v_subject, 'template', 'realadvisor_health_alert', 'data', jsonb_build_object('body', v_body))
  );
  return jsonb_build_object('status','alert','alerts',array_length(v_alerts,1),'codes',to_jsonb(v_alerts),'email',v_email);
end $function$;
