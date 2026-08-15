// D'où vient la langue d'un e-mail : la partie qui DÉCIDE, éprouvée sans base.
//
// Le défaut que ces tests figent : un envoi automatique n'a aucune requête d'où lire une
// langue, et `onboarding-call-reminder` écrivait `'fr'` en dur. La règle de priorité est
// la seule chose subtile ici, et elle n'est pas devinable — d'où ces cas.
import { describe, it, expect } from 'vitest'
import { parseLocale, pickLocale, DEFAULT_LOCALE } from './recipient-language'

describe('parseLocale', () => {
  it('reconnaît les quatre langues du produit', () => {
    for (const l of ['fr', 'de', 'en', 'it']) expect(parseLocale(l)).toBe(l)
  })

  it('accepte les formes régionales : le navigateur en produit', () => {
    // Refuser « de-CH » renverrait l'utilisateur au français pour une raison
    // qu'il ne verrait jamais.
    expect(parseLocale('de-CH')).toBe('de')
    expect(parseLocale('en-GB')).toBe('en')
    expect(parseLocale('fr_CH')).toBe('fr')
    expect(parseLocale('IT')).toBe('it')
  })

  it('⛔ rend null, PAS « fr », sur une entrée inconnue', () => {
    // La distinction porte tout : « il n'a rien demandé » doit pouvoir laisser parler
    // la préférence enregistrée. Répondre 'fr' ici ferait qu'un corps de requête bruité
    // écraserait la langue choisie par l'utilisateur.
    for (const v of ['es', '', '  ', 'xx', null, undefined, 42, {}, ['fr']]) {
      expect(parseLocale(v)).toBeNull()
    }
  })
})

describe('pickLocale — la requête AVANT la base', () => {
  it('la requête gagne : c\'est ce que la personne fait à l\'instant', () => {
    // Quelqu'un qui vient de basculer en allemand attend une confirmation en allemand,
    // même si la persistance de sa préférence n'a pas encore atterri.
    expect(pickLocale('de', 'fr')).toBe('de')
  })

  it('sans requête, la préférence enregistrée : c\'est le cas des envois automatiques', () => {
    expect(pickLocale(undefined, 'it')).toBe('it')
    expect(pickLocale(null, 'de')).toBe('de')
  })

  it('une requête ILLISIBLE n\'écrase pas la préférence', () => {
    expect(pickLocale('es', 'de')).toBe('de')
    expect(pickLocale('', 'de')).toBe('de')
  })

  it('rien nulle part : le français, qui est le défaut du produit', () => {
    expect(pickLocale(null, null)).toBe('fr')
    expect(DEFAULT_LOCALE).toBe('fr')
  })
})
