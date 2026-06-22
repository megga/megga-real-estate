import { describe, it, expect } from 'vitest'
import {
  buildConversationTitle,
  persistCopilotTurn,
  persistenceFlagOn,
  MAX_STORED_MESSAGES,
  TITLE_MAX,
  type ConversationMessage,
  type ConversationStore,
  type NewConversation,
} from './copilot-persistence'

// ── Faux store en mémoire (prouve l'orchestration sans DB) ───────────────────
function memStore() {
  const rows = new Map<
    string,
    { userId: string; agencyId: string; title: string; messages: ConversationMessage[]; lastMessageAt: string }
  >()
  let seq = 0
  const calls = { create: 0, append: 0, load: 0 }
  const store: ConversationStore = {
    async load(id, userId) {
      calls.load++
      const r = rows.get(id)
      return r && r.userId === userId ? r.messages : null
    },
    async create(c: NewConversation) {
      calls.create++
      const id = `conv-${++seq}`
      rows.set(id, { ...c, messages: [...c.messages] })
      return id
    },
    async append(id, userId, messages, lastMessageAt) {
      calls.append++
      const r = rows.get(id)
      if (r && r.userId === userId) {
        r.messages = messages
        r.lastMessageAt = lastMessageAt
      }
    },
  }
  return { rows, calls, store }
}

describe('buildConversationTitle', () => {
  it('falls back when the message is empty/whitespace', () => {
    expect(buildConversationTitle('   ')).toBe('Nouvelle conversation')
    expect(buildConversationTitle('')).toBe('Nouvelle conversation')
  })

  it('keeps a short message verbatim (whitespace collapsed)', () => {
    expect(buildConversationTitle('  Résume   Marie  Bertrand ')).toBe('Résume Marie Bertrand')
  })

  it('truncates a long message with an ellipsis within TITLE_MAX', () => {
    const long = 'a'.repeat(200)
    const title = buildConversationTitle(long)
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX)
    expect(title.endsWith('…')).toBe(true)
  })
})

describe('persistCopilotTurn', () => {
  const base = {
    userId: 'user-1',
    agencyId: 'agency-1',
    now: '2026-06-20T12:00:00.000Z',
  }

  it('creates a new conversation when no id is given', async () => {
    const { rows, calls, store } = memStore()
    const id = await persistCopilotTurn(store, {
      ...base,
      conversationId: null,
      userMessage: 'Stratégie pour Bertrand',
      assistantMessage: 'Voici trois angles…',
    })
    expect(calls.create).toBe(1)
    expect(calls.append).toBe(0)
    const row = rows.get(id)!
    expect(row.title).toBe('Stratégie pour Bertrand')
    expect(row.messages).toEqual([
      { role: 'user', content: 'Stratégie pour Bertrand' },
      { role: 'assistant', content: 'Voici trois angles…' },
    ])
    expect(row.lastMessageAt).toBe(base.now)
  })

  it('appends to an existing conversation and reuses its id (title unchanged)', async () => {
    const { rows, calls, store } = memStore()
    const id = await persistCopilotTurn(store, {
      ...base,
      conversationId: null,
      userMessage: 'Premier message',
      assistantMessage: 'Première réponse',
    })
    const later = await persistCopilotTurn(store, {
      ...base,
      now: '2026-06-20T12:05:00.000Z',
      conversationId: id,
      userMessage: 'Deuxième message',
      assistantMessage: 'Deuxième réponse',
    })
    expect(later).toBe(id)
    expect(calls.create).toBe(1)
    expect(calls.append).toBe(1)
    const row = rows.get(id)!
    expect(row.title).toBe('Premier message') // titre figé au 1er tour
    expect(row.messages).toHaveLength(4)
    expect(row.messages[3]).toEqual({ role: 'assistant', content: 'Deuxième réponse' })
    expect(row.lastMessageAt).toBe('2026-06-20T12:05:00.000Z')
  })

  it('never writes cross-user: an unowned id falls back to creating a fresh conversation', async () => {
    const { calls, store } = memStore()
    // id qui n'existe pas (ou appartient à un autre user → load renvoie null)
    const id = await persistCopilotTurn(store, {
      ...base,
      conversationId: 'someone-elses-id',
      userMessage: 'Test',
      assistantMessage: 'Réponse',
    })
    expect(id).toBe('conv-1') // nouvelle conversation
    expect(calls.create).toBe(1)
    expect(calls.append).toBe(0)
  })

  it('caps stored messages at MAX_STORED_MESSAGES (prunes oldest, keeps newest)', async () => {
    const { rows, store } = memStore()
    const id = await persistCopilotTurn(store, {
      ...base,
      conversationId: null,
      userMessage: 'turn 0',
      assistantMessage: 'reply 0',
    })
    // assez de tours pour dépasser le plafond (chaque tour = 2 messages)
    const turns = MAX_STORED_MESSAGES // largement au-delà de MAX/2
    for (let i = 1; i <= turns; i++) {
      await persistCopilotTurn(store, {
        ...base,
        conversationId: id,
        userMessage: `turn ${i}`,
        assistantMessage: `reply ${i}`,
      })
    }
    const row = rows.get(id)!
    expect(row.messages).toHaveLength(MAX_STORED_MESSAGES)
    // le dernier message stocké est bien le plus récent
    expect(row.messages[row.messages.length - 1]).toEqual({ role: 'assistant', content: `reply ${turns}` })
  })
})

describe('persistenceFlagOn (gate nLPD, fail-safe OFF)', () => {
  it('enables ONLY for the exact text "true"', () => {
    expect(persistenceFlagOn('true')).toBe(true)
  })
  it('stays OFF for absent / other / non-text values', () => {
    expect(persistenceFlagOn(undefined)).toBe(false)
    expect(persistenceFlagOn(null)).toBe(false)
    expect(persistenceFlagOn('false')).toBe(false)
    expect(persistenceFlagOn('TRUE')).toBe(false)
    expect(persistenceFlagOn('1')).toBe(false)
    expect(persistenceFlagOn(true)).toBe(false) // app_config.value est du TEXTE
  })
})
