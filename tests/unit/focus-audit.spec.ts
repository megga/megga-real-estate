// Unit test — focusAuditTarget : mapping pur préfixe d'id Focus → cible activity_events.
// Fige le contrat de consignation HITL des gestes Focus (useFocusQueue) : chaque
// famille mappe vers le bon (entity_type, category contrainte) et l'entity_id n'est
// posé QUE si le rawId est un uuid nu (sinon null → jamais d'erreur 22P02 en base).

import { describe, it, expect } from 'vitest'
import { focusAuditTarget, uuidOrNull } from '@/components/crm/today/focusAudit'

const UUID = '11111111-2222-3333-4444-555555555555'

describe('focusAuditTarget — mapping des familles Focus', () => {
  it.each([
    ['rem',     'reminder',    'contact'],
    ['deal',    'transaction', 'deal'],
    ['kyc',     'transaction', 'kyc'],
    ['match',   'match',       'deal'],
    ['seller',  'seller_lead', 'contact'],
    ['offer',   'offer',       'deal'],
    ['visit',   'visit',       'contact'],
    ['cooling', 'contact',     'contact'],
    ['bien',    'property',    'bien'],
  ] as const)('%s-<uuid> → entityType=%s, category=%s, entityId=uuid', (prefix, entityType, category) => {
    const t = focusAuditTarget(`${prefix}-${UUID}`)
    expect(t.entityType).toBe(entityType)
    expect(t.category).toBe(category)
    expect(t.entityId).toBe(UUID)
    expect(t.rawId).toBe(UUID)
  })

  it('rawId non-uuid → entityId null, rawId conservé', () => {
    const t = focusAuditTarget('rem-marie')
    expect(t.entityId).toBeNull()
    expect(t.rawId).toBe('marie')
    expect(t.entityType).toBe('reminder')
  })

  it('préfixe inconnu → défaut contact/contact', () => {
    const t = focusAuditTarget(`mystere-${UUID}`)
    expect(t.entityType).toBe('contact')
    expect(t.category).toBe('contact')
    expect(t.entityId).toBe(UUID)
  })

  it('id sans tiret → défaut, rawId = id entier, entityId null (non-uuid)', () => {
    const t = focusAuditTarget('marie')
    expect(t.rawId).toBe('marie')
    expect(t.entityId).toBeNull()
    expect(t.category).toBe('contact')
  })

  it('toutes les categories restent dans l\'enum contraint', () => {
    const allowed = new Set(['kyc', 'deal', 'contact', 'bien'])
    for (const p of ['rem', 'deal', 'kyc', 'match', 'seller', 'offer', 'visit', 'cooling', 'bien', 'x']) {
      expect(allowed.has(focusAuditTarget(`${p}-${UUID}`).category)).toBe(true)
    }
  })
})

describe('uuidOrNull (garde 22P02)', () => {
  it('uuid nu → renvoyé tel quel', () => {
    expect(uuidOrNull(UUID)).toBe(UUID)
  })
  it('non-uuid / vide / null / undefined → null', () => {
    expect(uuidOrNull('marie')).toBeNull()
    expect(uuidOrNull('')).toBeNull()
    expect(uuidOrNull(null)).toBeNull()
    expect(uuidOrNull(undefined)).toBeNull()
  })
})
