// RLS isolation — properties (biens immobiliers internes).
// Agency A's properties must never leak to agent B and vice versa.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, findLeakedRows, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — properties', () => {
  let setup: TwoAgenciesSetup
  let propertyAId: string
  let propertyBId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const { data: propA, error: errA } = await service
      .from('properties')
      .insert({ agency_id: setup.agencyAId, title: `Test Property A ${setup.stamp}` })
      .select('id')
      .single()
    if (errA) throw new Error(`propA: ${errA.message}`)
    propertyAId = propA.id

    const { data: propB, error: errB } = await service
      .from('properties')
      .insert({ agency_id: setup.agencyBId, title: `Test Property B ${setup.stamp}` })
      .select('id')
      .single()
    if (errB) throw new Error(`propB: ${errB.message}`)
    propertyBId = propB.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (propertyAId) await service.from('properties').delete().eq('id', propertyAId)
    if (propertyBId) await service.from('properties').delete().eq('id', propertyBId)
    await setup.cleanup()
  })

  it('agent A sees property A only', async () => {
    const { data } = await setup.clientA.from('properties').select('id').eq('id', propertyAId)
    expect(data).toHaveLength(1)
  })

  it('agent A CANNOT see property B (RLS blocks)', async () => {
    const { data } = await setup.clientA.from('properties').select('id').eq('id', propertyBId)
    expect(data, `agent A leaked property B`).toEqual([])
  })

  it('agent B sees property B only', async () => {
    const { data } = await setup.clientB.from('properties').select('id').eq('id', propertyBId)
    expect(data).toHaveLength(1)
  })

  it('agent B CANNOT see property A (RLS blocks)', async () => {
    const { data } = await setup.clientB.from('properties').select('id').eq('id', propertyAId)
    expect(data, `agent B leaked property A`).toEqual([])
  })

  it('agent A list query returns NO rows from other agencies', async () => {
    const leaked = await findLeakedRows(setup.clientA, 'properties', setup.agencyAId)
    expect(leaked, `agent A leaked ${leaked.length} cross-tenant rows`).toEqual([])
  })

  it('agent B list query returns NO rows from other agencies', async () => {
    const leaked = await findLeakedRows(setup.clientB, 'properties', setup.agencyBId)
    expect(leaked, `agent B leaked ${leaked.length} cross-tenant rows`).toEqual([])
  })
})
