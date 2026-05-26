// RLS isolation — transactions (deals pipeline = argent + commissions).
// Critique business : si agence A voit les deals d'agence B, leak commercial.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, findLeakedRows, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — transactions', () => {
  let setup: TwoAgenciesSetup
  let dealAId: string
  let dealBId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const { data: dealA, error: errA } = await service
      .from('transactions')
      .insert({ agency_id: setup.agencyAId })
      .select('id')
      .single()
    if (errA) throw new Error(`dealA: ${errA.message}`)
    dealAId = dealA.id

    const { data: dealB, error: errB } = await service
      .from('transactions')
      .insert({ agency_id: setup.agencyBId })
      .select('id')
      .single()
    if (errB) throw new Error(`dealB: ${errB.message}`)
    dealBId = dealB.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (dealAId) await service.from('transactions').delete().eq('id', dealAId)
    if (dealBId) await service.from('transactions').delete().eq('id', dealBId)
    await setup.cleanup()
  })

  // NOTE: the only SELECT policy on `transactions` is `super_admin_read_all_transactions`.
  // Regular agents do NOT have a SELECT policy on this table directly — they must
  // read via an authorized view or RPC. So both "agent sees own deal" and "agent
  // sees other deal" should return empty for non-super-admin users. That's still
  // a valid isolation guarantee — strictly stronger than per-agency RLS.
  it('agent A cannot SELECT any transaction directly (RLS deny by default)', async () => {
    const { data } = await setup.clientA.from('transactions').select('id').eq('id', dealAId)
    expect(data, `unexpected SELECT access to transactions for agent A`).toEqual([])
  })

  it('agent A CANNOT see deal B either (cross-tenant guarantee)', async () => {
    const { data } = await setup.clientA.from('transactions').select('id').eq('id', dealBId)
    expect(data, `agent A leaked deal B (financial data!)`).toEqual([])
  })

  it('agent B cannot SELECT any transaction directly (RLS deny by default)', async () => {
    const { data } = await setup.clientB.from('transactions').select('id').eq('id', dealBId)
    expect(data, `unexpected SELECT access to transactions for agent B`).toEqual([])
  })

  it('agent B CANNOT see deal A either (cross-tenant guarantee)', async () => {
    const { data } = await setup.clientB.from('transactions').select('id').eq('id', dealAId)
    expect(data, `agent B leaked deal A (financial data!)`).toEqual([])
  })

  it('agent A list query returns NO deals from other agencies', async () => {
    const leaked = await findLeakedRows(setup.clientA, 'transactions', setup.agencyAId)
    expect(leaked, `agent A leaked ${leaked.length} cross-tenant deals`).toEqual([])
  })

  it('agent B list query returns NO deals from other agencies', async () => {
    const leaked = await findLeakedRows(setup.clientB, 'transactions', setup.agencyBId)
    expect(leaked, `agent B leaked ${leaked.length} cross-tenant deals`).toEqual([])
  })
})
