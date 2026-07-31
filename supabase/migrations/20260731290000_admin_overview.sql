-- Étape 10 du plan Console MEGGA — `admin_overview()` : un objet, un fetch (spec §5.1).
-- Contrat : docs/handoff/console-admin/front/admin-overview.jsx.
--
-- Cette fonction n'invente AUCUNE source. Elle assemble, dans l'ordre de l'écran, ce que
-- les étapes 5 à 9 ont posé — et elle les APPELLE plutôt que de recopier leurs requêtes,
-- pour qu'une correction faite une fois vaille partout :
--
--   pulse      → get_admin_monitoring_health() + get_cron_health()
--   kpis       → get_admin_dashboard_stats() (les 7 champs d'ADMIN_KPIS) + MRR du board
--   signals    → erreurs de fonction · impayés (board) · dossiers KYB en revue (§5.13)
--   journal    → get_admin_live_feed(), filtré des clients finaux
--   activation → agency_activation (étape 8)
--   kyc_funnel → get_admin_kyc_funnel_30d() (étape 13)
--   revenue    → get_admin_plans_board() (étape 9)
--
-- Le surcoût de ces appels est leur garde, rejouée cinq ou six fois — pas cent fois par
-- ligne comme au registre des agences, où l'étape 9 avait dû isoler la règle de MRR. À
-- cette échelle, une seule source vaut mieux qu'une micro-optimisation.
--
-- ⚠ UNE ERREUR DE L'ÉTAPE 9 ET DU PLAN, CORRIGÉE À LA SOURCE. Les deux citaient
-- `get_admin_ops_health_rpcs()` comme source de « fonctions en erreur ». Mesuré ici :
-- CETTE FONCTION N'EXISTE PAS — ni en base, ni dans le dépôt. La migration 20260705172000,
-- que le plan désigne comme « ops health », a en réalité créé get_admin_syndication_health,
-- get_admin_whatsapp_health et get_admin_ai_costs. Le commentaire de 20260731280000 a été
-- rectifié sur place : elle n'est ni mergée ni déployée, et la règle du dépôt n'interdit la
-- reprise que d'une migration DÉJÀ en production.
--
-- ── DEUX CHOSES QUE L'ÉCRAN DEMANDE ET QUE LA BASE NE SAIT PAS DIRE ──────────────────
--
-- · `tickets support` (3ᵉ signal de la tête, AOV_ALERT_CAT.ticket_created). Il n'existe
--   AUCUN système de tickets : pas de table, et zéro ligne `activity_events` d'action
--   `ticket_created` depuis la création de la table. Le signal est déclaré manquant, pas
--   simulé — c'est le seul des quatre signaux de §5.1 sans source.
-- · `crons en retard`. Le « retard » suppose de comparer un dernier lancement à une
--   expression cron (`0 4 * * *`, `*/15 * * * *`…), donc d'interpréter un planning en SQL.
--   Hors du périmètre d'une étape d'assemblage, et fragile. Ce qui EST mesurable sans rien
--   interpréter, c'est le dernier statut : `crons_failed`. Le pouls s'en contente — il ne
--   demande que « quelque chose ne va-t-il pas ? », et un cron en échec y répond mieux
--   qu'un cron en retard.
--
-- Note d'exactitude, à ne pas prendre pour une panne : `errors_24h` et `functions_err`
-- vaudront ZÉRO tant que l'étape 6 n'aura pas complété l'instrumentation. L'action
-- `edge_function_error` que get_admin_monitoring_health() compte n'est émise NULLE PART
-- aujourd'hui (zéro ligne mesurée). La plomberie est juste ; la source se remplira.

drop function if exists public.admin_overview();
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_health        record;
  v_stats         record;
  v_funnel        record;
  v_board         jsonb;
  v_crons_failed  bigint := 0;
  v_fn_err        bigint := 0;
  v_kyb_review    bigint := 0;
  v_pay_failed    bigint := 0;
  v_signals       jsonb  := '[]'::jsonb;
  v_journal       jsonb;
  v_activation    jsonb;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  select * into v_health from public.get_admin_monitoring_health();
  select * into v_stats  from public.get_admin_dashboard_stats();
  select * into v_funnel from public.get_admin_kyc_funnel_30d();
  v_board := public.get_admin_plans_board();

  -- ── Le pouls ───────────────────────────────────────────────────────────────────────
  --
  -- Le compte de la maquette est un nombre de FONCTIONS distinctes (« realadvisor-sync en
  -- erreur » au singulier, « 3 fonctions en erreur » au pluriel), pas un nombre d'erreurs :
  -- deux cents timeouts du même job restent une fonction à réparer. get_admin_monitoring_health()
  -- rend le second ; le premier se compte ici, sur la même source et la même fenêtre.
  -- Le repli sur 'inconnu' n'est pas cosmétique : `count(distinct …)` IGNORE les NULL, donc
  -- une erreur sans libellé ni entité ne compterait pour aucune fonction. Le pouls dirait
  -- « saine » alors qu'une fonction est tombée — la panne serait masquée par son anonymat.
  select count(distinct coalesce(e.object_label, e.entity_id::text, 'inconnu'))
    into v_fn_err
    from public.activity_events e
   where e.action = 'edge_function_error'
     and e.created_at >= now() - interval '24 hours';

  -- Le schéma `cron` peut manquer en base fraîche de CI, et get_cron_health() interroge
  -- cron.job_run_details en statique : son appel lèverait 42P01 là où l'extension n'est pas
  -- installée. Un pouls ne doit pas faire tomber la page d'accueil de la console.
  begin
    select count(*) into v_crons_failed
      from public.get_cron_health() c
     where c.last_status = 'failed';
  exception when others then
    v_crons_failed := 0;
  end;

  -- ── Les signaux « À traiter », dans l'ordre de l'écran : technique > argent > … ─────

  v_pay_failed := jsonb_array_length(coalesce(v_board -> 'queues' -> 'unpaid', '[]'::jsonb));

  -- Dossiers KYB en revue (§5.1, §5.13). Absent de la maquette, qui précède le module KYB :
  -- la spec l'ajoute explicitement, et tranche que le KYB « a droit de cité » ici parce
  -- qu'il concerne les agences CLIENTES, pas les clients finaux des agences.
  select coalesce(max(q.total_count), 0) into v_kyb_review
    from public.get_admin_agency_review_queue(1, 0) q;

  if v_fn_err > 0 then
    v_signals := v_signals || jsonb_build_array(jsonb_build_object(
      'id', 'fn', 'kind', 'functions_error', 'tone', 'err', 'count', v_fn_err, 'go', 'monitoring'));
  end if;
  if v_pay_failed > 0 then
    v_signals := v_signals || jsonb_build_array(jsonb_build_object(
      'id', 'pay', 'kind', 'payments_failed', 'tone', 'warn', 'count', v_pay_failed, 'go', 'plans'));
  end if;
  if v_kyb_review > 0 then
    v_signals := v_signals || jsonb_build_array(jsonb_build_object(
      'id', 'kyb', 'kind', 'kyb_review', 'tone', 'info', 'count', v_kyb_review, 'go', 'kyb'));
  end if;

  -- ── Le journal ─────────────────────────────────────────────────────────────────────
  --
  -- ⚠ `is distinct from`, JAMAIS `<> 'kyc'`. `category` est NULL sur 95 % des lignes
  -- (décision PO n° 6, non rattrapable : la table refuse l'UPDATE). Un `<>` écarte les NULL
  -- en SQL — le journal aurait perdu la quasi-totalité de son contenu, silencieusement, en
  -- croyant ne retirer que la conformité des clients finaux.
  select coalesce(jsonb_agg(to_jsonb(f) - 'total_count' order by f.ts desc), '[]'::jsonb)
    into v_journal
    from public.get_admin_live_feed(40, 0) f
   where f.category is distinct from 'kyc';

  -- ── L'activation ───────────────────────────────────────────────────────────────────
  select jsonb_build_object(
           'total',   count(*),
           'active',  count(*) filter (where a.status = 'active'),
           'at_risk', count(*) filter (where a.status = 'atRisk'),
           'dormant', count(*) filter (where a.status = 'dormant'))
    into v_activation
    from public.agency_activation a;

  return jsonb_build_object(
    'pulse', jsonb_build_object(
      -- Le mot de l'écran (« Plateforme saine » / « Attention requise ») est dérivé ici,
      -- une fois : deux surfaces qui le calculeraient chacune pourraient diverger.
      'healthy',       (v_fn_err = 0 and v_crons_failed = 0),
      'functions_err', v_fn_err,
      'crons_failed',  v_crons_failed,
      'errors_24h',    coalesce(v_health.errors_last_24h, 0)),

    'kpis', jsonb_build_object(
      'agencies',                coalesce(v_stats.active_agencies, 0),
      'users',                   coalesce(v_stats.total_users, 0),
      'properties',              coalesce(v_stats.active_properties, 0),
      'transactions',            coalesce(v_stats.active_transactions, 0),
      'mrr',                     coalesce(v_board ->> 'mrr', '0')::numeric,
      'new_agencies_this_month', coalesce(v_stats.new_agencies_this_month, 0),
      'new_users_this_month',    coalesce(v_stats.new_users_this_month, 0)),

    'signals', v_signals,
    'journal', coalesce(v_journal, '[]'::jsonb),
    'activation', coalesce(v_activation, '{}'::jsonb),

    -- Le tunnel est repris EN AGRÉGATS SEULS, tel que l'étape 13 le rend : aucune colonne
    -- nominative n'y transite, et §5.1 interdit tout signal de conformité de client final
    -- sur cet écran. Il est ici comme santé de DÉLIVRANCE du lien magique, pas comme
    -- conformité — la distinction est celle du commentaire de la maquette.
    'kyc_funnel', jsonb_build_object(
      'links_sent',      coalesce(v_funnel.links_sent, 0),
      'links_opened',    coalesce(v_funnel.links_opened, 0),
      'links_submitted', coalesce(v_funnel.links_submitted, 0),
      'links_expired',   coalesce(v_funnel.links_expired, 0),
      'conversion_pct',  case when coalesce(v_funnel.links_sent, 0) = 0 then 0
                              else round(100.0 * v_funnel.links_submitted / v_funnel.links_sent) end),

    'revenue', jsonb_build_object(
      'mrr',           coalesce(v_board ->> 'mrr', '0')::numeric,
      'subscriptions', coalesce(v_board ->> 'subscriptions', '0')::integer,
      'arpu',          coalesce(v_board ->> 'arpu', '0')::numeric,
      'failed',        v_pay_failed),

    -- Nommé plutôt que tu, comme au poste de triage : un champ absent se lit « bug », un
    -- champ qui se nomme se lit « pas encore ».
    'unavailable', jsonb_build_array('support_tickets', 'crons_late')
  );
end;
$function$;

comment on function public.admin_overview() is
  'Vue d''ensemble de la console (§5.1) : un objet, un fetch. N''invente aucune source — '
  'elle APPELLE get_admin_monitoring_health, get_admin_dashboard_stats, '
  'get_admin_kyc_funnel_30d, get_admin_plans_board, get_admin_live_feed, get_cron_health et '
  'get_admin_agency_review_queue, plutôt que de recopier leurs requêtes. Le journal filtre '
  'la conformité des clients finaux par `is distinct from ''kyc''` et non `<> ''kyc''` : '
  'category est NULL sur 95 % des lignes, et un `<>` aurait vidé le journal en silence. '
  '`unavailable` nomme les deux manques réels : aucun système de tickets n''existe, et le '
  '« retard » d''un cron exigerait d''interpréter son planning — le pouls se fonde sur '
  'l''échec, qui se mesure sans rien interpréter.';

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated, service_role;
