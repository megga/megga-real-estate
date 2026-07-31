// Backend integration spec (live CI) — activation des agences et historique des crons
// (migration 20260731250000, étapes 8 et 12, spec §4.2/§5.1/§5.3/§5.8/§7).
//
// Deux propriétés comptent plus que les valeurs elles-mêmes :
//   · le calcul d'activation ABSORBE get_onboarding_milestones() sans la doubler — mêmes
//     sources, rendues en timestamps ; si les deux divergeaient, l'écran Agences et le
//     tracker de la Vue d'ensemble afficheraient deux vérités sur la même agence ;
//   · aucune table `cron_runs` n'a été créée : l'historique vient de cron.job_run_details.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI — lire le compte de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const DENIED = '42501'

const runSql = (body: string) => execSql(`do $$\n${body}\nend $$;`)
const assertSql = (body: string) => expect(() => runSql(body), 'assertion SQL').not.toThrow()

describe.skipIf(!HAS_KEYS)('activation des agences et historique des crons (étapes 8, 12)', () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => { setup = await setupTwoAgencies() })
  afterAll(async () => {
    if (setup) {
      await serviceRoleClient().from('agency_activation').delete().eq('agency_id', setup.agencyAId)
      await setup.cleanup()
    }
  })

  // ── Activation ─────────────────────────────────────────────────────────────────

  it('le calcul remplit les jalons et pose un score cohérent', async () => {
    const svc = serviceRoleClient()
    const { data: rows, error } = await svc.rpc('recompute_agency_activation', {
      p_agency_id: setup.agencyAId,
    })
    expect(error, 'le service_role doit pouvoir déclencher le calcul').toBeNull()
    expect(Number(rows), 'une agence recalculée').toBeGreaterThan(0)

    const { data } = await svc
      .from('agency_activation')
      .select('signed_up_at, score, status, computed_at')
      .eq('agency_id', setup.agencyAId)
      .maybeSingle()

    // L'agence de fixture vient d'être créée : elle a signed_up_at et rien d'autre.
    expect(data?.signed_up_at, 'signed_up_at vient de agencies.created_at').toBeTruthy()
    expect(Number(data?.score), '1 jalon sur 6 → 17').toBe(17)
    expect(data?.computed_at, 'un score sans date de calcul ne se distingue pas d\'un score nul').toBeTruthy()
  })

  it('le statut suit la dernière activité, pas le nombre de jalons', async () => {
    // Une agence peut avoir six jalons et être dormante : ce sont deux axes distincts, et
    // l'écran les affiche séparément (score et pilule de statut).
    assertSql(`
    begin
      insert into public.activity_events (agency_id, actor_kind, action, entity_type, created_at)
        values ('${'$'}{AGENCY}'::uuid, 'system', 'test_activation', 'test', now() - interval '15 days');
      perform public.recompute_agency_activation('${'$'}{AGENCY}'::uuid);
      if (select status from public.agency_activation where agency_id = '${'$'}{AGENCY}'::uuid) <> 'atRisk' then
        raise exception '15 jours d inactivite doivent donner atRisk, pas %',
          (select status from public.agency_activation where agency_id = '${'$'}{AGENCY}'::uuid);
      end if;
    `.replace(/\$\{AGENCY\}/g, setup.agencyAId))
  })

  it('le calcul ne diverge pas de get_onboarding_milestones — même source', () => {
    // Si les deux calculs se séparaient, l'écran Agences et le tracker de la Vue d'ensemble
    // afficheraient deux vérités sur la même agence, sans qu'aucune erreur ne le dise.
    assertSql(`
    declare r record;
    begin
      perform public.recompute_agency_activation('${'$'}{AGENCY}'::uuid);
      select m.has_contact, m.has_property, m.has_kyc, m.has_transaction, m.has_match,
             a.first_contact_at, a.first_property_at, a.first_kyc_at,
             a.first_deal_at, a.first_match_at
        into r
        from public.get_onboarding_milestones(array['${'$'}{AGENCY}'::uuid]) m
        join public.agency_activation a on a.agency_id = '${'$'}{AGENCY}'::uuid;

      if r.has_contact     <> (r.first_contact_at  is not null)
      or r.has_property    <> (r.first_property_at is not null)
      or r.has_kyc         <> (r.first_kyc_at      is not null)
      or r.has_transaction <> (r.first_deal_at     is not null)
      or r.has_match       <> (r.first_match_at    is not null) then
        raise exception 'divergence entre get_onboarding_milestones et agency_activation';
      end if;
    `.replace(/\$\{AGENCY\}/g, setup.agencyAId))
  })

  it('un agent ne peut ni déclencher le calcul ni lire la table', async () => {
    const { error } = await setup.clientA.rpc('recompute_agency_activation', {})
    expect(error, 'la RPC n\'est pas accordée à authenticated').not.toBeNull()

    const { data } = await setup.clientA.from('agency_activation').select('agency_id').limit(1)
    expect(data ?? [], 'la RLS ne laisse rien voir à un agent').toHaveLength(0)
  })

  it('le calcul est réservé au cron et au service — jamais à la console', () => {
    // Elle porte la branche `session_user` que pg_cron exige. La réserver à service_role la
    // sort du balayage de gardes du Lot 0 sans en consommer le budget d'écart, qui est de
    // quatre fonctions — et la console n'a aucune raison de déclencher un recalcul.
    assertSql(`
    begin
      if has_function_privilege('authenticated', 'public.recompute_agency_activation(uuid)', 'EXECUTE') then
        raise exception 'recompute_agency_activation accordee a authenticated : elle entrerait dans le balayage';
      end if;
      if not has_function_privilege('service_role', 'public.recompute_agency_activation(uuid)', 'EXECUTE') then
        raise exception 'service_role a perdu EXECUTE : le cron nocturne est casse';
      end if;
    `)
  })

  // ── Historique des crons ───────────────────────────────────────────────────────

  it('aucune table cron_runs — l\'historique vient de cron.job_run_details', () => {
    assertSql(`
    begin
      if to_regclass('public.cron_runs') is not null then
        raise exception 'cron_runs creee alors que cron.job_run_details la couvre';
      end if;
      if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname='public' and p.proname='get_admin_cron_runs') then
        raise exception 'get_admin_cron_runs absente : aucun chemin de lecture vers l historique';
      end if;
    `)
  })

  it('la lecture de l\'historique est bornée et gardée', async () => {
    const svc = serviceRoleClient()
    const { error } = await svc.rpc('get_admin_cron_runs', { p_limit: 5 })
    expect(error, 'le service_role lit l\'historique').toBeNull()

    const agent = await setup.clientA.rpc('get_admin_cron_runs', {})
    expect(agent.error?.code, 'un agent est refusé').toBe(DENIED)
  })

  it('une limite démesurée est ramenée au plafond, jamais honorée', () => {
    // Le piège relevé sur get_admin_kyc_magic_links : un `greatest()` seul est un plancher,
    // et un appelant demandant un million de lignes obtient la table entière.
    assertSql(`
    declare v_n int;
    begin
      select count(*) into v_n from public.get_admin_cron_runs(null, 1000000);
      if v_n > 200 then
        raise exception 'plafond non applique : % lignes rendues', v_n;
      end if;
    `)
  })
})
