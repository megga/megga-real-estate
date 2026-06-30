import { describe, it, expect } from 'vitest'
import {
  parseOwner, resolveDueAt, deriveFollowups, normalizeAction, hashKey, persistFollowups,
  type DerivedFollowup,
} from './whatsapp-followups'

// Ancrage déterministe : 2026-06-30 = un MARDI. 08:00Z = 10:00 Zurich (CEST, UTC+2).
const NOW = '2026-06-30T08:00:00.000Z'

describe('parseOwner', () => {
  it('sépare le préfixe Agent/Client du texte', () => {
    expect(parseOwner('Agent: rappeler le client jeudi')).toEqual({ owner: 'agent', text: 'rappeler le client jeudi' })
    expect(parseOwner('Client: dispo samedi 14h')).toEqual({ owner: 'client', text: 'dispo samedi 14h' })
    expect(parseOwner('MEGGA: envoyer les biens')).toEqual({ owner: 'agent', text: 'envoyer les biens' })
  })
  it('owner null si aucun préfixe reconnu', () => {
    expect(parseOwner('rappeler demain')).toEqual({ owner: null, text: 'rappeler demain' })
  })
  it('gère les variantes prospect/acheteur/vendeur → client', () => {
    expect(parseOwner('Prospect: rappelle ce soir').owner).toBe('client')
    expect(parseOwner('Vendeur: veut signer').owner).toBe('client')
  })
})

describe('resolveDueAt — repères relatifs (Zurich, base mardi 2026-06-30 10h)', () => {
  it('demain → +1 jour, 09:00 local par défaut', () => {
    expect(resolveDueAt('envoyer le dossier demain', NOW)).toBe('2026-07-01T07:00:00.000Z')
  })
  it('demain 14h → +1 jour à 14:00 local', () => {
    expect(resolveDueAt('rappeler demain 14h', NOW)).toBe('2026-07-01T12:00:00.000Z')
  })
  it('après-demain → +2 jours', () => {
    expect(resolveDueAt('apres-demain', NOW)).toBe('2026-07-02T07:00:00.000Z')
  })
  it('ce soir → aujourd’hui 18:00 local', () => {
    expect(resolveDueAt('je te rappelle ce soir', NOW)).toBe('2026-06-30T16:00:00.000Z')
  })
  it('dans 3 jours → +3', () => {
    expect(resolveDueAt('je reviens dans 3 jours', NOW)).toBe('2026-07-03T07:00:00.000Z')
  })
  it('semaine prochaine → +7', () => {
    expect(resolveDueAt('on se rappelle la semaine prochaine', NOW)).toBe('2026-07-07T07:00:00.000Z')
  })
})

describe('resolveDueAt — jours nommés', () => {
  it('jeudi (mardi→+2)', () => {
    expect(resolveDueAt('rappeler jeudi', NOW)).toBe('2026-07-02T07:00:00.000Z')
  })
  it('lundi (mardi→+6, prochaine occurrence)', () => {
    expect(resolveDueAt('rdv lundi', NOW)).toBe('2026-07-06T07:00:00.000Z')
  })
  it('samedi 14h', () => {
    expect(resolveDueAt('visite samedi 14h', NOW)).toBe('2026-07-04T12:00:00.000Z')
  })
  it('mardi (même jour, sans heure → aujourd’hui)', () => {
    expect(resolveDueAt('rappeler mardi', NOW)).toBe('2026-06-30T07:00:00.000Z')
  })
  it('mardi prochain → +7 (force semaine suivante)', () => {
    expect(resolveDueAt('rappeler mardi prochain', NOW)).toBe('2026-07-07T07:00:00.000Z')
  })
  it('english: thursday / next monday', () => {
    expect(resolveDueAt('call thursday', NOW)).toBe('2026-07-02T07:00:00.000Z')
    expect(resolveDueAt('call next monday 2pm', NOW)).toBe('2026-07-06T12:00:00.000Z')
  })
  it('aucun repère de jour → null', () => {
    expect(resolveDueAt('envoyer les photos', NOW)).toBeNull()
    expect(resolveDueAt('', NOW)).toBeNull()
  })
})

describe('normalizeAction + hashKey', () => {
  it('normalise (accents, casse, ponctuation)', () => {
    expect(normalizeAction('Rappeler le Client — jeudi !')).toBe('rappeler le client jeudi')
  })
  it('hashKey stable et discriminant', () => {
    expect(hashKey('c', 'a', '2026-07-02')).toBe(hashKey('c', 'a', '2026-07-02'))
    expect(hashKey('c', 'a', '2026-07-02')).not.toBe(hashKey('c', 'a', 'nodate'))
  })
})

