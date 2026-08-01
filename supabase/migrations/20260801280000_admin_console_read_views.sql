-- Étape 9 du plan Console MEGGA — les « vues » de lecture (spec §4.3, §5.1, §5.3, §5.4, §5.7).
--
-- ── CE QUI N'EST PAS ICI, ET POURQUOI ────────────────────────────────────────────────
-- §4.3 énumère DOUZE vues. Mesuré avant d'écrire, il en reste SIX à poser. Ne pas créer
-- est ici la moitié du travail (risque n°1 du plan : réécrire ce qui existe) :
--
--   · `v_admin_kpis`        → NON CRÉÉE. `get_admin_dashboard_stats()` rend déjà, en
--     production, les SEPT champs d'ADMIN_KPIS et rien d'autre : active_agencies,
--     total_users, active_properties, active_transactions, high_risk_kyc,
--     new_agencies_this_month, new_users_this_month. La correspondance avec la maquette est
--     1:1. Une vue de plus n'aurait été qu'un second nom pour la même requête.
--   · `v_monitoring_board`  → NON CRÉÉE. ADMIN_HEALTH (dbPct, storagePct, errors24h,
--     requests24h, emailsToday) sort de `get_admin_monitoring_health()` ; l'état des crons
--     de `get_cron_health()` et de `get_admin_cron_runs()` (étape 12, 20260801250000).
--     ⚠ Rectifié à l'étape 10 : une première rédaction citait ici `get_admin_ops_health_rpcs()`
--     comme source de functionsOk/functionsErr. CETTE FONCTION N'EXISTE PAS — ni en base, ni
--     dans le dépôt ; le nom vient du plan, qui désignait ainsi 20260705172000, laquelle a en
--     réalité créé get_admin_syndication_health, _whatsapp_health et _ai_costs. Le compte
--     d'erreurs vient de get_admin_monitoring_health() ; le compte de FONCTIONS distinctes en
--     erreur se dérive dans admin_overview() (20260801290000).
--   · `v_kyc_funnel_30d`    → DÉJÀ POSÉE en fonction (`get_admin_kyc_funnel_30d`, 240000).
--   · `v_security_journal`  → DÉJÀ POSÉE en fonction (`get_admin_security_journal`, 260000).
--   · `v_diffusion_board`   → Lot 3. `listing_signals` n'existe pas (étape 24).
--   · `v_ai_month`          → Lot 2, étape 20.
--   · `v_changelog`         → Lot 2, étape 21.
--
-- ── POURQUOI DES FONCTIONS ET NON DES VUES ───────────────────────────────────────────
-- PostgreSQL n'applique aucune RLS à une vue. `security_invoker` rendrait à chaque agent
-- les agrégats de sa propre agence — donc une console à moitié ouverte ; sans lui, tout
-- `authenticated` lirait la plateforme entière. L'amendement est déjà acté pour
-- v_kyc_funnel_30d et v_security_journal (ETAT_CHANTIER §5) ; il vaut pour les six ici.
-- Le nom `v_*` de la spec désigne un CONTRAT DE LECTURE, pas un `CREATE VIEW`.

-- ── 1. La règle de MRR, une seule fois ───────────────────────────────────────────────
--
-- §4.3 : « Une seule fonction SQL `agency_mrr(agency_id)` (prix depuis le catalogue C2),
-- jamais recalculée côté front. » Deux objets plutôt qu'un, pour tenir ce « une seule
-- fois » SANS le payer cent fois :
--
--   `agency_mrr_rule(...)`  porte LA RÈGLE. Pure : elle ne lit aucune table, tout lui est
--                           passé. Donc IMMUTABLE, donc utilisable dans un SELECT ensembliste.
--   `agency_mrr(uuid)`      est l'entrée nommée par la spec. Elle garde, elle lit, elle délègue.
--
-- Pourquoi pas la seule seconde, appelée par ligne : sa garde appelle `is_super_admin()`,
-- qui joint `profiles` à `auth.users` et évalue l'allowlist. Sur le registre des agences
-- c'est une jointure d'authentification PAR AGENCE affichée, pour un verdict déjà rendu à
-- l'entrée de la fonction appelante. La règle, elle, ne franchit aucune RLS et n'a rien à
-- garder : elle ne connaît que les arguments qu'on lui donne.

