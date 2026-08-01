-- Revue du Lot 1 (01.08.2026) — deux défauts d'AFFICHAGE JUSTE, trouvés en relisant le
-- code déployé contre la maquette et contre la production.
--
-- NOUVEAU FICHIER, pas une reprise sur place : `20260731320000` et `20260731290000` sont
-- DÉJÀ en production (PR #1046, mergée le 01.08 à 08h20). La règle du dépôt interdit de
-- corriger une migration déployée — une correction se fait par une migration de plus.
--
-- ⚠ UN TROISIÈME DÉFAUT A ÉTÉ SIGNALÉ PUIS RETIRÉ, et c'est noté ici pour que personne ne
-- le « re-trouve » : le pouls ne compte pas les crons dont le dernier statut est NULL. Ça
-- ressemble à un angle mort, ça n'en est pas un. Mesuré le 01.08 : les deux jobs concernés
-- (`agency-activation-nightly` en `20 2 * * *`, `admin-ai-drift-purge-monthly` en
-- `40 3 1 * *`) venaient d'être créés APRÈS leur heure de passage — ils n'avaient manqué
-- aucun rendez-vous. Les compter aurait produit un faux positif sur CHAQUE cron nouvellement
-- déployé. Distinguer « en retard » de « pas encore l'heure » demande d'interpréter la
-- cadence, ce que §7 range dans `crons_late`, déjà déclaré indisponible.

-- ── 1. Écran Plans : `count` et `mrr` portaient sur deux populations ─────────────────
--
-- Le regroupement par plan comptait TOUTES les agences ayant une ligne d'abonnement —
-- essai, impayé, suspendu, résilié compris — alors que la somme de MRR vaut zéro pour
-- toutes celles-là (règle §4.3). Les deux nombres étaient justes séparément ; leur
-- APPARIEMENT mentait : « Pro · 10 · CHF 623 » invite à diviser et à conclure que Pro vaut
-- 62 CHF. La maquette, elle, calcule ce tableau sur les seules agences ACTIVES
-- (`ADMIN_BILLING.plans` dérive de `activeAg`) — c'est cette divergence qu'on ferme.

create or replace function public.get_admin_plans_board()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_pricing jsonb;
  v_rows    jsonb;
  v_mrr     numeric;
  v_active  integer;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  select nullif(c.value, '')::jsonb into v_pricing
    from public.app_config c where c.key = 'plan_pricing';

  with portfolio as (
    select a.id, a.name, a.status as agency_status,
           s.plan, s.billing_period, s.status as sub_status,
           s.current_period_end, s.trial_end, s.last_invoice_status,
           coalesce(seats.n, 0) as seats_used,
           case
             when s.status = 'trialing'                                       then 'trial'
             when s.status in ('past_due', 'unpaid') or a.status = 'suspended' then 'unpaid'
             when s.status = 'active'                                         then 'active'
             else 'none'
           end as state,
           public.agency_mrr_rule(s.plan, s.billing_period, s.status, a.status, v_pricing) as mrr
      from public.agencies a
      left join public.subscriptions s on s.agency_id = a.id
      left join lateral (select count(*) as n from public.profiles p
                          where p.agency_id = a.id and p.deleted_at is null) seats on true
  )
  select jsonb_agg(to_jsonb(portfolio) order by portfolio.mrr desc, portfolio.name),
         coalesce(sum(portfolio.mrr), 0),
         count(*) filter (where portfolio.state = 'active')
    into v_rows, v_mrr, v_active
    from portfolio;

  return jsonb_build_object(
    'mrr', round(coalesce(v_mrr, 0), 2),
    'subscriptions', coalesce(v_active, 0),
    'arpu', case when coalesce(v_active, 0) = 0 then 0
                 else round(coalesce(v_mrr, 0) / v_active, 2) end,
    'portfolio', coalesce(v_rows, '[]'::jsonb),
    'queues', jsonb_build_object(
      'unpaid', coalesce((select jsonb_agg(r) from jsonb_array_elements(coalesce(v_rows, '[]'::jsonb)) r
                           where r ->> 'state' = 'unpaid'), '[]'::jsonb),
      'trials', coalesce((select jsonb_agg(r) from jsonb_array_elements(coalesce(v_rows, '[]'::jsonb)) r
                           where r ->> 'state' = 'trial'), '[]'::jsonb)
    ),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object('plan', k, 'count', n, 'mrr', m) order by k)
        from (select r ->> 'plan' as k, count(*) as n,
                     round(sum((r ->> 'mrr')::numeric), 2) as m
                from jsonb_array_elements(coalesce(v_rows, '[]'::jsonb)) r
               where r ->> 'plan' is not null
                 -- LE CORRECTIF. Le compte et le MRR portent désormais sur la MÊME
                 -- population : les agences qui paient. Une agence en essai ou suspendue
                 -- reste visible dans `portfolio` et dans sa file — elle n'a simplement
                 -- plus à gonfler un compte adossé à un revenu qui l'exclut.
                 and r ->> 'state' = 'active'
               group by r ->> 'plan') g), '[]'::jsonb),
    'pricing_source', coalesce(v_pricing, 'null'::jsonb),
    'unavailable', jsonb_build_array('mrr_trend', 'revenue_30d', 'churn', 'seats_saturated')
  );
