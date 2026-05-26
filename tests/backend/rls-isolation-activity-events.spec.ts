// RLS isolation — activity_events (audit trail).
// agency_id est NULLABLE (events système peuvent être agency-less). On teste
// que les events SETTED avec un agency_id ne leakent pas cross-tenant.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, findLeakedRows, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — activity_events', () => {
  let setup: TwoAgenciesSetup
  let eventAId: string
  let eventBId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const { data: eventA, error: errA } = await service
      .from('activity_events')
      .insert({
        agency_id: setup.agencyAId,
        actor_id: setup.agentAId,
        action: 'test_event',
        entity_type: 'contact',
        category: 'contact',
      })
      .select('id')
      .single()
    if (errA) throw new Error(`eventA: ${errA.message}`)
    eventAId = eventA.id

    const { data: eventB, error: errB } = await service
      .from('activity_events')
      .insert({
        agency_id: setup.agencyBId,
        actor_id: setup.agentBId,
        action: 'test_event',
        entity_type: 'contact',
        category: 'contact',
      })
      .select('id')
      .single()
    if (errB) throw new Error(`eventB: ${errB.message}`)
    eventBId = eventB.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (eventAId) await service.from('activity_events').delete().eq('id', eventAId)
    if (eventBId) await service.from('activity_events').delete().eq('id', eventBId)
    await setup.cleanup()
  })

  it('agent A sees their audit event', async () => {
    const { data } = await setup.clientA.from('activity_events').select('id').eq('id', eventAId)
    expect(data).toHaveLength(1)
  })

  it('agent A CANNOT see agency B audit event', async () => {
    const { data } = await setup.clientA.from('activity_events').select('id').eq('id', eventBId)
    expect(data, `agent A leaked audit event B`).toEqual([])
  })

  it('agent B sees their audit event', async () => {
    const { data } = await setup.clientB.from('activity_events').select('id').eq('id', eventBId)
    expect(data).toHaveLength(1)
  })

  it('agent B CANNOT see agency A audit event', async () => {
    const { data } = await setup.clientB.from('activity_events').select('id').eq('id', eventAId)
    expect(data, `agent B leaked audit event A`).toEqual([])
  })

  it('agent A list (filtered to agency-scoped events) has NO cross-tenant', async () => {
    const leaked = await findLeakedRows(setup.clientA, 'activity_events', setup.agencyAId)
    // Activity events can have NULL agency_id (system events) — ignore those.
    const realLeaks = leaked.filter(r => r.agency_id !== null)
    expect(realLeaks, `agent A leaked ${realLeaks.length} cross-tenant events`).toEqual([])
  })

  it('agent B list (filtered to agency-scoped events) has NO cross-tenant', async () => {
    const leaked = await findLeakedRows(setup.clientB, 'activity_events', setup.agencyBId)
    const realLeaks = leaked.filter(r => r.agency_id !== null)
    expect(realLeaks, `agent B leaked ${realLeaks.length} cross-tenant events`).toEqual([])
  })
})