create or replace function public.agency_mrr_rule(
  p_plan           text,
  p_billing_period text,
  p_sub_status     text,
  p_agency_status  text,
  p_pricing        jsonb
)
returns numeric
language sql
immutable
as $function$
  -- Règle de comptage §4.3 : essai, impayé, suspendu ⇒ 0. Starter tombe à 0 tout seul,
  -- par son prix catalogue, sans être cité nulle part : le jour où Starter devient payant,
  -- il n'y a rien à corriger ici.
  select case
    when p_agency_status = 'suspended'            then 0::numeric
    when coalesce(p_sub_status, '') <> 'active'   then 0::numeric
    when p_pricing is null or p_plan is null      then 0::numeric
    else round(coalesce(
      ((p_pricing -> p_plan) ->> (case when p_billing_period = 'yearly' then 'yearly' else 'monthly' end))::numeric,
      0
    ), 2)
  end;
$function$;

comment on function public.agency_mrr_rule(text, text, text, text, jsonb) is
  'LA règle de comptage du MRR (§4.3), isolée et pure : essai, impayé et agence suspendue '
  'comptent zéro ; Starter tombe à zéro par son prix catalogue, jamais par une mention en '
  'dur. Sans garde parce que sans donnée : elle ne lit aucune table et ne rend que ce qu''on '
  'lui passe. C''est ce qui la rend IMMUTABLE, donc appelable sur cent lignes sans rejouer '
  'cent fois la jointure d''authentification de is_super_admin().';

-- Sans garde ne veut pas dire ouverte à tous : une fonction créée sans rien révoquer est
-- exécutable par PUBLIC, donc par `anon`. Elle ne divulgue rien — mais laisser une entrée
-- publique par inadvertance est le patron du footgun mesuré ailleurs dans ce dépôt.
revoke all on function public.agency_mrr_rule(text, text, text, text, jsonb) from public, anon;
grant execute on function public.agency_mrr_rule(text, text, text, text, jsonb) to authenticated, service_role;

