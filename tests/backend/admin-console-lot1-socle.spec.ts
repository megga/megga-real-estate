// Backend integration spec (live CI) — socle de lecture du Lot 1
// (migration 20260801230000, étape 5, spec §4.2/§4.3/§5.7/§10.6).
//
// L'essentiel de l'étape 5 est ce qu'elle NE crée PAS : §4.2 annonce onze objets, l'inventaire
// en a ramené six, ce fichier n'en pose qu'un. Les tests portent donc autant sur les absences
// que sur les présences — une seconde table d'abonnement créée par distraction est exactement
// le risque n°1 du plan, et rien d'autre ne la détecterait.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI — lire le compte de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

/** Le catalogue de src/lib/plans.ts, seule source de vérité des prix (spec §2 C2). */
const CATALOGUE = {
  starter: { monthly: 0, yearly: 0 },
  pro: { monthly: 89, yearly: 71 },
  entreprise: { monthly: 249, yearly: 199 },
}

const runSql = (body: string) => execSql(`do $$\n${body}\nend $$;`)
const assertSql = (body: string) => expect(() => runSql(body), 'assertion SQL').not.toThrow()

describe.skipIf(!HAS_KEYS)('socle de lecture du Lot 1 (étape 5)', () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => { setup = await setupTwoAgencies() })
  afterAll(async () => { if (setup) await setup.cleanup() })

  // ── Ce qui n'a PAS été créé ────────────────────────────────────────────────────

  it('aucune seconde table d\'abonnement — `subscriptions` a été étendue', () => {
    assertSql(`
    begin
      if to_regclass('public.stripe_subscriptions') is not null then
        raise exception 'stripe_subscriptions cree : second miroir alimente par le meme webhook (risque n 1 du plan)';
      end if;
      if to_regclass('public.subscriptions') is null then
        raise exception 'subscriptions a disparu : le miroir Stripe n a plus de support';
      end if;
      -- Les trois colonnes qui manquaient réellement, et rien de plus.
      if not (exists (select 1 from information_schema.columns
                       where table_schema='public' and table_name='subscriptions' and column_name='trial_end')
          and exists (select 1 from information_schema.columns
                       where table_schema='public' and table_name='subscriptions' and column_name='mrr_chf')
          and exists (select 1 from information_schema.columns
                       where table_schema='public' and table_name='subscriptions' and column_name='last_invoice_status'))
      then
        raise exception 'les 3 colonnes de §4.2 manquent a subscriptions';
      end if;
    `)
  })

  it('ni `cron_runs`, ni `plan_config`, ni `incidents` — tous couverts par l\'existant', () => {
    assertSql(`
    declare v_crees text;
    begin
      select string_agg(n, ', ') into v_crees
        from unnest(array['cron_runs', 'plan_config', 'incidents']) n
       where to_regclass('public.' || n) is not null;
      if v_crees is not null then
        raise exception 'tables creees alors que l existant les couvre : %', v_crees;
      end if;
      -- Ce qui les couvre doit, lui, exister.
      if not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                      where ns.nspname='public' and p.proname='get_cron_health') then
        raise exception 'get_cron_health absente : rien ne couvre plus cron_runs';
      end if;
      if not exists (select 1 from public.app_config where key='plan_pricing') then
        raise exception 'app_config.plan_pricing absente : rien ne couvre plus plan_config';
      end if;
    `)
  })

  // ── Activation ─────────────────────────────────────────────────────────────────

  it('agency_activation porte des jalons en timestamps, pas en booléens', () => {
    assertSql(`
    declare v_manquants text;
    begin
      select string_agg(c, ', ') into v_manquants
        from unnest(array['signed_up_at','first_contact_at','first_property_at',
                          'first_kyc_at','first_deal_at','first_match_at']) c
       where not exists (
         select 1 from information_schema.columns
          where table_schema='public' and table_name='agency_activation'
            and column_name = c and data_type = 'timestamp with time zone');
      if v_manquants is not null then
        raise exception 'jalons absents ou non horodates : %', v_manquants;
      end if;
    `)
  })

  it('le statut n\'admet que les trois valeurs de la maquette', () => {
    // Écriture en `postgres`, jamais en service_role : celui-ci s'est vu révoquer l'INSERT,
    // délibérément. Conséquence pour l'étape 8 — le calcul nocturne du score écrira sous
    // pg_cron (postgres) ou par une fonction SECURITY DEFINER, jamais avec la clé de service.
    assertSql(`
    declare v_sqlstate text;
    begin
      insert into public.agency_activation (agency_id, status)
        values ('${'$'}{AGENCY}'::uuid, 'atRisk');
      begin
        update public.agency_activation set status = 'en_retard' where agency_id = '${'$'}{AGENCY}'::uuid;
        raise exception 'une valeur hors maquette a ete acceptee';
      exception when others then
        get stacked diagnostics v_sqlstate = returned_sqlstate;
        if v_sqlstate <> '23514' then raise exception 'attendu 23514, recu %', v_sqlstate; end if;
      end;
      delete from public.agency_activation where agency_id = '${'$'}{AGENCY}'::uuid;
    `.replace(/\$\{AGENCY\}/g, setup.agencyAId))
  })

  it('la table est fermée en écriture et en lecture aux agents', () => {
    assertSql(`
    begin
      if has_table_privilege('anon', 'public.agency_activation', 'SELECT')
         or has_table_privilege('service_role', 'public.agency_activation', 'INSERT')
         or has_table_privilege('authenticated', 'public.agency_activation', 'INSERT') then
        raise exception 'agency_activation est ecrivable ou lisible hors du chemin prevu';
      end if;
      if not (select relrowsecurity from pg_class where oid='public.agency_activation'::regclass) then
        raise exception 'RLS non activee sur agency_activation';
      end if;
    `)
  })

  it('get_onboarding_milestones reste le calcul de référence — non doublée', () => {
    // La table absorbe la RPC ; elle ne la remplace pas tant que l'étape 8 ne l'a pas
    // remplie. Supprimer la RPC ici casserait OnboardingTracker sans que rien ne le dise.
    assertSql(`
    begin
      if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname='public' and p.proname='get_onboarding_milestones') then
        raise exception 'get_onboarding_milestones supprimee : le tracker d activation n a plus de source';
      end if;
    `)
  })

  // ── Cohérence des prix ─────────────────────────────────────────────────────────

  it('app_config.plan_pricing ne dérive pas du catalogue src/lib/plans.ts', async () => {
    // Les deux sources sont indépendantes et rien ne les synchronise : ce test EST le
    // mécanisme. Il porte les valeurs du catalogue, seule source de vérité (§2 C2).
    const { data, error } = await serviceRoleClient().rpc('admin_plan_pricing_drift', {
      p_catalogue: CATALOGUE,
    })
    expect(error).toBeNull()
    expect(data?.status, `dérive détectée : ${JSON.stringify(data?.ecarts)}`).toBe('ok')
  })

  // ── Live ───────────────────────────────────────────────────────────────────────

  it('activity_events appartient à la publication realtime — sinon le Live est muet', () => {
    // Sans appartenance, une subscription postgres_changes se connecte, ne reçoit jamais
    // rien, et ne lève aucune erreur. C'est l'état mesuré avant cette migration, et §3
    // le tenait pour acquis.
    assertSql(`
    begin
      if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
        raise exception 'publication supabase_realtime absente : environnement inattendu';
      end if;
      if not exists (select 1 from pg_publication_tables
                      where pubname='supabase_realtime' and schemaname='public'
                        and tablename='activity_events') then
        raise exception 'activity_events hors publication : le flux Live serait muet et silencieux';
      end if;
    `)
  })
})
