-- Socle de lecture du Lot 1 : activation des agences, miroir d'abonnement, flux Live.
-- Étape 5 du plan Console MEGGA, spec §4.2, §4.3, §5.7, §10.6.
--
-- §4.2 ANNONCE ONZE OBJETS À CRÉER. L'inventaire du socle en a ramené SIX, et ce fichier
-- n'en pose qu'un — les autres appartiennent aux lots suivants. Le détail, parce que ne pas
-- créer est ici le travail principal :
--
--   · `stripe_subscriptions`  → ABANDONNÉE. `public.subscriptions` existe (15 colonnes,
--     UNIQUE(agency_id), CHECK plan ∈ starter|pro|entreprise — exactement le `plan_code`
--     voulu) et est déjà upsertée par l'edge stripe-webhook sur cinq événements. Créer un
--     second miroir alimenté par le même webhook, c'était le risque n°1 du plan. Il ne
--     manquait que trois colonnes : elles sont ajoutées ci-dessous.
--   · `cron_runs`             → ABANDONNÉE. `cron.job_run_details` porte plus de 200 000
--     lignes depuis mars, sans purge. Ce qui manque n'est pas une table mais une RPC de
--     lecture — étape 12.
--   · `plan_config`           → NON CRÉÉE. La « 3ᵉ source » que §4.2 interdit existe déjà :
--     `app_config.plan_pricing`, lue par compute_platform_mrr_estimate(). Ce fichier pose
--     le contrôle de cohérence qui manquait, pas une quatrième source.
--   · `incidents`             → NON CRÉÉE, dérivée d'activity_events (étape 12).
--   · `deployments`           → REPORTÉE avec Q4, dont admin_deploy_rollback dépend déjà.
--   · `rpc_receipts`, `outbox_jobs`, `listing_signals`, `ai_drift_dismissals` → lots 2 et 3.
--
-- Reste `agency_activation`, ci-dessous, et elle est RÉDUITE elle aussi :
-- `get_onboarding_milestones()` calcule déjà cinq jalons booléens. Ce qui manque, ce sont
-- les jalons en TIMESTAMPS (la spec veut des dates), le jalon `signed_up`, le score et le
-- statut. La table les porte ; le calcul les remplira à l'étape 8. On absorbe la RPC
-- existante au lieu de la doubler.

-- ── 1. Activation des agences (§4.2, §5.1) ───────────────────────────────────────────

create table if not exists public.agency_activation (
  agency_id        uuid primary key references public.agencies(id) on delete cascade,
  signed_up_at     timestamptz,
  first_contact_at timestamptz,
  first_property_at timestamptz,
  first_kyc_at     timestamptz,
  first_deal_at    timestamptz,
  first_match_at   timestamptz,
  score            smallint not null default 0 check (score between 0 and 100),
  status           text     not null default 'dormant'
                     check (status in ('active', 'atRisk', 'dormant')),
  last_activity_at timestamptz,
  computed_at      timestamptz not null default now(),
  constraint agency_activation_score_needs_compute
    check (score = 0 or computed_at is not null)
);

comment on table public.agency_activation is
  'Jalons d''activation par agence, en TIMESTAMPS — la maquette affiche « il y a 5 h », pas '
  'un booléen (admin-overview.jsx, ADMIN_ONBOARDING). Absorbe get_onboarding_milestones(), '
  'qui rend les cinq mêmes jalons en booléens : cette RPC reste le calcul de référence tant '
  'que la table n''est pas remplie (étape 8), elle ne doit pas être doublée.';
comment on column public.agency_activation.status is
  'active | atRisk | dormant — valeurs de la maquette (ADMIN_ONBOARDING.status), pas une '
  'invention. Dormant au-delà de 30 jours sans activité (§7).';
comment on column public.agency_activation.score is
  'Recalculé la nuit (étape 8). `computed_at` dit QUAND : un score de 0 sans date de calcul '
  'et un score de 0 mesuré ne se distinguent pas autrement, et l''écran afficherait « à '
  'risque » sur une agence jamais évaluée.';

create index if not exists agency_activation_status_idx on public.agency_activation (status, last_activity_at desc);

alter table public.agency_activation enable row level security;
revoke all on table public.agency_activation from public, anon, authenticated, service_role;
-- SELECT au service_role, contrairement au registre admin_log : cette table est de la
-- donnee DERIVEE, recalculable a tout moment, pas un scelle. La lui fermer n'apportait
-- aucune garantie et obligeait les edges a passer par une fonction pour une simple lecture.
-- L'ECRITURE, elle, reste fermee a tous : seule la RPC de recalcul y touche.
grant select on table public.agency_activation to authenticated, service_role;