drop function if exists public.agency_mrr(uuid);
create or replace function public.agency_mrr(p_agency_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_mrr numeric;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  -- Le prix vient d'`app_config.plan_pricing`, seule base de prix du dépôt, celle que lit
  -- déjà compute_platform_mrr_estimate(). §4.2 interdit une source de plus ; l'écart entre
  -- cette base et le catalogue TS (C2) est mesuré par admin_plan_pricing_drift(), pas
  -- supposé nul.
  --
  -- L'abonnement vient de `subscriptions` et NON d'`agencies.plan` : le CHECK de
  -- subscriptions.plan (starter|pro|entreprise) coïncide exactement avec les clés de
  -- plan_pricing, là où l'enum agency_plan porte un quatrième vocabulaire
  -- (starter|pro|agency|enterprise) dont deux valeurs n'ont aucun prix. C'est la décision
  -- PO n° 3, ouverte, et le MRR n'a pas à l'attendre.
  select public.agency_mrr_rule(s.plan, s.billing_period, s.status, a.status,
                                (select nullif(c.value, '')::jsonb
                                   from public.app_config c where c.key = 'plan_pricing'))
    into v_mrr
    from public.agencies a
    left join public.subscriptions s on s.agency_id = a.id
   where a.id = p_agency_id;

  -- Agence inexistante comme agence sans abonnement : zéro. Un NULL obligerait chaque
  -- appelant à décider ce qu'il en fait, et l'un d'eux déciderait mal.
  return coalesce(v_mrr, 0);
end;
$function$;

comment on function public.agency_mrr(uuid) is
  'MRR d''une agence (§4.3), entrée nommée par la spec. Garde, lit le catalogue et délègue à '
  'agency_mrr_rule(). Lit `subscriptions` et non `agencies.plan` : le CHECK du premier '
  'coïncide avec les clés de plan_pricing, l''enum du second porte deux valeurs sans prix '
  '(décision PO n° 3). Rend 0 pour une agence inconnue ou sans abonnement.';

revoke all on function public.agency_mrr(uuid) from public, anon;
grant execute on function public.agency_mrr(uuid) to authenticated, service_role;

-- ── 2. Le registre des agences (§5.3, `v_admin_agencies`) ────────────────────────────

drop function if exists public.get_admin_agencies(integer, integer, uuid);
create or replace function public.get_admin_agencies(
  p_limit     integer default 500,
  p_offset    integer default 0,
  -- Filtre à UNE agence, pour la fiche (§5.3). Sans lui, get_admin_agency_detail() devrait
  -- parcourir une fenêtre du registre pour y retrouver sa ligne : coûteux, et surtout FAUX
  -- au-delà de la fenêtre. Un argument plutôt qu'une seconde requête qui recopierait les
  -- seize colonnes et finirait par en diverger.
  p_agency_id uuid default null
)
returns table (
  id                  uuid,
  name                text,
  email               text,
  city                text,
  canton              text,
  plan                text,
  agents              bigint,
  properties          bigint,
  deals               bigint,
  mrr                 numeric,
  status              text,
  sub                 text,
  score               smallint,
  since               timestamptz,
  last                timestamptz,
  verification_status text,
  -- Quatre colonnes au-delà de la liste de §4.3, parce que l'écran RÉEL les affiche :
  -- le registre montre un logo et un slug, la fiche un téléphone, et les badges d'essai
  -- ont besoin de l'échéance. Les servir ici est ce qui fait de cette RPC « un fetch » ;
  -- les laisser dehors obligeait le hook à garder une seconde requête sur `agencies`.
  slug                text,
  logo_url            text,
  phone               text,
  current_period_end  timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_limit   integer := least(greatest(coalesce(p_limit, 500), 1), 2000);
  v_offset  integer := greatest(coalesce(p_offset, 0), 0);
  v_pricing jsonb;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  -- Le catalogue est lu UNE fois, hors de la boucle de lignes : c'est tout l'intérêt
  -- d'avoir séparé la règle de son entrée gardée.
  select nullif(c.value, '')::jsonb into v_pricing
    from public.app_config c where c.key = 'plan_pricing';

  return query
  select a.id,
         a.name,
         a.email,
         a.city,
         a.canton,
         a.plan::text,
         coalesce(t.agents, 0),
         coalesce(pr.properties, 0),
         coalesce(tr.deals, 0),
         public.agency_mrr_rule(s.plan, s.billing_period, s.status, a.status, v_pricing),
         a.status,
         s.status,
         act.score,
         a.created_at,
         -- « last » se lit à la minute dans la maquette (« il y a 20 min »). On prend donc
         -- le maximum VIVANT d'activity_events plutôt que agency_activation.last_activity_at,
         -- qui est recalculé la nuit (étape 8) et serait donc en retard d'un jour à l'écran.
         -- Le coût est nul : idx_activity_events_audit_filters (agency_id, created_at desc)
         -- rend ce max par un parcours d'index inversé, pas par un balayage.
         ev.last_at,
         a.verification_status,
         a.slug,
         a.logo_url,
         a.phone,
         s.current_period_end
    from public.agencies a
    left join public.subscriptions s   on s.agency_id = a.id
    left join public.agency_activation act on act.agency_id = a.id
    left join lateral (select count(*) as agents from public.profiles p
                        where p.agency_id = a.id and p.deleted_at is null) t on true
    left join lateral (select count(*) as properties from public.properties p
                        where p.agency_id = a.id and p.status = 'active') pr on true
    left join lateral (select count(*) as deals from public.transactions x
                        where x.agency_id = a.id and x.status = 'active') tr on true
    left join lateral (select max(e.created_at) as last_at from public.activity_events e
                        where e.agency_id = a.id) ev on true
   where p_agency_id is null or a.id = p_agency_id
   order by a.created_at desc
   limit v_limit offset v_offset;
end;
$function$;

comment on function public.get_admin_agencies(integer, integer, uuid) is
  'Registre des agences (§5.3) — un fetch pour les seize colonnes de la maquette, dont le '
  'MRR, le statut d''abonnement, le score d''activation et le statut de vérification KYB '
  '(C9). Fonction et non vue : PostgreSQL n''applique pas de RLS à une vue, et sans garde '
  'tout `authenticated` lirait la plateforme entière. Absorbe get_agency_stats() et '
  'get_agency_activity_summary(), que le front appelait en second temps — elles restent en '
  'place tant que l''étape 15 n''a pas rebranché les écrans.';

revoke all on function public.get_admin_agencies(integer, integer, uuid) from public, anon;
grant execute on function public.get_admin_agencies(integer, integer, uuid) to authenticated, service_role;

-- ── 3. La fiche agence (§5.3, `v_admin_agency_detail`) ───────────────────────────────

drop function if exists public.get_admin_agency_detail(uuid);
create or replace function public.get_admin_agency_detail(p_agency_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_agency      jsonb;
  v_usage       jsonb;
  v_result      jsonb;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  select to_jsonb(r) into v_agency
    from public.get_admin_agencies(1, 0, p_agency_id) r;

  if v_agency is null then
    -- Verdict explicite plutôt qu'un objet vide : la fiche doit pouvoir distinguer
    -- « agence inconnue » de « agence sans équipe ni abonnement ».
    return jsonb_build_object('found', false, 'agency_id', p_agency_id);
  end if;

  -- L'usage consolidé existe déjà en production (§5.3 : « usage via get_admin_agency_usage »).
  -- On l'embarque au lieu d'en refaire le calcul, et au lieu de laisser l'écran faire un
  -- second aller-retour.
  select to_jsonb(u) into v_usage from public.get_admin_agency_usage(p_agency_id) u;

  select jsonb_build_object(
    'found', true,
    'agency', v_agency,
    'usage', coalesce(v_usage, '{}'::jsonb),
    'team', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.full_name, 'email', p.email, 'role', p.role,
               'phone', coalesce(p.phone, p.mobile_phone),
               'suspended', coalesce(p.is_suspended, false),
               'since', p.created_at, 'deleted_at', p.deleted_at)
             order by p.created_at)
        from public.profiles p
       where p.agency_id = p_agency_id and p.deleted_at is null), '[]'::jsonb),
    -- Une seule source pour les invitations : la RPC de la migration 270000. La recopier
    -- ici ferait diverger la fiche agence du registre Utilisateurs sur la même ligne —
    -- c'est exactement ce que son commentaire interdit.
    'invitations', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at desc)
        from public.get_admin_agency_invitations(p_agency_id, 200) i), '[]'::jsonb),
    'subscription', (
      select to_jsonb(s) - 'stripe_customer_id' - 'stripe_subscription_id' - 'stripe_price_id'
        from public.subscriptions s where s.agency_id = p_agency_id),
    'note', (
      select jsonb_build_object('note', n.note, 'updated_at', n.updated_at, 'updated_by', n.updated_by)
        from public.admin_agency_notes n where n.agency_id = p_agency_id),
    'activation', (
      select to_jsonb(act) from public.agency_activation act where act.agency_id = p_agency_id)
  ) into v_result;

  return v_result;
