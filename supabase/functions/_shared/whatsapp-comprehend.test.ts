import { describe, it, expect } from 'vitest'
import { buildThreadDigest, parseInsight } from './whatsapp-comprehend'

describe('buildThreadDigest', () => {
  it('formate Client/Agent et utilise le transcript pour la voix', () => {
    const d = buildThreadDigest([
      { direction: 'inbound', body: null, transcript: 'je cherche un 3,5 pièces à Genève', created_at: '2026-06-01T10:00:00Z' },
      { direction: 'outbound', body: 'Quel budget ?', transcript: null, created_at: '2026-06-01T10:05:00Z' },
    ])
    expect(d).toBe('Client: je cherche un 3,5 pièces à Genève\nAgent: Quel budget ?')
  })
  it('ignore les messages sans texte', () => {
    expect(buildThreadDigest([{ direction: 'inbound', body: '', transcript: null, created_at: 'x' }])).toBe('')
  })
})

describe('parseInsight', () => {
  it('valide et conserve les champs corrects', () => {
    const i = parseInsight(JSON.stringify({
      summary: 'Client cherche 3.5p Genève', intent: 'recherche_achat',
      entities: { budget: '1.2M', zones: ['Genève'] }, commitments: ['Agent: envoie photos'],
      sentiment: 'positif', next_action: { type: 'envoyer_biens', label: 'Envoyer 3 biens' },
    }))
    expect(i.summary).toBe('Client cherche 3.5p Genève')
    expect(i.entities).toEqual({ budget: '1.2M', zones: ['Genève'] })
    expect(i.commitments).toEqual(['Agent: envoie photos'])
    expect(i.sentiment).toBe('positif')
    expect(i.next_action).toEqual({ type: 'envoyer_biens', label: 'Envoyer 3 biens' })
  })
  it('JSON invalide → défauts sûrs', () => {
    expect(parseInsight('{ pas du json')).toEqual({
      summary: null, intent: null, entities: {}, commitments: [], sentiment: null, next_action: null,
    })
  })
  it('rejette sentiment et next_action.type hors liste (anti-injection)', () => {
    const i = parseInsight(JSON.stringify({ sentiment: 'euphorique', next_action: { type: 'rm -rf', label: 'x' } }))
    expect(i.sentiment).toBeNull()
    expect(i.next_action).toBeNull()
  })
})
