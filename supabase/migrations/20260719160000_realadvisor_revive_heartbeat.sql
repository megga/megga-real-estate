-- Sonde de résurrection RealAdvisor : rendre son silence diagnosticable, et
-- cesser de lui faire manger ses propres lots en vol.
--
-- Incident fondateur (19 juil. 2026) : le rapport quotidien a signalé « aucun run
-- cron-revive depuis 2 nuits », soupçon de panne. Enquête : AUCUNE panne. Les crons
-- 243/244 étaient actifs et 'succeeded', le kill-switch à 'true'. Le vivier était
-- simplement vide — le run du 17/07 avait re-daté last_probe_at des 919 dernières
-- lignes éligibles, et le gate des 14 jours ne rouvre pas avant la nuit du 23/07.
--
-- Le vrai défaut n'est donc pas dans le revive, il est dans son OBSERVABILITÉ :
-- realadvisor_revive_collect n'insérait une ligne de run que si au moins un lot
-- avait été traité (`if v_ok + v_amb + v_dropped > 0`), et le job 243 jette la
-- valeur de retour du fire. Une accalmie normale et une panne totale (pg_net cassé,
-- IP flaggée, exception silencieuse) produisent donc EXACTEMENT la même trace :
-- rien. L'angle mort dure ici 6 nuits d'affilée (17/07 → 23/07) et n'a été levé
-- que par une enquête manuelle. C'est ce qu'on ferme.
--
-- Trois changements :
--
--   1. HEARTBEAT — le collect écrit désormais une ligne de run à CHAQUE passage,
--      même à zéro lot, avec `due=N` : la profondeur du vivier APRÈS traitement,
--      mesurée avec le même prédicat que le fire. Trois nouveaux statuts :
--        · 'idle'    → 0 lot traité ET 0 candidat dû : accalmie normale, prouvée.
--        · 'paused'  → kill-switch realadvisor_revive_enabled à 'false' : arrêt
--                      délibéré, total_errors=0. Sans cette branche, couper le
--                      revive produirait un 'stalled' chaque nuit — du bruit qui
--                      apprend à ignorer la ligne « Erreurs » du rapport quotidien
--                      le jour où elle est vraie.
--        · 'stalled' → 0 lot traité ALORS QUE des candidats étaient dus : c'est
--                      l'anomalie réelle (le fire n'a rien produit de collectable).
--                      Compté total_errors=1 pour que les scans d'anomalie
--                      existants, qui filtrent sur `total_errors > 0`, le voient
--                      sans avoir à connaître le nouveau statut.
--      Aucun risque de régression sur realadvisor_health_check : il ne référence
--      pas 'cron-revive' (vérifié), les nouveaux statuts ne croisent aucune de ses
--      règles. Le format du message reste parsable à l'identique — les champs
--      due= et orphans_purged= sont AJOUTÉS en fin de chaîne.
--
--   2. FILTRE kind SUR LA PURGE DE probe_collect — sa boucle de traitement filtrait
--      bien `kind='probe'`, mais son DELETE de balayage final ne filtrait rien :
--          delete from realadvisor_probe_inflight where fired_at < now() - '15 min'
--      Tout lot revive tiré à 02:30 dont la réponse pg_net n'était pas jointe à
--      02:45 était donc effacé à 03:10 par le collect horaire : sans application,
--      sans dead-letter, sans compteur. La perte était auto-réparatrice
--      (last_probe_at non bumpé → la ligne redevient due la nuit suivante) mais
--      totalement muette — et elle détruisait chaque nuit le seul canal de preuve
--      permettant de distinguer « le fire n'a rien tiré » de « le fire a tiré et
--      on a tout perdu ». Le revive purge maintenant ses propres lots (fenêtre 2h,
--      jamais 15 min : le collect tourne 15 min après le fire, un lot de la nuit
--      même ne doit sous aucun prétexte être défaussé par sa propre purge).
--
--   3. INDEX idx_ml_ra_revive_due — miroir de idx_ml_ra_probe côté 'removed'.
--      Le prédicat du fire n'était couvert par AUCUN index : Bitmap Heap Scan +
--      Sort, 7,6 s le 19/07 et 10,2 s le 18/07 pour un résultat VIDE (le coût du
--      tri est payé que la sortie soit vide ou non). Le heartbeat ajoutant un
--      comptage nocturne sur le même prédicat, le laisser sans index doublerait
--      une requête déjà au-dessus du statement timeout documenté (3-8 s). Colonne
--      de tête = last_probe_at : sur une nuit calme le range ne ramène rien et le
--      comptage est instantané, ce qui est précisément le cas fréquent.
--
-- Ce que cette migration ne fait PAS : redimensionner le revive. Le fire plafonne
-- à p_batches*36 = 2160 ids/nuit et la pointe du 23/07 est à 3125 candidats ; le
-- reliquat se reporte et se draine (première expiration de fenêtre 60j le 21/08,
-- donc zéro perte dans le transitoire). En régime établi la demande approche
-- ~3100 sondages/nuit contre 2160 de capacité — à traiter séparément, avec le
-- chiffre `due=` que ce heartbeat rend enfin visible nuit après nuit.

