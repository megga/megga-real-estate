// La relance rédigée dans la langue du CLIENT — les deux pièges du lot C.
//
// Ces deux fonctions sont exportées POUR ce banc : elles décident, l'une, dans quelle langue
// on écrit à quelqu'un, l'autre, ce qui atterrit dans l'objet d'un e-mail réellement envoyé.
// Les deux échouaient en silence.
import { describe, it, expect } from 'vitest'
import { langueClient, parseDraft } from '@/components/crm/today/relanceLangue'

const lead = { name: 'Marie Favre' }
const t = (k: string) => k

describe('langueClient — une table, jamais un ternaire', () => {
  it('rend les quatre langues du produit', () => {
    expect(langueClient('fr')).toBe('fr')
    expect(langueClient('de')).toBe('de')
    expect(langueClient('en')).toBe('en')
    expect(langueClient('it')).toBe('it')
  })

  it('⛔ n’avale PAS `de` ni `it`', () => {
    // Le défaut que ce lot ferme : `l === 'en' ? 'en' : 'fr'` renvoyait 'fr' pour un
    // germanophone, sans que rien ne le signale.
    expect(langueClient('de')).not.toBe('fr')
    expect(langueClient('it')).not.toBe('fr')
  })

  it('retombe sur le français pour l’inconnu et le vide', () => {
    expect(langueClient(null)).toBe('fr')
    expect(langueClient(undefined)).toBe('fr')
    expect(langueClient('es')).toBe('fr')
    expect(langueClient('')).toBe('fr')
  })
})

describe('parseDraft — la ligne d’objet, dans les quatre langues', () => {
  const cas = [
    ['Objet : Reprenons contact', 'fr'],
    ['Betreff: Wieder in Kontakt kommen', 'de'],
    ['Subject: Getting back in touch', 'en'],
    ['Oggetto: Riprendiamo contatto', 'it'],
  ] as const

  it('extrait l’objet quel que soit le marqueur', () => {
    for (const [entete, code] of cas) {
      const { subject, body } = parseDraft(`${entete}\n\nBonjour,\n\nLe corps.`, lead, t)
      expect(subject, code).not.toContain(':')
      expect(body, code).toBe('Bonjour,\n\nLe corps.')
    }
  })

  it('⛔ la ligne d’en-tête ne RESTE PAS collée dans le corps envoyé', () => {
    // Le motif ne connaissait que « objet ». Un brouillon allemand partait donc au client
    // avec « Betreff: … » en première ligne du message, et un objet de repli français.
    const { subject, body } = parseDraft('Betreff: Wieder in Kontakt\n\nGuten Tag,', lead, t)
    expect(body).not.toContain('Betreff')
    expect(subject).toBe('Wieder in Kontakt')
  })

  it('sans ligne d’objet, retombe sur la clé de repli sans perdre le corps', () => {
    const { subject, body } = parseDraft('Guten Tag,\n\nLe corps.', lead, t)
    expect(subject).toBe('today.relance.draft.fallbackSubject')
    expect(body).toBe('Guten Tag,\n\nLe corps.')
  })
})
