import { describe, it, expect } from 'vitest'
import { redactCopilotRequest } from './copilot-redaction'

describe('redactCopilotRequest', () => {
  it('masque un N° AVS dans le message', () => {
    const r = redactCopilotRequest({ message: 'Le client a pour AVS 756.1234.5678.97, note-le.' })
    expect(r.message).toContain('[REDACTED:AVS]')
    expect(r.message).not.toContain('756.1234.5678.97')
    expect(r.total).toBe(1)
    expect(r.summary).toContain('AVS')
  })

  it('masque un IBAN dans une valeur de contexte imbriquée', () => {
    const r = redactCopilotRequest({
      message: 'ok',
      context: { note: 'vire sur CH9300762011623852957', deals: 3 },
    })
    const note = (r.context as { note: string }).note
    expect(note).toContain('[REDACTED:IBAN]')
    expect((r.context as { deals: number }).deals).toBe(3) // non-string intact
    expect(r.total).toBe(1)
  })

  it('masque dans l\'historique', () => {
    const r = redactCopilotRequest({
      message: 'suite',
      history: [{ role: 'user', content: 'mdp: hunter2 pour son espace' }],
    })
    expect(r.history[0].content).toContain('[REDACTED:PASSWORD]')
    expect(r.history[0].role).toBe('user')
    expect(r.total).toBeGreaterThanOrEqual(1)
  })

  it('requête propre → aucune substitution, résumé vide', () => {
    const r = redactCopilotRequest({
      message: 'Résume le dossier Dupont et propose une relance',
      context: { ecran: 'Contacts', pipeline_deals_actifs: 4 },
    })
    expect(r.total).toBe(0)
    expect(r.summary).toBe('')
    expect(r.message).toBe('Résume le dossier Dupont et propose une relance')
  })

  it('n\'altère PAS les noms/emails de contact (hors périmètre)', () => {
    const r = redactCopilotRequest({
      message: 'Écris à Jean Dupont (jean@exemple.ch)',
    })
    expect(r.message).toContain('Jean Dupont')
    expect(r.message).toContain('jean@exemple.ch')
    expect(r.total).toBe(0)
  })

  it('idempotent : re-rédacter un texte déjà rédigé ne change rien', () => {
    const once = redactCopilotRequest({ message: 'AVS 756.1234.5678.97' })
    const twice = redactCopilotRequest({ message: once.message })
    expect(twice.message).toBe(once.message)
    expect(twice.total).toBe(0)
  })

  it('context absent reste undefined', () => {
    const r = redactCopilotRequest({ message: 'x' })
    expect(r.context).toBeUndefined()
  })
})