-- ── 1. Index de support du gate revive ──────────────────────────────────────
create index if not exists idx_ml_ra_revive_due
  on public.market_listings (last_probe_at nulls first, absent_first_at desc)
  where source_portal = 'realadvisor' and status = 'removed';

comment on index public.idx_ml_ra_revive_due is
  'Gate de realadvisor_revive_fire/_collect (removed dus au re-check). Tête = last_probe_at : une nuit sans candidat ne scanne rien.';

-- ── 2. probe_collect : la purge de balayage ne touche plus que les lots probe ──
create or replace function public.realadvisor_probe_collect()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare r record; v_present text[]; v_absent text[]; v_tc int;
        v_ok int := 0; v_amb int := 0; v_present_n int := 0; v_absent_n int := 0;
begin
  for r in
    select f.request_id, f.source_ids, resp.status_code, resp.content
    from realadvisor_probe_inflight f
    join net._http_response resp on resp.id = f.request_id
    where coalesce(f.kind, 'probe') = 'probe'
  loop
    v_tc := -1;
    if r.status_code = 200 and r.content ~ '"total_count"' then
      begin
        v_tc := (r.content::jsonb ->> 'total_count')::int;
        select coalesce(array_agg(elem ->> 'id'), array[]::text[]) into v_present
        from jsonb_array_elements(coalesce(r.content::jsonb -> 'listings', '[]'::jsonb)) elem;
      exception when others then v_tc := -1; end;
    end if;

    if v_tc < 0 or v_tc > coalesce(array_length(r.source_ids, 1), 0) then
      v_amb := v_amb + 1;
    else
      v_present := array(select unnest(r.source_ids) intersect select unnest(coalesce(v_present, array[]::text[])));
      v_absent  := array(select unnest(r.source_ids) except select unnest(coalesce(v_present, array[]::text[])));
      if coalesce(array_length(v_absent, 1), 0) is distinct from (coalesce(array_length(r.source_ids, 1), 0) - v_tc) then
        v_amb := v_amb + 1;
      else
        perform realadvisor_probe_bookkeep(v_present, v_absent, 20);
        v_ok := v_ok + 1;
        v_present_n := v_present_n + coalesce(array_length(v_present, 1), 0);
        v_absent_n := v_absent_n + coalesce(array_length(v_absent, 1), 0);
      end if;
    end if;
    delete from realadvisor_probe_inflight where request_id = r.request_id;
  end loop;

  -- SEUL CHANGEMENT DE CETTE FONCTION : le filtre kind.
  -- Sans lui, ce balayage horaire efface les lots revive tirés à 02:30 dont la
  -- réponse n'est pas encore jointe — silencieusement, et sans qu'ils soient
  -- jamais appliqués. realadvisor_revive_collect purge désormais les siens.
  delete from realadvisor_probe_inflight
  where coalesce(kind, 'probe') = 'probe' and fired_at < now() - interval '15 minutes';

  if v_ok + v_amb > 0 then
    insert into realadvisor_sync_runs(offer_type, trigger_source, status, ended_at,
      total_seen, total_updated, total_errors, pages_fetched, error_message)
    values ('buy', 'cron-probe', case when v_ok = 0 and v_amb > 0 then 'throttled' else 'completed' end,
      now(), v_present_n + v_absent_n, v_present_n, v_amb, v_ok + v_amb,
      'probe(pgnet) ok=' || v_ok || ' ambiguous=' || v_amb || ' present=' || v_present_n || ' absent=' || v_absent_n);
  end if;
  return jsonb_build_object('ok', v_ok, 'ambiguous', v_amb, 'present', v_present_n, 'absent', v_absent_n);
