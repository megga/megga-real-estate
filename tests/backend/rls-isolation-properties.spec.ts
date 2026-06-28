// RLS isolation — properties (biens immobiliers internes).
// Agency A's properties must never leak to agent B and vice versa.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, findLeakedRows, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — properties', () => {
  let setup: TwoAgenciesSetup
  let propertyAId: string
  let propertyBId: string
  // Bien ACTIF d'agence A : exerce le chemin de l'ancienne policy publique
  // (status='active'), seul cas qui déclenchait la fuite cross-agence/anon.
  let propertyAActiveId: string

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

    const { data: propActive, error: errActive } = await service
      .from('properties')
      .insert({ agency_id: setup.agencyAId, title: `Test Property A active ${setup.stamp}`, status: 'active' })
      .select('id')
      .single()
    if (errActive) throw new Error(`propActive: ${errActive.message}`)
    propertyAActiveId = propActive.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (propertyAId) await service.from('properties').delete().eq('id', propertyAId)
    if (propertyBId) await service.from('properties').delete().eq('id', propertyBId)
    if (propertyAActiveId) await service.from('properties').delete().eq('id', propertyAActiveId)
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

  // Régression de la fuite properties_select_public (policy publique status='active'
  // supprimée en 20260627130000). Un bien ACTIF d'agence A ne doit fuiter ni vers
  // un agent d'une autre agence, ni vers anon — chemin que les cas ci-dessus, qui
  // insèrent des biens en statut par défaut (draft), ne pouvaient pas exercer.
  it('agent B CANNOT see agency A ACTIVE property (no public leak)', async () => {
    const { data } = await setup.clientB.from('properties').select('id').eq('id', propertyAActiveId)
    expect(data, `agent B leaked agency A active property`).toEqual([])
  })

  it('anon CANNOT read agency A ACTIVE property (no public leak)', async () => {
    const anon = anonClient()
    const { data } = await anon.from('properties').select('id').eq('id', propertyAActiveId)
    expect(data ?? [], `anon leaked agency A active property`).toEqual([])
  })

  it('agent A still sees its own ACTIVE property (same-agency read intact)', async () => {
    const { data } = await setup.clientA.from('properties').select('id').eq('id', propertyAActiveId)
    expect(data).toHaveLength(1)
  })
})