end;
$function$;

comment on function public.get_admin_agency_detail(uuid) is
  'Fiche agence (§5.3) en un objet : agence, équipe, invitations en attente, usage '
  'consolidé, abonnement, note interne, activation. Réutilise get_admin_agency_usage() et '
  'get_admin_agency_invitations() au lieu d''en recopier le calcul — deux surfaces lisent '
  'les invitations et ne doivent pas diverger. Les identifiants Stripe sont retirés de '
  'l''abonnement : la console constate le paiement, elle ne le manipule pas (§5.7). '
  'JAMAIS de contacts, leads ni dossiers KYC de clients finaux.';

revoke all on function public.get_admin_agency_detail(uuid) from public, anon;
grant execute on function public.get_admin_agency_detail(uuid) to authenticated, service_role;

-- ── 4. Le registre des comptes (§5.4, `v_admin_users`) ───────────────────────────────
--
-- Index d'appui : la timeline par compte (fonction suivante) filtre sur actor_id puis trie
-- par date. `idx_activity_events_actor` ne porte QUE (actor_id) : Postgres y trouve les
-- lignes du compte, puis les trie toutes en mémoire pour n'en rendre que vingt. Sur le
-- volume de recette de l'étape 9 (1 M d'événements) c'est le tri qui coûte, pas la
-- recherche. La colonne de date dans l'index le supprime.

create index if not exists activity_events_actor_ts_idx
  on public.activity_events (actor_id, created_at desc)
  where actor_id is not null;

