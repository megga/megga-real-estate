// Persistance des conversations copilote — exécuteur RÉEL contre Supabase.
// Importe la MÊME fonction `persistCopilotTurn` que l'edge function ai-copilot
// (couvre le gap « edge functions échappent à tsc/vitest ») et prouve son
// comportement contre la vraie table ai_copilot_conversations : création au 1er
// tour, append au 2e (titre figé, last_message_at avancé), filtre d'appartenance.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import {
  persistCopilotTurn,
  type ConversationMessage,
  type ConversationStore,
} from '../../supabase/functions/_shared/copilot-persistence'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

// Store adossé au service client — même contrat que l'implémentation edge.
function serviceStore(): ConversationStore {
  const svc = serviceRoleClient()
  return {
    async load(conversationId, userId) {
      const { data } = await svc
        .from('ai_copilot_conversations')
        .select('messages')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .maybeSingle()
      return data ? (data.messages as ConversationMessage[]) : null
    },
    async create(c) {
      const { data, error } = await svc
        .from('ai_copilot_conversations')
        .insert({
          user_id: c.userId,
          agency_id: c.agencyId,
          title: c.title,
          messages: c.messages,
          last_message_at: c.lastMessageAt,
        })
        .select('id')
        .single()
      if (error) throw new Error(`create: ${error.message}`)
      return data.id as string
    },
    async append(conversationId, userId, messages, lastMessageAt) {
      const { error } = await svc
        .from('ai_copilot_conversations')
        .update({ messages, last_message_at: lastMessageAt })
        .eq('id', conversationId)
        .eq('user_id', userId)
      if (error) throw new Error(`append: ${error.message}`)
    },
  }
}

describe.skipIf(!HAS_KEYS)('copilot conversation persistence (live executor)', () => {
  let setup: TwoAgenciesSetup
  let convId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (convId) await svc.from('ai_copilot_conversations').delete().eq('id', convId)
    await setup.cleanup()
  })

  it('creates a conversation on the first turn (title + 2 messages persisted)', async () => {
    const store = serviceStore()
    convId = await persistCopilotTurn(store, {
      conversationId: null,
      userId: setup.agentAId,
      agencyId: setup.agencyAId,
      userMessage: `Stratégie Bertrand ${setup.stamp}`,
      assistantMessage: 'Trois angles à jouer…',
      now: '2026-06-20T12:00:00.000Z',
    })
    expect(convId).toBeTruthy()

    const svc = serviceRoleClient()
    const { data } = await svc
      .from('ai_copilot_conversations')
      .select('title, messages, last_message_at, archived')
      .eq('id', convId)
      .single()
    expect(data?.title).toBe(`Stratégie Bertrand ${setup.stamp}`)
    expect(data?.archived).toBe(false)
    expect(data?.messages).toHaveLength(2)
    // Postgres sérialise timestamptz en '+00:00' ; on compare l'INSTANT, pas la
    // forme de la chaîne (sinon faux négatif '+00:00' vs '.000Z').
    expect(new Date(data!.last_message_at).toISOString()).toBe('2026-06-20T12:00:00.000Z')
  })

  it('appends to the same conversation on the next turn (id reused, title frozen, last_message_at advanced)', async () => {
    const store = serviceStore()
    const again = await persistCopilotTurn(store, {
      conversationId: convId,
      userId: setup.agentAId,
      agencyId: setup.agencyAId,
      userMessage: 'Et pour le financement ?',
      assistantMessage: 'Voici comment cadrer…',
      now: '2026-06-20T12:05:00.000Z',
    })
    expect(again).toBe(convId)

    const svc = serviceRoleClient()
    const { data } = await svc
      .from('ai_copilot_conversations')
      .select('title, messages, last_message_at')
      .eq('id', convId)
      .single()
    expect(data?.title).toBe(`Stratégie Bertrand ${setup.stamp}`) // figé au 1er tour
    expect(data?.messages).toHaveLength(4)
    expect(new Date(data!.last_message_at).toISOString()).toBe('2026-06-20T12:05:00.000Z')
  })

  it('load() filters on ownership: a foreign user_id cannot read the conversation', async () => {
    const store = serviceStore()
    const asOwner = await store.load(convId, setup.agentAId)
    expect(asOwner).not.toBeNull()
    const asForeign = await store.load(convId, setup.agentBId)
    expect(asForeign).toBeNull()
  })
})
