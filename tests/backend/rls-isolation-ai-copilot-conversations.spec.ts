// RLS isolation — ai_copilot_conversations.
// Historique des conversations agent ↔ copilote MEGGA AI. Isolation au niveau
// UTILISATEUR (user_id = auth.uid()) pour SELECT/UPDATE/DELETE ; l'INSERT est
// borné en plus à l'agence de l'agent (with_check agency_id = get_user_agency_id()).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, findLeakedRows, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — ai_copilot_conversations', () => {
  let setup: TwoAgenciesSetup
  let convAId: string
  let convBId: string
  // conversations créées par les inserts authentifiés (à nettoyer)
  const createdByClient: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const { data: convA, error: errA } = await service
      .from('ai_copilot_conversations')
      .insert({
        agency_id: setup.agencyAId,
        user_id: setup.agentAId,
        title: `Conv A ${setup.stamp}`,
      })
      .select('id')
      .single()
    if (errA) throw new Error(`convA: ${errA.message}`)
    convAId = convA.id

    const { data: convB, error: errB } = await service
      .from('ai_copilot_conversations')
      .insert({
        agency_id: setup.agencyBId,
        user_id: setup.agentBId,
        title: `Conv B ${setup.stamp}`,
      })
      .select('id')
      .single()
    if (errB) throw new Error(`convB: ${errB.message}`)
    convBId = convB.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    for (const id of [convAId, convBId, ...createdByClient]) {
      if (id) await service.from('ai_copilot_conversations').delete().eq('id', id)
    }
    await setup.cleanup()
  })

  describe('SELECT (owner-scoped : user_id = auth.uid())', () => {
    it('agent A sees their own conversation', async () => {
      const { data } = await setup.clientA.from('ai_copilot_conversations').select('id').eq('id', convAId)
      expect(data).toHaveLength(1)
    })

    it('agent A CANNOT see agent B conversation', async () => {
      const { data } = await setup.clientA.from('ai_copilot_conversations').select('id').eq('id', convBId)
      expect(data, 'agent A leaked a foreign conversation').toEqual([])
    })

    it('agent B sees their own conversation', async () => {
      const { data } = await setup.clientB.from('ai_copilot_conversations').select('id').eq('id', convBId)
      expect(data).toHaveLength(1)
    })

    it('agent B CANNOT see agent A conversation', async () => {
      const { data } = await setup.clientB.from('ai_copilot_conversations').select('id').eq('id', convAId)
      expect(data, 'agent B leaked a foreign conversation').toEqual([])
    })

    it('agent A list returns NO foreign-agency conversations', async () => {
      const leaked = await findLeakedRows(setup.clientA, 'ai_copilot_conversations', setup.agencyAId)
      expect(leaked, `agent A leaked ${leaked.length} foreign conversations`).toEqual([])
    })
  })

  describe('INSERT (with_check : own user_id + own agency)', () => {
    it('agent A can create their OWN conversation', async () => {
      const { data, error } = await setup.clientA
        .from('ai_copilot_conversations')
        .insert({ agency_id: setup.agencyAId, user_id: setup.agentAId, title: `Self A ${setup.stamp}` })
        .select('id')
        .single()
      expect(error, error?.message).toBeNull()
      expect(data?.id).toBeTruthy()
      if (data?.id) createdByClient.push(data.id)
    })

    it('agent A CANNOT insert a conversation owned by agent B', async () => {
      const { error } = await setup.clientA
        .from('ai_copilot_conversations')
        .insert({ agency_id: setup.agencyAId, user_id: setup.agentBId, title: `Spoof user ${setup.stamp}` })
      expect(error, 'with_check should reject foreign user_id').not.toBeNull()
    })

    it('agent A CANNOT insert into agency B', async () => {
      const { error } = await setup.clientA
        .from('ai_copilot_conversations')
        .insert({ agency_id: setup.agencyBId, user_id: setup.agentAId, title: `Spoof agency ${setup.stamp}` })
      expect(error, 'with_check should reject foreign agency_id').not.toBeNull()
    })
  })
})