drop function if exists public.get_admin_users(integer, integer);
create or replace function public.get_admin_users(
  p_limit  integer default 500,
  p_offset integer default 0
)
returns table (
  id          uuid,
  name        text,
  email       text,
  phone       text,
  role        text,
  agency_id   uuid,
  agency      text,
  since       timestamptz,
  last        timestamptz,
  stale_days  integer,
  suspended   boolean,
  deleted_at  timestamptz,
  never       boolean,
  invited_at  timestamptz,
  marketing   boolean,
  consents    jsonb,
  -- Au-delà de la liste de §5.4, parce que le registre RÉEL affiche une vignette.
  -- La servir ici est ce qui évite au hook une seconde requête sur `profiles`.
  avatar_url  text
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 500), 1), 2000);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
  select p.id,
         p.full_name,
         p.email,
         coalesce(p.phone, p.mobile_phone),
         p.role,
         p.agency_id,
         a.name,
         p.created_at,
         ev.last_at,
         -- « stale » se compare à 30 jours dans la maquette (usxFlag). Un compte sans
         -- aucune activité n'est pas « périmé depuis 0 jour » : il est NULL, et l'écran
         -- l'affiche « jamais connecté » par le drapeau `never`.
         --
         -- `floor`, PAS un cast direct : `::integer` ARRONDIT en PostgreSQL. Un compte
         -- inactif depuis 29,6 jours serait rendu à 30 et franchirait le seuil de la
         -- maquette un tiers de journée trop tôt. Un âge se compte en journées RÉVOLUES.
         case when ev.last_at is null then null
              else greatest(0, floor(extract(epoch from (now() - ev.last_at)) / 86400)::integer) end,
         coalesce(p.is_suspended, false),
         -- Les comptes supprimés RESTENT dans le registre, avec leur date. Les masquer
         -- ferait diverger ce compte de `get_admin_dashboard_stats().total_users`, qui
         -- compte `profiles` sans filtre — or « compteurs Vue d'ensemble = sommes des
         -- tables, zéro contradiction » est un critère de sortie du gate G1. L'écran
         -- filtre ce qu'il veut ; la base ne ment pas sur son total.
         p.deleted_at,
         (inv.invited_at is not null and ev.last_at is null),
         inv.invited_at,
         (cons.marketing_at is not null),
         coalesce(cons.all_consents, '[]'::jsonb),
         p.avatar_url
    from public.profiles p
    left join public.agencies a on a.id = p.agency_id
    left join lateral (select max(e.created_at) as last_at from public.activity_events e
                        where e.actor_id = p.id) ev on true
    -- « Jamais connecté » = une invitation en attente à son adresse (§5.4, C3). Le lien se
    -- fait par e-mail : team_invitations est écrite AVANT que le compte n'existe, elle ne
    -- peut donc pas porter son identifiant.
    left join lateral (select max(t.created_at) as invited_at from public.team_invitations t
                        where t.status = 'pending' and lower(t.email) = lower(p.email)) inv on true
    left join lateral (
      select max(uc.accepted_at) filter (where uc.consent_type = 'marketing') as marketing_at,
             jsonb_agg(jsonb_build_object('type', uc.consent_type, 'version', uc.version,
                                          'accepted_at', uc.accepted_at)
                       order by uc.accepted_at desc) as all_consents
        from public.user_consents uc where uc.user_id = p.id) cons on true
   order by p.created_at desc
   limit v_limit offset v_offset;
end;
$function$;

comment on function public.get_admin_users(integer, integer) is
  'Registre des comptes (§5.4) : rôle, agence, dernière activité, ancienneté d''inactivité, '
  'suspension, état « invité jamais connecté » (team_invitations pending, C3) et '
  'consentements (user_consents : type × version × date, marketing = présence de ligne). '
  'Les comptes supprimés sont RENDUS, avec leur date : les masquer ferait diverger ce '
  'registre du total de get_admin_dashboard_stats(), et la cohérence des compteurs est un '
  'critère de sortie du gate G1.';

revoke all on function public.get_admin_users(integer, integer) from public, anon;
grant execute on function public.get_admin_users(integer, integer) to authenticated, service_role;

-- ── 5. La timeline d'un compte (§5.4, `v_admin_user_activity`) ───────────────────────

drop function if exists public.get_admin_user_activity(uuid, integer);
create or replace function public.get_admin_user_activity(
  p_user_id uuid,
  p_limit   integer default 30
)
returns table (
  id           uuid,
  action       text,
  category     text,
  severity     text,
  entity_type  text,
  entity_id    uuid,
  entity_label text,
  agency_id    uuid,
  created_at   timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 200);
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
  select e.id, e.action, e.category, e.severity,
         e.entity_type, e.entity_id, e.object_label, e.agency_id, e.created_at
    from public.activity_events e
   where e.actor_id = p_user_id
   order by e.created_at desc
   limit v_limit;
end;
$function$;

comment on function public.get_admin_user_activity(uuid, integer) is
  'Timeline d''un compte (§5.4), depuis activity_events. Rend les CLÉS techniques d''action '
  'et de catégorie, jamais un libellé français : la traduction est le mapping i18n '
  'audit.action.* côté écran, et la base ne stocke pas de FR (20260729100000 fait foi). '
  'S''appuie sur activity_events_actor_ts_idx, posé plus haut : sans la date dans l''index, '
  'Postgres trierait toutes les lignes du compte pour n''en rendre que trente.';

