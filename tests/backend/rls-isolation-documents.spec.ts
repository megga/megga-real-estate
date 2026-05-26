// RLS isolation — documents (uploads clients : contrats, KYC docs, etc.).
// agency_id est NULLABLE dans cette table : on teste seulement les rows
// où agency_id est explicitement set (le cas normal pour des documents agence).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, findLeakedRows, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — documents', () => {
  let setup: TwoAgenciesSetup
  let docAId: string
  let docBId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const { data: docA, error: errA } = await service
      .from('documents')
      .insert({
        agency_id: setup.agencyAId,
        name: `Doc A ${setup.stamp}`,
        type: 'contract',
        storage_path: `test/agency-a/${setup.stamp}.pdf`,
        size_bytes: 1024,
      })
      .select('id')
      .single()
    if (errA) throw new Error(`docA: ${errA.message}`)
    docAId = docA.id

    const { data: docB, error: errB } = await service
      .from('documents')
      .insert({
        agency_id: setup.agencyBId,
        name: `Doc B ${setup.stamp}`,
        type: 'contract',
        storage_path: `test/agency-b/${setup.stamp}.pdf`,
        size_bytes: 2048,
      })
      .select('id')
      .single()
    if (errB) throw new Error(`docB: ${errB.message}`)
    docBId = docB.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (docAId) await service.from('documents').delete().eq('id', docAId)
    if (docBId) await service.from('documents').delete().eq('id', docBId)
    await setup.cleanup()
  })

  it('agent A sees their document', async () => {
    const { data } = await setup.clientA.from('documents').select('id').eq('id', docAId)
    expect(data).toHaveLength(1)
  })

  it('agent A CANNOT see agency B document', async () => {
    const { data } = await setup.clientA.from('documents').select('id').eq('id', docBId)
    expect(data, `agent A leaked doc B`).toEqual([])
  })

  it('agent B sees their document', async () => {
    const { data } = await setup.clientB.from('documents').select('id').eq('id', docBId)
    expect(data).toHaveLength(1)
  })

  it('agent B CANNOT see agency A document', async () => {
    const { data } = await setup.clientB.from('documents').select('id').eq('id', docAId)
    expect(data, `agent B leaked doc A`).toEqual([])
  })

  it('agent A list (filtered to rows with agency_id set) returns NO foreign docs', async () => {
    const leaked = await findLeakedRows(setup.clientA, 'documents', setup.agencyAId)
    // Documents have nullable agency_id — filter to ignore those legitimately.
    const realLeaks = leaked.filter(r => r.agency_id !== null)
    expect(realLeaks, `agent A leaked ${realLeaks.length} cross-tenant docs`).toEqual([])
  })

  it('agent B list (filtered to rows with agency_id set) returns NO foreign docs', async () => {
    const leaked = await findLeakedRows(setup.clientB, 'documents', setup.agencyBId)
    const realLeaks = leaked.filter(r => r.agency_id !== null)
    expect(realLeaks, `agent B leaked ${realLeaks.length} cross-tenant docs`).toEqual([])
  })
})
