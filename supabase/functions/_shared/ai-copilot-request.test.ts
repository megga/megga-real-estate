import { describe, it, expect } from 'vitest'
import {
  buildUserContent,
  serializeContext,
  resolveAuditEntity,
  buildCopilotModelBody,
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

// Frontière DeepSeek du copilote. Le trou fermé ici : copilot-redaction ne couvre que
// message + contexte + historique, donc seul le PREMIER tour était propre — agent-loop
// réinjecte les résultats d'outils tels quels, et get_contact_brief renvoie contacts.notes
// (texte libre de l'agent). Ces tests épinglent la redaction AU POINT D'ÉTRANGLEMENT :
// si quelqu'un retire redactLlmMessages de buildCopilotModelBody, ils tombent.
describe('buildCopilotModelBody — redaction PII au point d’étranglement', () => {
  const toolResult = (notes: string) => JSON.stringify({
    contact: { id: '11111111-2222-3333-4444-555566667777', first_name: 'Marie', notes },
  })

  it('rédige le résultat d’outil réinjecté (le tour 2+ qui partait en clair)', () => {
    const body = buildCopilotModelBody({
      messages: [
        { role: 'user', content: 'Fais-moi un brief sur Marie' },
        { role: 'assistant', content: null, tool_calls: [{ id: 'c1', function: { name: 'get_contact_brief' } }] },
        { role: 'tool', tool_call_id: 'c1', content: toolResult('Verse l’acompte sur CH93 0076 2011 6238 5295 7, AVS 756.1234.5678.90') },
      ],
    })
    const sent = JSON.stringify(body.messages)
    expect(sent).toContain('[REDACTED:IBAN]')
    expect(sent).toContain('[REDACTED:AVS]')
    expect(sent).not.toContain('CH93')
    expect(sent).not.toContain('756.1234')
    // Le travail CRM reste possible : prénom conservé.
    expect(sent).toContain('Marie')
  })

  it('préserve les UUID — ce sont des clés fonctionnelles d’outils, pas des PII', () => {
    const body = buildCopilotModelBody({
      messages: [{ role: 'tool', tool_call_id: 'c1', content: toolResult('rien de sensible') }],
    })
    expect(JSON.stringify(body.messages)).toContain('11111111-2222-3333-4444-555566667777')
  })

  it('n’altère ni le message system, ni les contents non-string, ni les tool_calls', () => {
    const messages = [
      { role: 'system', content: 'Consignes : mot de passe: ne jamais divulguer' },
      { role: 'assistant', content: null, tool_calls: [{ id: 'c1' }] },
    ]
    const body = buildCopilotModelBody({ messages })
    const out = body.messages as Array<Record<string, unknown>>
    expect(out[0].content).toBe(messages[0].content) // system exclu par conception
    expect(out[1].content).toBeNull()
    expect(out[1].tool_calls).toEqual([{ id: 'c1' }])
  })

  it('ne mute pas le tableau d’entrée (la boucle continue avec ses messages)', () => {
    const original = { role: 'tool', tool_call_id: 'c1', content: 'IBAN CH93 0076 2011 6238 5295 7' }
    const messages = [original]
    buildCopilotModelBody({ messages })
    expect(messages[0]).toBe(original)
    expect(original.content).toBe('IBAN CH93 0076 2011 6238 5295 7')
  })

  it('idempotent : la redaction amont de copilot-redaction ne double-marque pas', () => {
    const once = buildCopilotModelBody({ messages: [{ role: 'user', content: 'IBAN CH93 0076 2011 6238 5295 7' }] })
    const first = (once.messages as Array<Record<string, unknown>>)[0].content
    const twice = buildCopilotModelBody({ messages: [{ role: 'user', content: first }] })
    expect((twice.messages as Array<Record<string, unknown>>)[0].content).toBe(first)
  })

  it('garde le câblage du catalogue d’outils (auto / none / absent)', () => {
    const msgs = [{ role: 'user', content: 'salut' }]
    expect(buildCopilotModelBody({ messages: msgs, tools: [{ t: 1 }], withTools: true }).tool_choice).toBe('auto')
    expect(buildCopilotModelBody({ messages: msgs, tools: [{ t: 1 }], withTools: false }).tool_choice).toBe('none')
    const noTools = buildCopilotModelBody({ messages: msgs, tools: null })
    expect(noTools.tools).toBeUndefined()
    expect(noTools.tool_choice).toBeUndefined()
  })

  it('conserve les paramètres de flux et le format JSON optionnel', () => {
    const body = buildCopilotModelBody({ messages: [], responseFormat: 'json_object' })
    expect(body.model).toBe('deepseek-chat')
    expect(body.stream).toBe(true)
    expect(body.stream_options).toEqual({ include_usage: true })
    expect(body.max_tokens).toBe(2000)
    expect(body.response_format).toEqual({ type: 'json_object' })
  })
})