end;
$function$;

comment on function public.get_admin_plans_board() is
  'Poste de triage des abonnements (§5.7), en lecture STRICTE. Le tableau `plans` compte et '
  'somme sur la MÊME population — les agences ACTIVES — depuis la revue du 01.08 : avant, le '
  'compte incluait essais, impayés et suspendues quand le MRR les excluait, et « Pro · 10 · '
  'CHF 623 » invitait à diviser pour obtenir un prix faux. `portfolio` et les files, eux, '
  'gardent tout le monde : c''est leur rôle. Le champ `unavailable` nomme ce qui n''a pas de '
  'source (mrr_trend, revenue_30d, churn) et ce qui attend la décision PO n° 4 '
  '(seats_saturated).';

revoke all on function public.get_admin_plans_board() from public, anon;
grant execute on function public.get_admin_plans_board() to authenticated, service_role;

-- ── 2. Vue d'ensemble : le journal filtrait APRÈS la limite ──────────────────────────
--
-- `get_admin_live_feed(40, 0)` rend les 40 plus récents, et le filtre `category is distinct
-- from 'kyc'` s'appliquait ENSUITE : si 15 des 40 étaient du KYC, le journal en affichait 25,
-- sans que rien ne distingue « il y en avait 40, on en a retiré 15 » de « il n'y en a que 25 ».
-- Le défaut ne se voit pas sur une plateforme calme — il se manifeste exactement quand
-- l'activité monte, c'est-à-dire quand le journal sert le plus.
--
-- `get_admin_live_feed` n'a qu'un filtre d'INCLUSION (`p_category = X`), pas d'exclusion :
-- on ne peut donc pas lui demander « tout sauf kyc ». D'où la sur-récupération, bornée puis
-- recoupée ici. 120 pour 40 rendus : il faudrait que les DEUX TIERS des événements récents
-- soient du KYC pour retomber court, ce qui ne s'est jamais vu (le KYC pèse ~1 %).

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

  select count(distinct coalesce(e.object_label, e.entity_id::text, 'inconnu'))
    into v_fn_err
    from public.activity_events e
   where e.action = 'edge_function_error'
     and e.created_at >= now() - interval '24 hours';

  begin
    select count(*) into v_crons_failed
      from public.get_cron_health() c
     where c.last_status = 'failed';
  exception when others then
    v_crons_failed := 0;
  end;

  v_pay_failed := jsonb_array_length(coalesce(v_board -> 'queues' -> 'unpaid', '[]'::jsonb));

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

  -- LE CORRECTIF : sur-récupérer, filtrer, PUIS borner à 40. `is distinct from` et non
  -- `<>` reste indispensable — `category` est NULL sur 95 % des lignes, et un `<>` les
  -- écarterait toutes en croyant ne retirer que la conformité des clients finaux.
  select coalesce(jsonb_agg(x.ligne order by x.ts desc), '[]'::jsonb)
    into v_journal
    from (
      select to_jsonb(f) - 'total_count' as ligne, f.ts
        from public.get_admin_live_feed(120, 0) f
       where f.category is distinct from 'kyc'
       order by f.ts desc
       limit 40
    ) x;

  select jsonb_build_object(
           'total',   count(*),
           'active',  count(*) filter (where a.status = 'active'),
           'at_risk', count(*) filter (where a.status = 'atRisk'),
           'dormant', count(*) filter (where a.status = 'dormant'))
    into v_activation
    from public.agency_activation a;

  return jsonb_build_object(
    'pulse', jsonb_build_object(
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

    'unavailable', jsonb_build_array('support_tickets', 'crons_late')
  );
end;
$function$;

comment on function public.admin_overview() is
  'Vue d''ensemble de la console (§5.1) : un objet, un fetch. N''invente aucune source. Le '
  'journal SUR-RÉCUPÈRE (120) avant de filtrer le KYC puis de borner à 40 — depuis la revue '
  'du 01.08 : filtrer après la limite raccourcissait le journal en silence, et précisément '
  'quand l''activité monte. `is distinct from` et non `<>` : category est NULL sur 95 % des '
  'lignes. `unavailable` nomme les deux manques réels — aucun système de tickets n''existe, '
  'et le « retard » d''un cron exigerait d''interpréter son planning (un cron sans exécution '
  'n''est PAS en retard : il peut n''avoir pas encore atteint sa première heure, ce qui a '
  'été mesuré le 01.08 sur deux jobs fraîchement déployés).';

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated, service_role;