drop policy if exists agency_activation_select_super_admin on public.agency_activation;
create policy agency_activation_select_super_admin on public.agency_activation
  for select to authenticated using (public.is_super_admin());

-- ── 2. Miroir d'abonnement : trois colonnes, pas une seconde table ───────────────────

alter table public.subscriptions add column if not exists trial_end           timestamptz;
alter table public.subscriptions add column if not exists mrr_chf             numeric(10,2);
alter table public.subscriptions add column if not exists last_invoice_status text;

comment on column public.subscriptions.trial_end is
  'Fin d''essai (§5.7, file « essais qui finissent »). Écrite par stripe-webhook — l''événement '
  'customer.subscription.trial_will_end n''est PAS encore traité par l''edge : la colonne '
  'restera nulle tant que l''étape 7 ne l''aura pas branché.';
comment on column public.subscriptions.mrr_chf is
  'MRR de la ligne. Règle de comptage §4.3 : essai, impayé, suspendu et Starter (0 CHF) '
  'comptent ZÉRO. Ne pas recalculer côté front.';
comment on column public.subscriptions.last_invoice_status is
  'Dernier statut de facture (§5.7, file des impayés).';

-- ── 3. Cohérence du catalogue de prix ────────────────────────────────────────────────
--
-- §4.2 interdit une troisième source de prix. Elle existe déjà : app_config.plan_pricing,
-- lue par compute_platform_mrr_estimate(). Elle coïncide aujourd'hui avec src/lib/plans.ts
-- (0/0 · 89/71 · 249/199) sans qu'aucun test ne le garantisse — et rien ne les resynchronise.
-- Cette fonction rend l'écart plutôt que de le laisser dériver en silence ; le test qui la
-- consomme porte les valeurs du catalogue TS, seule source de vérité (C2).

drop function if exists public.admin_plan_pricing_drift(jsonb);
create or replace function public.admin_plan_pricing_drift(p_catalogue jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_base jsonb;
  v_ecarts jsonb;
begin
  -- PAS de branche `session_user` ici, contrairement aux fonctions du registre : celle-ci
  -- n'est appelée par aucun cron, seulement par un test en service_role. Recopier la
  -- branche par habitude aurait élargi d'une unité l'ensemble que le balayage de gardes
  -- doit écarter — et c'est précisément ce que son seuil interdit.
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin or service only' using errcode = '42501';
  end if;

  select value into v_base from public.app_config where key = 'plan_pricing';
  if v_base is null then
    return jsonb_build_object('status', 'no_base', 'ecarts', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'plan', k, 'base', v_base -> k, 'catalogue', p_catalogue -> k)), '[]'::jsonb)
    into v_ecarts
    from jsonb_object_keys(p_catalogue) k
   where (v_base -> k) is distinct from (p_catalogue -> k);

  return jsonb_build_object(
    'status', case when jsonb_array_length(v_ecarts) = 0 then 'ok' else 'drift' end,
    'ecarts', v_ecarts,
    'plans_base', (select jsonb_agg(k order by k) from jsonb_object_keys(v_base) k)
  );
end;
$function$;

comment on function public.admin_plan_pricing_drift(jsonb) is
  'Compare app_config.plan_pricing au catalogue src/lib/plans.ts passé en argument. Rend '
  'l''écart au lieu de le supposer nul : les deux sources sont indépendantes et rien ne les '
  'synchronise. Consommée par un test, pas par un écran.';

revoke all on function public.admin_plan_pricing_drift(jsonb) from public, anon;
grant execute on function public.admin_plan_pricing_drift(jsonb) to authenticated, service_role;

-- ── 4. Prérequis du flux Live (§3, §5.2) ─────────────────────────────────────────────
--
-- §3 et §5.2 tiennent le Realtime pour acquis. Mesuré : la publication `supabase_realtime`
-- ne contient QU'UNE table, `crm_offers`. `useAdminLiveFeed` s'abonne pourtant correctement
-- en postgres_changes — la subscription se connecte, ne reçoit jamais rien, et ne lève
-- aucune erreur. Le Live existant n'est donc pas temps réel, et rien ne le signalait.
--
-- Garde sur l'existence de la publication : en base fraîche de CI, elle peut manquer.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_events'
     )
  then
    alter publication supabase_realtime add table public.activity_events;
  end if;
end $$;
