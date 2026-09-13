// LECTURES EXPOSÉES À TOUTE SESSION — refermées (20260913170000, audit du 13.09.2026, S13).
//
// Trois portes, trois preuves, chacune avec son contrôle positif (un refus sans témoin ne
// prouve rien : il pourrait venir d'une RLS, d'une fonction absente ou d'une faute de frappe) :
//   1. compute_agent_preferences : plus appelable par un agent — le service, oui ;
//   2. is_agency_lab_cleared : ne répond plus pour une AUTRE agence — pour la sienne, si ;
//   3. agencies / subscriptions : les colonnes de facturation répondent 42501 à un membre,
//      tout le reste lui répond, et le service lit tout.
// La troisième porte a un revers écrit dans la migration : une colonne ajoutée demain naît
// illisible pour authenticated. Le test « couverture » ci-dessous en fait un échec BRUYANT
// au lieu d'une panne en production.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSql } from './helpers/local-sql'
import { serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const DENIED = '42501'

/** Colonnes qui restent au serveur — miroir de la migration 20260913170000. */
const SECRETES: Record<'agencies' | 'subscriptions', string[]> = {
  agencies: ['stripe_customer_id'],
  subscriptions: [
    'stripe_customer_id', 'stripe_subscription_id', 'stripe_price_id',
    'price', 'mrr_chf', 'last_invoice_status', 'last_stripe_event_at',
  ],
}

/** Lève (via ON_ERROR_STOP) si l'assertion SQL est fausse, en nommant les coupables. */
function assertSql(sql: string): void {
  execSql(`do $$ declare v_list text; begin ${sql} end $$;`)
}

const listeSql = (cols: string[]) => cols.map((c) => `'${c}'`).join(', ')

describe('LECTURES EXPOSÉES — catalogue', () => {
  it('compute_agent_preferences : fermée à anon et authenticated, ouverte au service', () => {
    expect(() =>
      assertSql(`
        if has_function_privilege('authenticated', 'public.compute_agent_preferences(uuid)', 'EXECUTE')
           or has_function_privilege('anon', 'public.compute_agent_preferences(uuid)', 'EXECUTE') then
          raise exception 'compute_agent_preferences exécutable par un rôle client';
        end if;
        if not has_function_privilege('service_role', 'public.compute_agent_preferences(uuid)', 'EXECUTE') then
          raise exception 'service_role a perdu compute_agent_preferences';
        end if;`),
    ).not.toThrow()
  })

  it.each(Object.entries(SECRETES))('%s : aucune colonne secrète lisible par authenticated', (table, cols) => {
    expect(() =>
      assertSql(`
        select string_agg(c, ', ') into v_list
          from unnest(array[${listeSql(cols)}]) as c
         where has_column_privilege('authenticated', 'public.${table}', c, 'SELECT');
        if v_list is not null then raise exception 'secrète lisible : %', v_list; end if;`),
    ).not.toThrow()
  })

  // Le revers de la migration, rendu bruyant : toute colonne NON secrète doit être lisible.
  // Une migration qui ajoute une colonne sans l'accorder rougit ICI, pas en production.
  it.each(Object.entries(SECRETES))('%s : toute colonne non secrète reste lisible (couverture)', (table, cols) => {
    expect(() =>
      assertSql(`
        select string_agg(column_name, ', ') into v_list
          from information_schema.columns
         where table_schema = 'public' and table_name = '${table}'
           and column_name <> all (array[${listeSql(cols)}])
           and not has_column_privilege('authenticated', 'public.${table}', column_name, 'SELECT');
        if v_list is not null then
          raise exception 'colonne(s) de ${table} illisible(s) pour authenticated — les accorder ou les déclarer secrètes : %', v_list;
        end if;
        -- Témoin : la mesure sait dire « lisible » (sinon la boucle ci-dessus serait vacante).
        if not has_column_privilege('authenticated', 'public.${table}', 'id', 'SELECT') then
          raise exception 'contrôle positif : id de ${table} devrait être lisible';
        end if;`),
    ).not.toThrow()
  })
})

describe.skipIf(!HAS_KEYS)('LECTURES EXPOSÉES — comportement', () => {
  let setup: TwoAgenciesSetup
  const service = serviceRoleClient()

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    // Agence B vérifiée, agence A non : l'oracle aurait quelque chose à révéler.
    const { error: e1 } = await service.from('agencies')
      .update({ verification_status: 'validated' }).eq('id', setup.agencyBId)
    if (e1) throw new Error(`seed agencies B: ${e1.message}`)
    const { error: e2 } = await service.from('agencies')
      .update({ stripe_customer_id: `cus_test_${setup.stamp}` }).eq('id', setup.agencyAId)
    if (e2) throw new Error(`seed agencies A: ${e2.message}`)
    const { error: e3 } = await service.from('subscriptions').insert({
      agency_id: setup.agencyAId,
      stripe_customer_id: `cus_test_${setup.stamp}`,
      plan: 'pro',
      status: 'active',
      mrr_chf: 89,
      current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    })
    if (e3) throw new Error(`seed subscriptions: ${e3.message}`)
  })

  afterAll(async () => {
    await service.from('subscriptions').delete().eq('agency_id', setup.agencyAId)
    await setup.cleanup()
  })

  it('compute_agent_preferences : un agent est refusé (42501), le service passe', async () => {
    const agent = await setup.clientA.rpc('compute_agent_preferences', { p_agent_id: setup.agentBId })
    expect(agent.error?.code).toBe(DENIED)
    // Contrôle positif : la fonction existe et répond au service (NULL = agent non calibré).
    const svc = await service.rpc('compute_agent_preferences', { p_agent_id: setup.agentBId })
    expect(svc.error).toBeNull()
  })

  it('is_agency_lab_cleared : l’agent A n’apprend rien de l’agence B, B se lit elle-même', async () => {
    const autre = await setup.clientA.rpc('is_agency_lab_cleared', { p_agency_id: setup.agencyBId })
    expect(autre.error).toBeNull()
    expect(autre.data).toBe(false)
    // Contrôle positif : la MÊME question posée par un membre de B rend la vérité.
    const soi = await setup.clientB.rpc('is_agency_lab_cleared', { p_agency_id: setup.agencyBId })
    expect(soi.error).toBeNull()
    expect(soi.data).toBe(true)
  })

  it('agencies : stripe_customer_id et select(*) répondent 42501 à un membre', async () => {
    const col = await setup.clientA.from('agencies').select('stripe_customer_id').eq('id', setup.agencyAId)
    expect(col.error?.code).toBe(DENIED)
    const tout = await setup.clientA.from('agencies').select('*').eq('id', setup.agencyAId)
    expect(tout.error?.code).toBe(DENIED)
  })

  it('CONTRÔLE POSITIF — agencies : ce que lisent les écrans reste lisible', async () => {
    const { data, error } = await setup.clientA.from('agencies')
      .select('name, plan, billing, verification_status, identity_submitted_at')
      .eq('id', setup.agencyAId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('subscriptions : les colonnes financières répondent 42501, la période en cours se lit', async () => {
    for (const col of ['mrr_chf', 'stripe_customer_id', 'price']) {
      const r = await setup.clientA.from('subscriptions').select(col).eq('agency_id', setup.agencyAId)
      expect(r.error?.code, col).toBe(DENIED)
    }
    const tout = await setup.clientA.from('subscriptions').select('*').eq('agency_id', setup.agencyAId)
    expect(tout.error?.code).toBe(DENIED)
    // Contrôle positif : la requête EXACTE de useSubscription passe et rend la ligne.
    const ecran = await setup.clientA.from('subscriptions')
      .select('id, agency_id, plan, billing_period, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at')
      .maybeSingle()
    expect(ecran.error).toBeNull()
    expect(ecran.data?.plan).toBe('pro')
  })

  it('CONTRÔLE POSITIF — le service (checkout, portail, webhook) lit toujours la facturation', async () => {
    const { data, error } = await service.from('subscriptions')
      .select('stripe_customer_id, mrr_chf').eq('agency_id', setup.agencyAId).single()
    expect(error).toBeNull()
    expect(data?.stripe_customer_id).toBe(`cus_test_${setup.stamp}`)
  })
})
