import { describe, it, expect } from 'vitest'
import {
  filterConversationsByTitle,
  sanitizeStoredMessages,
  type ConversationSummary,
} from '@/lib/conversation-history'

const conv = (id: string, title: string): ConversationSummary => ({
  id,
  title,
  lastMessageAt: '2026-06-20T12:00:00.000Z',
})

const LIST: ConversationSummary[] = [
  conv('1', 'Stratégie pour signer Bertrand'),
  conv('2', 'Analyse marché Carouge T1'),
  conv('3', 'Relance pipeline — deals dormants'),
  conv('4', 'Rédaction mandat Élodie'),
]

describe('filterConversationsByTitle', () => {
  it('returns [] for an empty/whitespace query (no noise in the results section)', () => {
    expect(filterConversationsByTitle(LIST, '')).toEqual([])
    expect(filterConversationsByTitle(LIST, '   ')).toEqual([])
  })

  it('matches a title substring, case-insensitive', () => {
    const r = filterConversationsByTitle(LIST, 'carouge')
    expect(r.map(c => c.id)).toEqual(['2'])
  })

  it('is accent-insensitive (elodie ⇒ Élodie)', () => {
    const r = filterConversationsByTitle(LIST, 'elodie')
    expect(r.map(c => c.id)).toEqual(['4'])
  })

  it('returns [] when nothing matches', () => {
    expect(filterConversationsByTitle(LIST, 'zürich')).toEqual([])
  })

  it('caps results at the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => conv(String(i), `Bertrand ${i}`))
    expect(filterConversationsByTitle(many, 'bertrand', 3)).toHaveLength(3)
  })
})

describe('sanitizeStoredMessages', () => {
  it('keeps only well-formed {role,content} entries', () => {
    const raw = [
      { role: 'user', content: 'salut' },
      { role: 'assistant', content: 'bonjour' },
      { role: 'system', content: 'nope' }, // mauvais role
      { role: 'user', content: 42 }, // content non-string
      null,
      'garbage',
      { content: 'no role' },
    ]
    expect(sanitizeStoredMessages(raw)).toEqual([
      { role: 'user', content: 'salut' },
      { role: 'assistant', content: 'bonjour' },
    ])
  })

  it('returns [] for non-array / null input', () => {
    expect(sanitizeStoredMessages(null)).toEqual([])
    expect(sanitizeStoredMessages(undefined)).toEqual([])
    expect(sanitizeStoredMessages('[]')).toEqual([])
    expect(sanitizeStoredMessages({})).toEqual([])
  })
})
