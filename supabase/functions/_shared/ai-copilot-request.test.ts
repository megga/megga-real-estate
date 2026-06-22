import { describe, it, expect } from 'vitest'
import {
  buildUserContent,
  serializeContext,
  resolveAuditEntity,
} from './ai-copilot-request'

const PROMPTS = {
  summarize_contact: 'RESUME',
  detect_intent: 'DETECTE',
}

describe('serializeContext', () => {
  it('returns empty string for missing/empty context', () => {
    expect(serializeContext(undefined)).toBe('')
    expect(serializeContext({})).toBe('')
  })
  it('skips null and empty-string values', () => {
    expect(serializeContext({ a: '1', b: null, c: '', d: undefined })).toBe('- a: 1')
  })
  it('JSON-stringifies object values', () => {
    expect(serializeContext({ matches: [{ id: 1 }] })).toBe('- matches: [{"id":1}]')
  })
})

describe('buildUserContent', () => {
  it('free chat: returns the raw message, no instruction wrapper', () => {
    const out = buildUserContent({ action: 'chat', message: 'Bonjour', actionPrompts: PROMPTS })
    expect(out).toBe('Bonjour')
  })
  it('known action: prepends the action prompt and the message', () => {
    const out = buildUserContent({ action: 'summarize_contact', message: 'go', actionPrompts: PROMPTS })
    expect(out).toBe('**Instruction :** RESUME\n\n**Message :** go')
  })
  it('known action with empty message: falls back to the default exec phrase', () => {
    const out = buildUserContent({ action: 'detect_intent', message: '', actionPrompts: PROMPTS })
    expect(out).toBe('**Instruction :** DETECTE\n\n**Message :** Exécute cette action.')
  })
  it('unknown action prompt: treated like free chat (no wrapper)', () => {
    const out = buildUserContent({ action: 'analyze_market', message: 'x', actionPrompts: PROMPTS })
    expect(out).toBe('x')
  })
  it('appends the CRM context block when present', () => {
    const out = buildUserContent({ action: 'chat', message: 'Hi', context: { contact_id: 'c1' }, actionPrompts: PROMPTS })
    expect(out).toBe('Hi\n\n**Contexte CRM actuel :**\n- contact_id: c1')
  })
  it('malformed/garbage context does not crash and is filtered', () => {
    const out = buildUserContent({ action: 'chat', message: 'Hi', context: { a: null, b: '' }, actionPrompts: PROMPTS })
    expect(out).toBe('Hi') // tout filtré ⇒ pas de bloc contexte
  })
})

describe('resolveAuditEntity (audit routing, free chat = no log)', () => {
  it('returns null when no CRM entity (free chat)', () => {
    expect(resolveAuditEntity(undefined)).toBeNull()
    expect(resolveAuditEntity({ agency_id: 'a' })).toBeNull()
  })
  it('prioritises kyc > contact > property > transaction', () => {
    expect(resolveAuditEntity({ kyc_case_id: 'k', contact_id: 'c' }))
      .toEqual({ entityType: 'kyc', entityId: 'k' })
    expect(resolveAuditEntity({ contact_id: 'c', property_id: 'p' }))
      .toEqual({ entityType: 'contact', entityId: 'c' })
    expect(resolveAuditEntity({ property_id: 'p', transaction_id: 't' }))
      .toEqual({ entityType: 'property', entityId: 'p' })
    expect(resolveAuditEntity({ transaction_id: 't' }))
      .toEqual({ entityType: 'transaction', entityId: 't' })
  })
})
