// RLS isolation — message_threads + messages.
// Cas spécial : messages n'a pas d'agency_id direct, isolation via thread_id
// (FK vers message_threads.agency_id). On teste les deux niveaux.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, findLeakedRows, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — message_threads + messages', () => {
  let setup: TwoAgenciesSetup
  let threadAId: string
  let threadBId: string
  let messageAId: string
  let messageBId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    // 2 threads (1 per agency)
    const { data: threadA, error: errTA } = await service
      .from('message_threads')
      .insert({
        agency_id: setup.agencyAId,
        contact_name: `Client A ${setup.stamp}`,
        contact_type: 'buyer',
      })
      .select('id')
      .single()
    if (errTA) throw new Error(`threadA: ${errTA.message}`)
    threadAId = threadA.id

    const { data: threadB, error: errTB } = await service
      .from('message_threads')
      .insert({
        agency_id: setup.agencyBId,
        contact_name: `Client B ${setup.stamp}`,
        contact_type: 'buyer',
      })
      .select('id')
      .single()
    if (errTB) throw new Error(`threadB: ${errTB.message}`)
    threadBId = threadB.id

    // 2 messages (1 per thread)
    const { data: msgA, error: errMA } = await service
      .from('messages')
      .insert({
        thread_id: threadAId,
        sender_id: setup.agentAId,
        sender_type: 'agent',
        sender_name: 'Agent A',
        content: `Hello from A ${setup.stamp}`,
      })
      .select('id')
      .single()
    if (errMA) throw new Error(`msgA: ${errMA.message}`)
    messageAId = msgA.id

    const { data: msgB, error: errMB } = await service
      .from('messages')
      .insert({
        thread_id: threadBId,
        sender_id: setup.agentBId,
        sender_type: 'agent',
        sender_name: 'Agent B',
        content: `Hello from B ${setup.stamp}`,
      })
      .select('id')
      .single()
    if (errMB) throw new Error(`msgB: ${errMB.message}`)
    messageBId = msgB.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (messageAId) await service.from('messages').delete().eq('id', messageAId)
    if (messageBId) await service.from('messages').delete().eq('id', messageBId)
    if (threadAId) await service.from('message_threads').delete().eq('id', threadAId)
    if (threadBId) await service.from('message_threads').delete().eq('id', threadBId)
    await setup.cleanup()
  })

  describe('message_threads (direct agency_id)', () => {
    it('agent A sees their thread', async () => {
      const { data } = await setup.clientA.from('message_threads').select('id').eq('id', threadAId)
      expect(data).toHaveLength(1)
    })

    it('agent A CANNOT see agency B thread', async () => {
      const { data } = await setup.clientA.from('message_threads').select('id').eq('id', threadBId)
      expect(data).toEqual([])
    })

    it('agent B sees their thread', async () => {
      const { data } = await setup.clientB.from('message_threads').select('id').eq('id', threadBId)
      expect(data).toHaveLength(1)
    })

    it('agent B CANNOT see agency A thread', async () => {
      const { data } = await setup.clientB.from('message_threads').select('id').eq('id', threadAId)
      expect(data).toEqual([])
    })

    it('agent A list returns NO foreign threads', async () => {
      const leaked = await findLeakedRows(setup.clientA, 'message_threads', setup.agencyAId)
      expect(leaked, `agent A leaked ${leaked.length} foreign threads`).toEqual([])
    })

    it('agent B list returns NO foreign threads', async () => {
      const leaked = await findLeakedRows(setup.clientB, 'message_threads', setup.agencyBId)
      expect(leaked, `agent B leaked ${leaked.length} foreign threads`).toEqual([])
    })
  })

  describe('messages (indirect isolation via thread_id FK)', () => {
    it('agent A sees message in their own thread', async () => {
      const { data } = await setup.clientA.from('messages').select('id').eq('id', messageAId)
      expect(data).toHaveLength(1)
    })

    it('agent A CANNOT see message in agency B thread', async () => {
      const { data } = await setup.clientA.from('messages').select('id').eq('id', messageBId)
      expect(data, `agent A leaked message in cross-tenant thread`).toEqual([])
    })

    it('agent B sees message in their own thread', async () => {
      const { data } = await setup.clientB.from('messages').select('id').eq('id', messageBId)
      expect(data).toHaveLength(1)
    })

    it('agent B CANNOT see message in agency A thread', async () => {
      const { data } = await setup.clientB.from('messages').select('id').eq('id', messageAId)
      expect(data, `agent B leaked message in cross-tenant thread`).toEqual([])
    })
  })
})
