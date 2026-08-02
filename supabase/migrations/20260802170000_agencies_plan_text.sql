-- Décision PO n° 3 — `agencies.plan` quitte l'enum pour du `text` + CHECK.
--
-- LE DÉFAUT, REPRODUIT EN PRODUCTION LE 02.08.2026 :
--
--   select 'entreprise'::public.agency_plan;
--   ERROR: 22P02: invalid input value for enum agency_plan: "entreprise"
--
-- Trois vocabulaires coexistaient pour la même notion :
--   • enum `agency_plan`      : starter · pro · agency · enterprise
--   • catalogue `src/lib/plans.ts` et `subscriptions_plan_check` : starter · pro · entreprise
--   • `admin_create_agency` / `admin_set_agency_plan` validaient DÉJÀ le vocabulaire du
--     catalogue, puis castaient vers l'enum — donc toute agence « Entreprise » passait le
--     contrôle applicatif pour mourir au cast. Le geste était inutilisable par construction,
--     pas seulement fragile.
--
-- POURQUOI `text` + CHECK PLUTÔT QU'AJOUTER `entreprise` À L'ENUM. Ajouter la valeur
-- laisserait cohabiter `entreprise` ET `enterprise`, plus `agency` qui ne sert à personne :
-- on échangerait un 22P02 franc contre une ambiguïté durable, et il faudrait ensuite décider
-- lequel fait foi. `subscriptions.plan` est DÉJÀ `text` avec exactement ce CHECK
-- (`starter|pro|entreprise`) : aligner les deux colonnes supprime le troisième vocabulaire
-- au lieu d'en ajouter un quatrième. `agency_mrr` documentait déjà cette divergence.
--
-- SANS MIGRATION DE DONNÉES : les 10 agences de production sont toutes `starter` (mesuré).
-- Aucune ligne ne porte `agency` ni `enterprise`, donc le CHECK passe sur l'existant.
--
-- ⚠ La colonne est PARTAGÉE avec le CRM. Le type TypeScript `AgencyPlan`
-- (`src/hooks/useAgencySettings.ts`) et son `Record<AgencyPlan, …>` mobile suivent dans la
-- même PR — `tsc` échoue sinon, ce qui est le comportement voulu.

-- ── 1. La colonne passe en text ───────────────────────────────────────────────
-- Gardé : le date-guard de deploy.yml REJOUE cette migration à chaque déploiement du jour.
-- Sans la garde, chaque rejeu réécrirait la table pour un no-op.
do $$
begin
  if (select udt_name
        from information_schema.columns
       where table_schema = 'public' and table_name = 'agencies' and column_name = 'plan')
     <> 'text'
  then
    alter table public.agencies alter column plan drop default;
    alter table public.agencies alter column plan type text using plan::text;
    alter table public.agencies alter column plan set default 'starter';
  end if;
end $$;

-- ── 2. Le vocabulaire du catalogue, identique à subscriptions_plan_check ──────
alter table public.agencies drop constraint if exists agencies_plan_check;
alter table public.agencies add constraint agencies_plan_check
  check (plan in ('starter', 'pro', 'entreprise'));

-- ── 3. Les deux gestes cessent de caster vers un type qui n'existera plus ─────
-- Corps repris VERBATIM de la production (pg_get_functiondef), seul le cast disparaît :
-- rien d'autre ne change, et surtout pas leur journalisation — `admin_set_agency_plan`
-- écrit dans `activity_events` et fait partie de la DETTE nommée par l'étape 23 ; la
-- rembourser est le travail de l'étape 17/18, pas celui de cette migration, et la modifier
-- ici ferait rougir le cliquet d'`admin-gestes-sweep.spec.ts`.

create or replace function public.admin_create_agency(
  p_name text, p_city text default null, p_canton text default null,
  p_plan text default 'starter', p_solo boolean default false, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_slug text;
  v_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin required' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'agency name too short';
  end if;
  if p_plan not in ('starter', 'pro', 'entreprise') then
    raise exception 'invalid plan: %', p_plan;
  end if;

  -- Anti-doublon explicite (message clair) — le unique index sur
  -- lower(btrim(name)) reste le backstop en cas de course.
  if exists (select 1 from agencies where lower(btrim(name)) = lower(btrim(p_name))) then
    raise exception 'agency name already exists' using errcode = '23505';
  end if;

  v_slug := lower(regexp_replace(btrim(p_name), '\s+', '-', 'g'));
  if exists (select 1 from agencies where slug = v_slug) then
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
  end if;

  -- Contexte lu par trg_agency_created. Local à la transaction.
  perform set_config(
    'megga.agency_create_ctx',
    jsonb_build_object('admin_created', true, 'note', p_note)::text,
    true
  );

  insert into agencies (name, slug, city, canton, solo, plan, status, created_by)
  values (btrim(p_name), v_slug, nullif(btrim(coalesce(p_city, '')), ''), p_canton,
          coalesce(p_solo, false), p_plan, 'active', auth.uid())
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.admin_set_agency_plan(
  p_agency_id uuid, p_plan text, p_status text default 'active', p_note text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_old_plan text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin required' using errcode = '42501';
  end if;
  if p_plan not in ('starter', 'pro', 'entreprise') then
    raise exception 'invalid plan: %', p_plan;
  end if;
  if p_status not in ('active', 'trialing', 'past_due', 'canceled') then
    raise exception 'invalid status: %', p_status;
  end if;

  select plan into v_old_plan from public.agencies where id = p_agency_id;
  if v_old_plan is null then
    raise exception 'agency not found';
  end if;

  -- `agencies.plan` est désormais du text avec le MÊME CHECK que `subscriptions.plan` :
  -- plus aucun cast, et les deux tables ne peuvent plus diverger de vocabulaire.
  update public.agencies set plan = p_plan where id = p_agency_id;

  -- Upsert de la ligne subscriptions. ⚠ Limitation documentée : un webhook
  -- Stripe ultérieur pour cette agence réécrira cette ligne — l'override
  -- manuel est pensé pour les comptes SANS abonnement Stripe (comp/partenaire).
  insert into public.subscriptions (agency_id, stripe_customer_id, plan, status)
  values (p_agency_id, 'manual_' || p_agency_id, p_plan, p_status)
  on conflict (agency_id) do update
    set plan = excluded.plan,
        status = excluded.status,
        updated_at = now();

  insert into activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  values (
    p_agency_id, auth.uid(), 'user', 'subscription_changed', 'agency', p_agency_id,
    'settings', 'warn', p_plan,
    jsonb_build_object('old_plan', v_old_plan, 'new_plan', p_plan, 'status', p_status,
                       'note', p_note, 'manual_override', true)
  );
end;
$function$;

-- ── 4. Le troisième vocabulaire disparaît ────────────────────────────────────
-- Mesuré : `agency_plan` ne servait qu'à `agencies.plan`. Une fois la colonne en text,
-- plus rien n'en dépend. Le laisser serait garder l'ambiguïté qu'on vient de retirer.
drop type if exists public.agency_plan;