end $function$;

-- ── 3. revive_collect : heartbeat inconditionnel + purge de ses propres lots ──
-- Signature INCHANGÉE (p_max_revive integer) : le cron appelle
-- realadvisor_revive_collect(300). Ajouter des paramètres à défaut créerait une
-- SURCHARGE au lieu de remplacer la fonction, et l'appel à 1 argument deviendrait
-- ambigu (« function is not unique ») — ce qui casserait le cron en silence.
-- Les bornes du gate sont donc des constantes locales, à garder alignées avec les
-- défauts de realadvisor_revive_fire (p_window_days=60, p_min_gap_days=14).
create or replace function public.realadvisor_revive_collect(p_max_revive integer default 300)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare r record; v_present text[]; v_absent text[]; v_tc int; v_n int;
        v_ok int := 0; v_amb int := 0; v_revived int := 0; v_still int := 0;
        v_dropped int := 0; v_due int := 0; v_orphans int := 0; v_status text;
        c_window_days constant int := 60;
        c_min_gap_days constant int := 14;
begin
  for r in
    select f.request_id, f.source_ids, resp.status_code, resp.content
    from realadvisor_probe_inflight f
    join net._http_response resp on resp.id = f.request_id
    where f.kind = 'revive'
  loop
    v_tc := -1;
    if r.status_code = 200 and r.content ~ '"total_count"' then
      begin
        v_tc := (r.content::jsonb ->> 'total_count')::int;
        select coalesce(array_agg(elem ->> 'id'), array[]::text[]) into v_present
        from jsonb_array_elements(coalesce(r.content::jsonb -> 'listings', '[]'::jsonb)) elem;
      exception when others then v_tc := -1; end;
    end if;

    if v_tc < 0 or v_tc > coalesce(array_length(r.source_ids, 1), 0) then
      v_amb := v_amb + 1;
    else
      v_present := array(select unnest(r.source_ids) intersect select unnest(coalesce(v_present, array[]::text[])));
      v_absent  := array(select unnest(r.source_ids) except select unnest(coalesce(v_present, array[]::text[])));
      if coalesce(array_length(v_absent, 1), 0) is distinct from (coalesce(array_length(r.source_ids, 1), 0) - v_tc) then
        v_amb := v_amb + 1;
      elsif v_revived >= p_max_revive then
        -- Plafond atteint : on défausse SANS écrire (last_probe_at intact
        -- → le lot redevient dû dès la prochaine nuit).
        v_dropped := v_dropped + 1;
      else
        -- Présent → résurrection. Le trigger ra_price_status re-dérive
        -- price_reduced si current_price < price_at_first_seen (préservé).
        if coalesce(array_length(v_present, 1), 0) > 0 then
          update market_listings set
            status = 'active', last_seen_at = now(), last_probe_at = now(),
            absent_probe_count = 0, absent_first_at = null
          where source_portal = 'realadvisor' and source_id = any(v_present)
            and status = 'removed';
          get diagnostics v_n = row_count;
          v_revived := v_revived + v_n;
        end if;
        -- Toujours absent → simple re-datage du check (re-vérifié dans ≥14j).
        if coalesce(array_length(v_absent, 1), 0) > 0 then
          update market_listings set last_probe_at = now()
          where source_portal = 'realadvisor' and source_id = any(v_absent)
            and status = 'removed';
          get diagnostics v_n = row_count;
          v_still := v_still + v_n;
        end if;
        v_ok := v_ok + 1;
      end if;
    end if;
    delete from realadvisor_probe_inflight where request_id = r.request_id;
  end loop;

  -- Purge des lots revive périmés. Depuis que probe_collect filtre sur kind,
  -- plus personne d'autre ne les ramasse. Fenêtre 2h et NON 15 min : ce collect
  -- tourne 15 min après le fire — à 15 min, la purge défausserait les lots de la
  -- nuit même au moment précis où ils sont encore légitimement en vol. À 2h, elle
  -- ne ramasse que les orphelins de la veille (pg_net purge ses réponses vers 6h,
  -- ils n'ont donc plus aucune chance d'être appliqués).
  delete from realadvisor_probe_inflight
  where coalesce(kind, 'probe') = 'revive' and fired_at < now() - interval '2 hours';
  get diagnostics v_orphans = row_count;

  -- Profondeur du vivier APRÈS traitement — le chiffre qui rend le silence
  -- diagnosticable. Même prédicat que realadvisor_revive_fire, sans le LIMIT.
  select count(*) into v_due
  from market_listings
  where source_portal = 'realadvisor' and transaction_type = 'buy'
    and status = 'removed'
    and absent_first_at is not null
    and absent_first_at > now() - make_interval(days => c_window_days)
    and (last_probe_at is null or last_probe_at < now() - make_interval(days => c_min_gap_days));

  v_status := case
    -- Arrêt VOULU : realadvisor_revive_fire sort immédiatement sur le kill-switch
    -- (`if get_app_config('realadvisor_revive_enabled') = 'false' then return 0`),
    -- il n'y a donc rien à collecter par construction. Ce n'est pas une anomalie.
    -- Le garde-fou « 0 lot traité » est indispensable : la nuit où l'on bascule le
    -- switch, un lot tiré AVANT la bascule doit rester classé sur son vrai résultat.
    when v_ok + v_amb + v_dropped = 0
         and public.get_app_config('realadvisor_revive_enabled') = 'false' then 'paused'
    -- Rien traité ALORS QUE des candidats étaient dus : le fire aurait dû produire
    -- des lots collectables. C'est l'anomalie que 6 nuits d'angle mort ont masquée.
    when v_ok + v_amb + v_dropped = 0 and v_due > 0 then 'stalled'
    -- Rien traité et rien à traiter : accalmie normale, désormais PROUVÉE.
    when v_ok + v_amb + v_dropped = 0 then 'idle'
    when v_ok = 0 and v_amb > 0 then 'throttled'
    when v_dropped > 0 then 'capped'
    else 'completed' end;

  -- Heartbeat inconditionnel : plus de `if ... > 0 then insert`. Une nuit sans
  -- ligne de run signifie maintenant que le CRON lui-même n'a pas tourné, ce qui
  -- est une information exploitable — au lieu d'être indiscernable d'une accalmie.
  insert into realadvisor_sync_runs(offer_type, trigger_source, status, ended_at,
    total_seen, total_updated, total_errors, pages_fetched, error_message)
  values ('buy', 'cron-revive', v_status, now(),
    v_revived + v_still, v_revived,
    -- 'stalled' compte 1 erreur pour rester visible des scans qui filtrent sur
    -- total_errors > 0 sans connaître le nouveau statut (v_amb vaut 0 par
    -- construction dans cette branche : aucun lot n'a été traité).
    case when v_status = 'stalled' then 1 else v_amb end,
    v_ok + v_amb + v_dropped,
    'revive(pgnet) ok=' || v_ok || ' ambiguous=' || v_amb || ' revived=' || v_revived
      || ' still_gone=' || v_still || ' dropped_batches=' || v_dropped
      || ' due=' || v_due || ' orphans_purged=' || v_orphans);

  return jsonb_build_object('ok', v_ok, 'ambiguous', v_amb, 'revived', v_revived,
                            'still_gone', v_still, 'dropped_batches', v_dropped,
                            'due', v_due, 'orphans_purged', v_orphans, 'status', v_status);
end $function$;

-- ── 4. Privilèges (ré-assertion explicite) ──────────────────────────────────
-- CREATE OR REPLACE préserve l'ACL existante, mais on la ré-affirme : ces deux
-- fonctions sont SECURITY DEFINER et ne doivent jamais être exécutables par anon
-- ni authenticated. Cible mesurée avant migration : {postgres=X, service_role=X}.
revoke all on function public.realadvisor_probe_collect() from public, anon, authenticated;
revoke all on function public.realadvisor_revive_collect(integer) from public, anon, authenticated;
grant execute on function public.realadvisor_probe_collect() to service_role;
grant execute on function public.realadvisor_revive_collect(integer) to service_role;
