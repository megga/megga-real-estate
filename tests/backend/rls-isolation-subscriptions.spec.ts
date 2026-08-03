// RLS isolation — subscriptions (miroir local de l'état Stripe).
//
// Régression du §6 de l'audit RLS du 03.08.2026 : `agents_own_agency` était
// `FOR ALL` avec `USING` mais SANS `WITH CHECK`. PostgreSQL réutilise alors le
// `USING` comme contrôle d'écriture — la policy n'était donc PAS en lecture seule,
// et tout membre d'une agence pouvait s'écrire un plan supérieur.
//
// La table est vide en production : ces tests sont le seul endroit où la règle
// est exercée avant que le premier abonnement Stripe n'arrive.
//
// Corrigé par 20260803150000_subscriptions_lecture_seule_agent.sql.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — subscriptions', () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    // CHECK : plan ∈ starter|pro|entreprise · status ∈ active|trialing|past_due|
    // canceled|unpaid|incomplete · billing_period ∈ monthly|yearly.
    // stripe_customer_id est NOT NULL sans défaut.
    const seed = async (agencyId: string, tag: string) => {
      const { error } = await service.from('subscriptions').insert({
        agency_id: agencyId,
        stripe_customer_id: `cus_${tag}_${setup.stamp}`,
        plan: 'starter',
        billing_period: 'monthly',
        status: 'active',
      })
      if (error) throw new Error(`seed ${tag}: ${error.message}`)
    }
    await seed(setup.agencyAId, 'a')
    await seed(setup.agencyBId, 'b')
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    await service.from('subscriptions')
      .delete()
      .in('agency_id', [setup.agencyAId, setup.agencyBId])
      .then(() => {}, () => {})
    await setup.cleanup()
  })

  it('agent A reads its own agency subscription (BillingSection must keep working)', async () => {
    const { data, error } = await setup.clientA
      .from('subscriptions')
      .select('agency_id, plan')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].agency_id).toBe(setup.agencyAId)
  })

  it('agent A does NOT see agency B subscription', async () => {
    const { data } = await setup.clientA
      .from('subscriptions')
      .select('agency_id')
      .eq('agency_id', setup.agencyBId)
    expect(data, 'billing data must not cross agencies').toHaveLength(0)
  })

  it('agent A CANNOT upgrade its own plan (was: self-serve escalation)', async () => {
    await setup.clientA
      .from('subscriptions')
      .update({ plan: 'entreprise' })
      .eq('agency_id', setup.agencyAId)

    const { data: after } = await serviceRoleClient()
      .from('subscriptions')
      .select('plan')
      .eq('agency_id', setup.agencyAId)
      .single()
    expect(after?.plan, 'plan is owned by the Stripe webhook, not the agent').toBe('starter')
  })

  it('agent A CANNOT insert a subscription row for its own agency', async () => {
    const { error } = await setup.clientA.from('subscriptions').insert({
      agency_id: setup.agencyAId,
      stripe_customer_id: `cus_forged_${setup.stamp}`,
      plan: 'entreprise',
      billing_period: 'yearly',
      status: 'active',
    })
    expect(error, 'no INSERT policy — RLS must reject').not.toBeNull()

    const { data: rows } = await serviceRoleClient()
      .from('subscriptions')
      .select('id')
      .eq('agency_id', setup.agencyAId)
    expect(rows, 'no second row may appear').toHaveLength(1)
  })

  it('agent A CANNOT delete its own subscription row', async () => {
    await setup.clientA.from('subscriptions').delete().eq('agency_id', setup.agencyAId)

    const { data: rows } = await serviceRoleClient()
      .from('subscriptions')
      .select('id')
      .eq('agency_id', setup.agencyAId)
    expect(rows, 'subscription row must survive an agent delete').toHaveLength(1)
  })

  it('agent B CANNOT touch agency A subscription', async () => {
    await setup.clientB
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('agency_id', setup.agencyAId)

    const { data: after } = await serviceRoleClient()
      .from('subscriptions')
      .select('status')
      .eq('agency_id', setup.agencyAId)
      .single()
    expect(after?.status, 'cross-agency billing write must not land').toBe('active')
  })
})
