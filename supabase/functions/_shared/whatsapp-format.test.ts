import { describe, it, expect } from 'vitest'
import { toWhatsAppText, formatOutboundText } from './whatsapp-format'
import { meggaProse } from './megga-prose'

describe('toWhatsAppText', () => {
  it('convertit le gras Markdown **x** en gras WhatsApp *x*', () => {
    expect(toWhatsAppText('Voici **Phil Dubois**, lead chaud')).toBe('Voici *Phil Dubois*, lead chaud')
    expect(toWhatsAppText('**A** et **B**')).toBe('*A* et *B*')
  })
  it('convertit les titres Markdown en gras', () => {
    expect(toWhatsAppText('## Résumé')).toBe('*Résumé*')
    expect(toWhatsAppText('### Bien : Carouge')).toBe('*Bien : Carouge*')
  })
  it('nettoie les étoiles doubles résiduelles', () => {
    expect(toWhatsAppText('texte ** cassé')).toBe('texte * cassé')
  })
  it('laisse intact un texte déjà propre', () => {
    expect(toWhatsAppText('Visite planifiée pour *Sarah* mardi.')).toBe('Visite planifiée pour *Sarah* mardi.')
    expect(toWhatsAppText('Liste:\n- un\n- deux')).toBe('Liste:\n- un\n- deux')
  })
  it('gère le vide', () => {
    expect(toWhatsAppText('')).toBe('')
    expect(toWhatsAppText(null)).toBe('')
    expect(toWhatsAppText(undefined)).toBe('')
  })
})

describe('formatOutboundText', () => {
  it('compose meggaProse PUIS toWhatsAppText, dans cet ordre', () => {
    // meggaProse tourne d'abord le tiret cadratin-puce en « - » ; toWhatsAppText convertit
    // ENSUITE le gras Markdown résiduel en gras WhatsApp. L'ordre inverse laisserait le tiret
    // cadratin intact (toWhatsAppText ne le connaît pas).
    expect(formatOutboundText('— **x**')).toBe('- *x*')
  })
  it('égale toujours toWhatsAppText(meggaProse(s)) — l’invariant partagé par la garde et le découpage', () => {
    const s = 'Le bien fait 80—120 m² · vue lac — à visiter vite. **Prix négociable**.'
    expect(formatOutboundText(s)).toBe(toWhatsAppText(meggaProse(s)))
  })
  it('gère le vide comme toWhatsAppText', () => {
    expect(formatOutboundText('')).toBe('')
    expect(formatOutboundText(null)).toBe('')
    expect(formatOutboundText(undefined)).toBe('')
  })
})