describe('deriveFollowups', () => {
  const insight = {
    commitments: [
      'Agent: rappeler le client jeudi',
      'Client: dispo samedi 14h',           // ignoré v1 (engagement client)
      'Agent: envoyer le dossier',           // sans date → dueAt null
    ],
    next_action: { type: 'planifier_visite', label: 'Planifier une visite' },
  }

  it('ne garde que les engagements de l’agent + la next_action', () => {
    const out = deriveFollowups(insight, { nowISO: NOW })
    expect(out).toHaveLength(3)
    const kinds = out.map((f) => f.kind).sort()
    expect(kinds).toEqual(['commitment', 'commitment', 'next_action'])
    expect(out.every((f) => f.owner === 'agent')).toBe(true)
  })

  it('date l’engagement avec repère, laisse null sinon', () => {
    const out = deriveFollowups(insight, { nowISO: NOW })
    const dated = out.find((f) => f.action.includes('jeudi'))!
    expect(dated.dueAt).toBe('2026-07-02T07:00:00.000Z')
    const undated = out.find((f) => f.action.includes('dossier'))!
    expect(undated.dueAt).toBeNull()
    const na = out.find((f) => f.kind === 'next_action')!
    expect(na.dueAt).toBeNull()
    expect(na.action).toBe('Planifier une visite')
  })

  it('next_action « molle » (rien/répondre) ignorée', () => {
    expect(deriveFollowups({ commitments: [], next_action: { type: 'repondre', label: 'Répondre' } }, { nowISO: NOW })).toEqual([])
    expect(deriveFollowups({ commitments: [], next_action: { type: 'rien', label: '' } }, { nowISO: NOW })).toEqual([])
  })

  it('dédoublonne les engagements identiques (même jour)', () => {
    const dup = { commitments: ['Agent: rappeler jeudi', 'Agent: Rappeler jeudi !'], next_action: null }
    expect(deriveFollowups(dup, { nowISO: NOW })).toHaveLength(1)
  })

  it('insight vide / null → []', () => {
    expect(deriveFollowups(null, { nowISO: NOW })).toEqual([])
    expect(deriveFollowups({ commitments: [], next_action: null }, { nowISO: NOW })).toEqual([])
  })

  it('next_action sans label retombe sur un libellé FR par type', () => {
    const out = deriveFollowups({ commitments: [], next_action: { type: 'relancer', label: '' } }, { nowISO: NOW })
    expect(out).toHaveLength(1)
    expect(out[0].action).toBe('Relancer le contact')
  })
})

describe('persistFollowups (I/O — mock client)', () => {
  it('mappe les lignes et fait un upsert ignoreDuplicates', async () => {
    let captured: { rows: unknown; opts: unknown } | null = null
    const admin = {
      from() {
        return {
          upsert(rows: unknown, opts: unknown) { captured = { rows, opts }; return Promise.resolve({ error: null }) },
        }
      },
    } as unknown as Parameters<typeof persistFollowups>[0]
    const sugg: DerivedFollowup[] = [
      { owner: 'agent', action: 'rappeler', dueAt: '2026-07-02T07:00:00.000Z', kind: 'commitment', dedupKey: 'k1' },
    ]
    const n = await persistFollowups(admin, 'ag1', 'c1', sugg, '2026-06-30T08:00:00.000Z')
    expect(n).toBe(1)
    expect((captured!.opts as { onConflict: string; ignoreDuplicates: boolean })).toEqual({ onConflict: 'contact_id,dedup_key', ignoreDuplicates: true })
    expect((captured!.rows as Array<Record<string, unknown>>)[0]).toMatchObject({
      agency_id: 'ag1', contact_id: 'c1', owner: 'agent', action: 'rappeler', due_at: '2026-07-02T07:00:00.000Z',
      kind: 'commitment', dedup_key: 'k1', source_insight_at: '2026-06-30T08:00:00.000Z',
    })
  })
  it('liste vide → 0, aucune requête', async () => {
    const admin = { from() { throw new Error('should not query') } } as unknown as Parameters<typeof persistFollowups>[0]
    expect(await persistFollowups(admin, 'ag1', 'c1', [], null)).toBe(0)
  })
})
