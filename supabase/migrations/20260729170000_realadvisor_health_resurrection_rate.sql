-- realadvisor_health_check : retire la règle E (mass_removal), pose la règle H
-- (taux de résurrection du revive).
--
-- POURQUOI E PART
-- -----------------------------------------------------------------------------
-- E alertait sur `max(total_removed) >= 1000` en 26h — un seuil ABSOLU sur une
-- grandeur BORNÉE par un plafond qui, lui, suit le vivier : min(1200, 3% du live),
-- recalculé chaque nuit. Tant que le live tenait ~26 000, le plafond valait
-- ~780-805 et le seuil de 1 000 était AU-DESSUS du maximum atteignable : l'alerte
-- ne pouvait matériellement pas partir (18, 19, 20/07 : sweeps `capped` à
-- 805/799/780, health OK). Depuis que la refonte a porté le live à ~44 000, le
-- plafond effectif est 1 200 et l'inflow naturel s'installe à ~1 200 : le seuil
-- est passé SOUS le régime normal. Résultat mesuré : 5 alertes en 6 jours
-- (24, 25, 26, 28, 29/07), le seul jour vert étant le 27/07 à 946 retraits.
--
-- Et le taux, lui, a BAISSÉ : 2,72 %/nuit du live aujourd'hui contre 3,00 % les
-- 18-20/07. E criait « retrait massif » sur un rythme par bien en recul ; seul le
-- nombre absolu avait monté, parce que le vivier a grossi de 69 %.
--
-- Rien ne remplace E côté volume, et c'est délibéré : `total_removed` NE PEUT PAS
-- dépasser le plafond depuis qu'il existe (09/07), donc un « retrait massif » au
-- sens propre est impossible par construction. Le seul énoncé qui garde du sens —
-- « le sweep tape son plafond nuit après nuit » — est déjà la règle A
-- (sweep_capped_persistent, >=3 `capped` en 74h). E en était devenue une doublure
-- bruyante, et 5 mails en 6 jours décrivant l'état attendu désensibilisent avant
-- le vrai incident.
--
-- CE QUE H SURVEILLE À LA PLACE
-- -----------------------------------------------------------------------------
-- Le vrai symptôme des faux absents — ce que E prétendait attraper — n'est pas le
-- volume retiré (borné) mais le TAUX DE RÉSURRECTION du revive : la part des biens
-- `removed` que RA ressert vivants au re-check. Retirer à tort le fait monter
-- mécaniquement. Il tournait à 2-8 % avant le correctif du 21/07 (#926/#927) et
-- vit à ~1 % depuis. Il est mesuré chaque nuit et n'était surveillé par aucune règle.
--
-- Seuil 3 % : validé sur l'historique. Aurait alerté les 13/07 (90/2090 = 4,3 %),
-- 14/07 (29/408 = 7,1 %) et 17/07 (74/919 = 8,1 %) — l'époque des faux absents —
-- et reste muet sur les 7 nuits depuis le correctif (0,23 · 0,32 · 0,60 · 0,60 ·
-- 1,06 · 1,20 · 1,57 %).
--
-- Plancher de 200 biens sondés : sous cet échantillon le ratio est du bruit (le
-- 15/07, 5 résurrections sur 178 sondés font 2,8 % sans rien signifier). Les nuits
-- `idle` (total_seen = 0) sortent par la même clause, sans division par zéro.
--
-- ⚠ H lit `total_updated`, PAS le `revived=` du message. Le message est de
-- l'habillage : conditionner une alerte à sa regex la ferait mourir en silence le
-- jour où le format change (même travers que celui corrigé en #901 bis sur `due=`).
-- Égalité vérifiée sur les 15 dernières nuits de `cron-revive` : total_updated =
-- revived, sans exception.
--
-- Reconstruite depuis pg_get_functiondef() de la fonction VIVANTE, pas depuis le
-- dernier fichier de migration : les deux avaient divergé.

CREATE OR REPLACE FUNCTION public.realadvisor_health_check()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    for r in
      select v.jobname from (values ('realadvisor-fresh-daily'),('realadvisor-probe-fire'),('realadvisor-probe-collect'),('realadvisor-probe-sweep'),('realadvisor-revive-fire'),('realadvisor-revive-collect')) as v(jobname)
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
  -- chiffres en tête de cette migration.

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

-- CREATE OR REPLACE préserve l'ACL d'une fonction existante, mais sur une base
-- reconstruite depuis zéro l'ordre des migrations décide de ce qui reste. On
-- réaffirme donc l'état voulu, identique à la prod : exécution réservée au
-- service_role (le cron), jamais anon ni authenticated.
REVOKE ALL ON FUNCTION public.realadvisor_health_check() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.realadvisor_health_check() FROM anon;
REVOKE ALL ON FUNCTION public.realadvisor_health_check() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.realadvisor_health_check() TO service_role;