revoke all on function public.get_admin_user_activity(uuid, integer) from public, anon;
grant execute on function public.get_admin_user_activity(uuid, integer) to authenticated, service_role;

-- ── 6. Le poste de triage des abonnements (§5.7, `v_plans_board`) ────────────────────
--
-- ⚠ AMENDEMENT DE SPEC — TROIS CHIFFRES DE LA MAQUETTE N'ONT AUCUNE SOURCE.
-- ADMIN_BILLING porte `mrrTrend` (quatorze points d'historique), `revenue30d` et `churn`.
-- Aucun n'est dérivable : le dépôt ne garde AUCUN historique de MRR — `subscriptions` ne
-- conserve que l'état courant d'un abonnement, sans versions, et aucune table de revenu
-- n'existe. Les fabriquer aurait produit une courbe crédible et fausse. Ils sont donc
-- absents de cette réponse, et le resteront jusqu'à ce qu'une historisation existe (elle
-- viendrait du miroir Stripe, étape 7bis ou Lot 2). Même geste que pour la bande 24 h de
-- Monitoring, déjà amendée faute de source.
--
-- ⚠ LA FILE « SIÈGES SATURÉS » N'EST PAS CALCULÉE ICI, DÉLIBÉRÉMENT.
-- Elle a besoin d'un plafond de sièges par plan. Il en existe TROIS dans le dépôt, qui se
-- contredisent (PLANS.team_members 1/5/∞ · PLAN_LIMITS.maxAgents 1/1/10 · send-team-invite
-- en dur 1/3/10/50, la seule qui s'applique). C'est la décision PO n° 4, ouverte, et §5.7
-- dit lui-même « plafond de sièges APRÈS arbitrage ». En choisir un ici serait trancher en
-- silence une question posée au PO. `seats_used` est rendu par agence : le jour de
-- l'arbitrage, la file se calcule sans nouvelle mesure.

drop function if exists public.get_admin_plans_board();
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

  -- Le portefeuille, une fois, avec l'état d'abonnement dérivé de la maquette (plnState) :
  -- trialing → trial ; past_due ou agence suspendue → unpaid ; sinon active.
  with portfolio as (
    select a.id, a.name, a.status as agency_status,
           s.plan, s.billing_period, s.status as sub_status,
           s.current_period_end, s.trial_end, s.last_invoice_status,
           coalesce(seats.n, 0) as seats_used,
           case
             when s.status = 'trialing'                                   then 'trial'
             when s.status in ('past_due', 'unpaid') or a.status = 'suspended' then 'unpaid'
             when s.status = 'active'                                     then 'active'
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
    -- ARPU sur les seuls abonnements comptés : diviser par l'ensemble des agences
    -- ferait baisser le revenu moyen à chaque essai ouvert.
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
               group by r ->> 'plan') g), '[]'::jsonb),
    'pricing_source', coalesce(v_pricing, 'null'::jsonb),
    -- Ce que la réponse NE PORTE PAS, dit explicitement plutôt que laissé à deviner :
    -- un champ absent se lit « bug » à l'écran, un champ qui se nomme se lit « pas encore ».
    'unavailable', jsonb_build_array('mrr_trend', 'revenue_30d', 'churn', 'seats_saturated')
  );
end;
$function$;

comment on function public.get_admin_plans_board() is
  'Poste de triage des abonnements (§5.7), en lecture STRICTE : la console ne change pas de '
  'plan. Rend le MRR réel, l''ARPU, le portefeuille et les deux files calculables (impayés, '
  'essais). Le champ `unavailable` nomme ce qui manque au lieu de le taire : mrr_trend, '
  'revenue_30d et churn n''ont aucune source (le dépôt ne garde aucun historique de MRR) et '
  'seats_saturated attend le plafond de sièges de la décision PO n° 4, que §5.7 renvoie '
  'lui-même à l''arbitrage. Les prix viennent d''app_config.plan_pricing, jamais des prix de '
  'démonstration de la maquette (PLN_PRICE), que §5.7 proscrit nommément.';

revoke all on function public.get_admin_plans_board() from public, anon;
grant execute on function public.get_admin_plans_board() to authenticated, service_role;
