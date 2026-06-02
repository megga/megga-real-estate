import { describe, it, expect } from 'vitest'
import { toWhatsAppText } from './whatsapp-format'

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
