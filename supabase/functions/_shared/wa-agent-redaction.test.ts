import { describe, it, expect } from 'vitest'
import { redactLlmMessages, type LlmWireMessage } from './wa-agent-redaction'

const AVS = '756.1234.5678.97'
const IBAN = 'CH9300762011623852957'

describe('redactLlmMessages — frontière DeepSeek du tour live WhatsApp', () => {
  it('rédige le message user courant (AVS + IBAN → marqueurs)', () => {
    const out = redactLlmMessages([
      { role: 'user', content: `ajoute une note: AVS ${AVS}, IBAN ${IBAN}` },
    ])
    expect(out[0].content).toContain('[REDACTED:AVS]')
    expect(out[0].content).toContain('[REDACTED:IBAN]')
    expect(out[0].content).not.toContain(AVS)
    expect(out[0].content).not.toContain(IBAN)
  })

  it('rédige un résultat d\'outil (role:tool) SANS toucher dates de RDV, prix ni UUID', () => {
    const toolJson = JSON.stringify({
      contact: { notes: `IBAN du client: ${IBAN}` },
      visite: { scheduled_at: '12.07.2026 14:30', visit_id: 'a1b2c3d4-1111-2222-3333-444455556666' },
      offre: { amount: 850000 },
    })
    const out = redactLlmMessages([{ role: 'tool', tool_call_id: 'call_1', content: toolJson }])
    const c = out[0].content as string
    expect(c).toContain('[REDACTED:IBAN]')
    expect(c).not.toContain(IBAN)
    // le pattern DOB est ancré (« né le / date de naissance ») : une date de visite reste intacte
    expect(c).toContain('12.07.2026 14:30')
    expect(c).toContain('850000')
    // UUID à queue tout-numérique : mordu par le pattern CARD sans le blindage
    expect(c).toContain('a1b2c3d4-1111-2222-3333-444455556666')
    expect(out[0].tool_call_id).toBe('call_1')
  })

  it('rédige l\'historique (user ET assistant), y compris une date de naissance EXPLICITE', () => {
    const out = redactLlmMessages([
      { role: 'user', content: `le client est né le 12.03.1985` },
      { role: 'assistant', content: `noté, IBAN ${IBAN}` },
    ])
    expect(out[0].content).toContain('[REDACTED:DOB]')
    expect(out[0].content).not.toContain('12.03.1985')
    expect(out[1].content).toContain('[REDACTED:IBAN]')
  })

  it('EXCLUT le message system (composé de parties déjà propres — jamais mutilé par les regex)', () => {
    const system = `Tu es MEGGA. Exemple pédagogique interne: ${IBAN}. Ne mélange pas les langues.`
    const out = redactLlmMessages([{ role: 'system', content: system }])
    expect(out[0].content).toBe(system)
  })

  it('ne touche pas un assistant à content:null porteur de tool_calls (structure préservée)', () => {
    const toolCalls = [{ id: 'call_1', type: 'function', function: { name: 'search_contacts', arguments: '{"query":"Dubois"}' } }]
    const msg: LlmWireMessage = { role: 'assistant', content: null, tool_calls: toolCalls }
    const out = redactLlmMessages([msg])
    expect(out[0]).toBe(msg) // même référence : rien à rédiger, zéro copie
    expect(out[0].tool_calls).toBe(toolCalls)
  })

  it('est idempotent (double application = même résultat) et ne mute PAS l\'entrée', () => {
    const original = { role: 'user', content: `IBAN ${IBAN}` }
    const input = [original]
    const once = redactLlmMessages(input)
    const twice = redactLlmMessages(once)
    expect(twice).toEqual(once)
    // immutabilité : l'objet source garde sa valeur brute (la copie est sur le fil, pas en mémoire)
    expect(original.content).toContain(IBAN)
  })

  it('blinde PLUSIEURS UUID (même tout-numériques) et ne fuit jamais de placeholder', () => {
    const u1 = 'a1b2c3d4-1111-2222-3333-444455556666' // queue numérique : mordu par CARD sans blindage
    const u2 = 'deadbeef-cafe-4bad-8bad-0123456789ab'
    const out = redactLlmMessages([
      { role: 'tool', tool_call_id: 'c', content: `biens: ["${u1}","${u2}"], IBAN ${IBAN}` },
    ])
    const c = out[0].content as string
    expect(c).toContain(u1)
    expect(c).toContain(u2)
    expect(c).toContain('[REDACTED:IBAN]')
    expect(c).not.toMatch(/[\uE000\uE001]/) // les délimiteurs de blindage ne fuient jamais
  })

  it('neutralise des délimiteurs privés forgés dans le texte entrant (anti-injection du blindage)', () => {
    const u1 = 'deadbeef-cafe-4bad-8bad-0123456789ab'
    const forged = `avant \uE0000\uE001 après ["${u1}"]`
    const out = redactLlmMessages([{ role: 'user', content: forged }])
    const c = out[0].content as string
    expect(c).toContain(u1)          // le vrai UUID est restauré normalement
    expect(c).toContain('avant')     // le texte forgé est neutralisé, pas interprété
    expect(c).not.toMatch(/[\uE000\uE001]/)
  })

  it('laisse passer un tour ordinaire inchangé (aucun faux positif sur du texte métier)', () => {
    const out = redactLlmMessages([
      { role: 'user', content: 'planifie une visite demain 14h pour Dubois, budget CHF 850\'000, 4.5 pièces à Carouge' },
    ])
    expect(out[0].content).not.toContain('[REDACTED')
  })
})
