-- Surveillance RealAdvisor : câbler la sonde de résurrection à l'alerte e-mail.
--
-- Suite directe de la PR #901 (heartbeat du revive). Cette PR-là a rendu le
-- silence du revive LISIBLE — une ligne de run à chaque passage, avec `due=N`
-- et les statuts 'idle' / 'paused' / 'stalled'. Mais rien ne lisait ce signal en
-- dehors du rapport quotidien : realadvisor_health_check n'avait AUCUNE règle sur
-- trigger_source='cron-revive'. C'est ce trou qu'on ferme.
--
-- ⚠ CE QUE CETTE MIGRATION NE FAIT PAS : garantir un e-mail. Deux limites, toutes
-- deux PRÉEXISTANTES et hors du périmètre de ce fichier :
--   · Cadence. Le cron 'realadvisor-health-daily' est `0 9 * * *` : la détection
--     est QUOTIDIENNE (délai 0 à 24h), pas « dans l'heure ».
--   · Le chemin e-mail est mort. 'realadvisor_health_alert' n'est pas dans
--     PUBLIC_TEMPLATES (supabase/functions/send-email/index.ts), donc send-email
--     exige requireAgentAuth, qui fait auth.getUser(token) — or le token envoyé
--     est get_app_config('service_role_key'), une clé `sb_secret_…` et non un JWT
--     utilisateur : GoTrue répond 401. net.http_post étant fire-and-forget, le SQL
--     ne le voit jamais et journalise 'alert' comme si tout allait bien.
--   Le bloc net.http_post ci-dessous est reproduit à l'identique de la prod
--   (exigence de CREATE OR REPLACE) : on n'introduit ni n'aggrave rien. Le gain
--   reste réel — les 2 règles écrivent la ligne 'cron-health' status='alert' AVANT
--   et indépendamment de l'e-mail, donc une panne du revive passe d'invisible à
--   visible dans le rapport quotidien. Réparer send-email est un chantier séparé
--   (et surtout PAS en ajoutant le template à PUBLIC_TEMPLATES : le `default` du
--   switch accepte un `to` et un data.html arbitraires, ce serait rouvrir le relais
--   e-mail fermé par 0106a59d — la bonne piste est de comparer le bearer à
--   SUPABASE_SERVICE_ROLE_KEY en temps constant).
--
-- Deux règles, qui couvrent les principaux modes de panne du revive SANS que les
-- règles existantes ne s'en aperçoivent :
--
--   1. 'revive_stalled' — le collect a lui-même journalisé 'stalled', c'est-à-dire
--      qu'il n'a traité aucun lot ALORS QUE des candidats étaient dus. Le cron a
--      tourné, le vivier n'était pas vide, et pourtant le fire n'a rien produit de
--      collectable : pg_net en panne, IP flaggée, ou lots perdus. C'est l'anomalie
--      que le heartbeat existe pour nommer. Le message reprend le `due=N` du run
--      pour dire combien de biens sont bloqués.
--
--   2. 'revive_stopped' — AUCUN run cron-revive depuis >26h. Avant le heartbeat
--      ce signal ne valait rien : une nuit sans candidat ne produisait aucune
--      ligne, donc l'absence était le cas NORMAL (c'est précisément ce qui a
--      produit la fausse alerte du 19/07). Depuis #901 une nuit calme écrit quand
--      même une ligne 'idle' — l'absence totale de ligne devient donc un vrai
--      signal : le collect ne s'exécute plus, ou il lève une exception avant son
--      insert (le heartbeat étant en fin de fonction, une exception le saute).
--      Cette règle n'est possible QUE grâce au heartbeat ; c'est sa contrepartie.
--
-- Anti-doublon : 'revive_stopped' ne se déclenche pas si 'cron_inactive' a déjà
-- signalé realadvisor-revive-collect — sinon un cron délibérément désactivé
-- produirait DEUX alertes pour une seule cause. On teste `v_missing`, déjà
-- calculé juste au-dessus, plutôt que de re-requêter cron.job.
--
-- Faux positifs écartés par construction :
--   · kill-switch baissé → le collect écrit 'paused' (il n'est pas gated par le
--     switch, seul le fire l'est), donc ni 'stalled' ni 'stopped' ne partent.
--   · nuit sans candidat → 'idle', total_errors=0, aucune règle ne matche.
--   · fenêtre 26h : le collect tourne à 02:45 UTC et le health_check à 09:00 UTC,
--     donc le run de la nuit a ~6h15 au moment du test — largement dans la
--     fenêtre, et la nuit d'avant (~30h) en est exclue. Même idiome que la règle
--     'mass_removal' existante.
--
-- ⚠ FENÊTRE DE TRANSITION (se referme seule dans la nuit du 19 au 20/07).
-- L'ère pré-heartbeat n'a laissé AUCUNE ligne cron-revive les 18 et 19/07 : au
-- moment d'écrire cette migration, `revive_stopped` se déclencherait donc si on
-- invoquait health_check à la main (dernier run revive = 17/07 02:45, cron actif).
-- Sur le chemin automatique il n'y a pas de faux positif : le cron health est
-- `0 9 * * *` et a déjà tourné aujourd'hui à 09:00 ; sa prochaine exécution est
-- le 20/07 à 09:00, soit APRÈS le premier heartbeat de la nuit (02:45), qui aura
-- écrit une ligne 'idle'. On assume donc la fenêtre plutôt que d'ajouter un garde
-- de démarrage permanent pour ~10 heures — d'autant que l'alerte serait
-- FACTUELLEMENT VRAIE si elle partait : il n'y a réellement pas eu de run.
--
-- Le reste de la fonction est reproduit à l'identique (CREATE OR REPLACE exige
-- le corps complet) : seuls les deux blocs marqués « NOUVEAU » sont ajoutés,
-- insérés après le bloc cron_inactive pour pouvoir lire v_missing. Vérifié par
-- diff ligne à ligne contre pg_get_functiondef de la prod : 0 ligne perdue.

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
  v_n int; v_removed int; v_email text; v_subject text; v_body text; r record;
  v_due text; v_last_status text;
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

  -- E) Retrait massif : couvre 'completed' ET 'capped'.
  select coalesce(max(total_removed),0) into v_removed from realadvisor_sync_runs
  where trigger_source='cron-probe-sweep' and status in ('completed','capped') and ended_at > now()-interval '26 hours';
  if v_removed >= 1000 then
    v_alerts := array_append(v_alerts, 'mass_removal');
    v_lines := array_append(v_lines, '⚠️ Retrait massif : ' || v_removed || ' biens passés en removed sur la dernière nuit (proche du plafond) — vérifier que ce ne sont pas des faux absents.');
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

-- Privilèges (ré-assertion explicite) — SECURITY DEFINER, jamais exécutable par
-- anon ni authenticated. Cible mesurée avant migration : {postgres=X, service_role=X}.
revoke all on function public.realadvisor_health_check() from public, anon, authenticated;
grant execute on function public.realadvisor_health_check() to service_role;
