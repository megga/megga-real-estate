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
  it('scrubbe les PII sensibles avant l\'envoi LLM (AVS/IBAN/mdp) mais garde nom/téléphone', () => {
    const d = buildThreadDigest([
      { direction: 'inbound', body: 'Mon AVS 756.1234.5678.90, IBAN CH93 0076 2011 6238 5295 7, mdp: secret123', transcript: null, created_at: 'a' },
      { direction: 'outbound', body: 'Bien reçu Sarah, je vous appelle au 079 123 45 67', transcript: null, created_at: 'b' },
    ])
    expect(d).not.toContain('756.1234.5678.90')
    expect(d).not.toContain('CH93')
    expect(d).not.toContain('secret123')
    expect(d).toContain('[REDACTED:AVS]')
    expect(d).toContain('[REDACTED:IBAN]')
    expect(d).toContain('[REDACTED:PASSWORD]')
    // Contact info préservée : l'extraction du lead (nom/téléphone/email) en dépend.
    expect(d).toContain('Sarah')
    expect(d).toContain('079 123 45 67')
  })
  it('scrubbe aussi les PII des transcripts vocaux (canal principal des notes vocales)', () => {
    // Note vocale : body=null, PII dans le transcript (Deepgram). buildThreadDigest
    // rédige transcript||body via la même passe → le canal vocal est couvert.
    const d = buildThreadDigest([
      { direction: 'inbound', body: null, transcript: 'alors mon numéro AVS c\'est 756.1234.5678.90', created_at: 'a' },
    ])
    expect(d).not.toContain('756.1234.5678.90')
    expect(d).toContain('[REDACTED:AVS]')
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
      summary: null, intent: null, entities: {}, commitments: [], sentiment: null, next_action: null, lead: null,
    })
  })
  it('extrait le lead tiers', () => {
    const i = parseInsight(JSON.stringify({ lead: { is_third_party: true, first_name: 'Sarah', last_name: 'Williams' } }))
    expect(i.lead).toEqual({ is_third_party: true, first_name: 'Sarah', last_name: 'Williams', phone: null, email: null })
  })
  it('rejette sentiment et next_action.type hors liste (anti-injection)', () => {
    const i = parseInsight(JSON.stringify({ sentiment: 'euphorique', next_action: { type: 'rm -rf', label: 'x' } }))
    expect(i.sentiment).toBeNull()
    expect(i.next_action).toBeNull()
  })
})
