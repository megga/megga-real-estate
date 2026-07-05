import { describe, it, expect } from 'vitest'
import { createPseudonymizer } from './pseudonymize'

describe('createPseudonymizer', () => {
  it('même nom → même jeton, noms différents → jetons différents', () => {
    const p = createPseudonymizer()
    const a = p.tokenFor('Jean Dupont')
    const b = p.tokenFor('Marie Martin')
    const a2 = p.tokenFor('jean dupont') // casse différente
    expect(a).toBe('{{C1}}')
    expect(b).toBe('{{C2}}')
    expect(a2).toBe('{{C1}}') // stable, insensible à la casse
    expect(p.size()).toBe(2)
  })

  it('nom vide → jeton vide', () => {
    const p = createPseudonymizer()
    expect(p.tokenFor('')).toBe('')
    expect(p.tokenFor(null)).toBe('')
    expect(p.tokenFor(undefined)).toBe('')
    expect(p.size()).toBe(0)
  })

  it('restore re-substitue les jetons par les vrais noms', () => {
    const p = createPseudonymizer()
    const t1 = p.tokenFor('Jean Dupont')
    const t2 = p.tokenFor('Sarah Meyer')
    const reply = `Priorité : ${t1} attend une réponse, puis relance ${t2}.`
    expect(p.restore(reply)).toBe('Priorité : Jean Dupont attend une réponse, puis relance Sarah Meyer.')
  })

  it('restore tolère les espaces dans le jeton', () => {
    const p = createPseudonymizer()
    p.tokenFor('Jean Dupont')
    expect(p.restore('Contacter {{ C1 }} demain')).toBe('Contacter Jean Dupont demain')
  })

  it('restore laisse un jeton inconnu intact', () => {
    const p = createPseudonymizer()
    p.tokenFor('Jean Dupont')
    expect(p.restore('Voir {{C9}}')).toBe('Voir {{C9}}')
  })

  it('scrub remplace un nom connu dans du texte libre (insensible casse)', () => {
    const p = createPseudonymizer()
    const tok = p.tokenFor('Jean Dupont')
    expect(p.scrub('Rappeler JEAN DUPONT au sujet de l’offre')).toBe(`Rappeler ${tok} au sujet de l’offre`)
  })

  it('scrub gère les noms plus longs d’abord (pas de remplacement partiel)', () => {
    const p = createPseudonymizer()
    const full = p.tokenFor('Jean Dupont')
    const first = p.tokenFor('Jean') // homonyme partiel enregistré après
    const out = p.scrub('Jean Dupont et Jean séparément')
    // « Jean Dupont » entier remplacé par son jeton, puis « Jean » isolé par le sien
    expect(out).toBe(`${full} et ${first} séparément`)
  })

  it('scrub ignore une chaîne vide', () => {
    const p = createPseudonymizer()
    p.tokenFor('Jean Dupont')
    expect(p.scrub('')).toBe('')
    expect(p.scrub(null)).toBe('')
  })

  it('round-trip : un vrai nom ne subsiste jamais dans le texte pseudonymisé', () => {
    const p = createPseudonymizer()
    const names = ['Jean Dupont', 'Sarah Meyer', 'Élise Perret']
    names.forEach((nm) => p.tokenFor(nm))
    const snapshot = p.scrub('Priorités: Jean Dupont, Sarah Meyer, Élise Perret à relancer')
    for (const nm of names) expect(snapshot).not.toContain(nm)
    expect(p.restore(snapshot)).toContain('Jean Dupont')
  })
})
