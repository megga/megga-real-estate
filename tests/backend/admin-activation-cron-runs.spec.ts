// Backend integration spec (live CI) — activation des agences et historique des crons
// (migration 20260801250000, étapes 8 et 12, spec §4.2/§5.1/§5.3/§5.8/§7).
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

  it('le statut suit la dernière activité, pas le nombre de jalons', () => {
    // Contrôler `last_activity_at` demande deux précautions, apprises en CI :
    //  · l'agence de fixture porte des événements récents, et last_activity_at est un
    //    max() : le plus récent gagne toujours. D'où une agence dédiée.
    //  · créer une agence ÉMET elle-même un activity_events (trg_agency_created), daté de
    //    maintenant. Et il est impossible de le vieillir ou de l'effacer après coup :
    //    activity_events refuse l'UPDATE comme le DELETE. Le trigger est donc neutralisé
    //    le temps de l'insertion, seul moyen d'obtenir une agence sans activité récente.
    assertSql(`
    declare v_id uuid;
    begin
      alter table public.agencies disable trigger trg_agency_created;
      insert into public.agencies (name, slug)
        values ('Activation probe', 'activation-probe-' || gen_random_uuid())
        returning id into v_id;
      alter table public.agencies enable trigger trg_agency_created;

      insert into public.activity_events (agency_id, actor_kind, action, entity_type, created_at)
        values (v_id, 'system', 'test_activation', 'test', now() - interval '15 days');
      perform public.recompute_agency_activation(v_id);
      if (select status from public.agency_activation where agency_id = v_id) <> 'atRisk' then
        raise exception '15 jours d inactivite doivent donner atRisk, pas %',
          (select status from public.agency_activation where agency_id = v_id);
      end if;

      -- Un événement récent bascule la même agence en 'active' : c'est bien la RÉCENCE
      -- qui décide, pas le nombre de jalons, qui n'a pas bougé.
      insert into public.activity_events (agency_id, actor_kind, action, entity_type)
        values (v_id, 'system', 'test_activation_recent', 'test');
      perform public.recompute_agency_activation(v_id);
      if (select status from public.agency_activation where agency_id = v_id) <> 'active' then
        raise exception 'un evenement recent doit donner active';
      end if;

      delete from public.agencies where id = v_id;
    `)
  })

  it('le calcul ne diverge pas de get_onboarding_milestones — même source', async () => {
    // Si les deux calculs se séparaient, l'écran Agences et le tracker de la Vue d'ensemble
    // afficheraient deux vérités sur la même agence, sans qu'aucune erreur ne le dise.
    //
    // Appel en service_role, jamais depuis psql : get_onboarding_milestones porte depuis
    // 20260731190000 une garde `is_super_admin() OR is_service_role()` qui n'admet PAS
    // session_user = postgres — délibérément, aucun cron ne l'appelle.
    const svc = serviceRoleClient()
    await svc.rpc('recompute_agency_activation', { p_agency_id: setup.agencyAId })

    const { data: milestones, error: mErr } = await svc.rpc('get_onboarding_milestones', {
      agency_ids: [setup.agencyAId],
    })
    expect(mErr, 'le service_role passe la garde').toBeNull()
    const m = (milestones as Record<string, boolean>[])[0]

    const { data: a } = await svc
      .from('agency_activation')
      .select('first_contact_at, first_property_at, first_kyc_at, first_deal_at, first_match_at')
      .eq('agency_id', setup.agencyAId)
      .single()

    expect(m.has_contact, 'contacts').toBe(a!.first_contact_at !== null)
    expect(m.has_property, 'biens').toBe(a!.first_property_at !== null)
    expect(m.has_kyc, 'KYC').toBe(a!.first_kyc_at !== null)
    expect(m.has_transaction, 'transactions').toBe(a!.first_deal_at !== null)
    expect(m.has_match, 'matchs').toBe(a!.first_match_at !== null)
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

  it('une limite démesurée est ramenée au plafond, jamais honorée', async () => {
    // Le piège relevé sur get_admin_kyc_magic_links : un `greatest()` seul est un plancher,
    // et un appelant demandant un million de lignes obtient la table entière.
    // Appel en service_role : la garde n'admet pas session_user = postgres, donc psql ne
    // peut pas l'exercer.
    const { data, error } = await serviceRoleClient().rpc('get_admin_cron_runs', {
      p_jobname: null, p_limit: 1_000_000,
    })
    expect(error).toBeNull()
    expect((data as unknown[] ?? []).length, 'plafond à 200 lignes').toBeLessThanOrEqual(200)
  })
})
