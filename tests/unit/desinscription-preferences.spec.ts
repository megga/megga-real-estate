// La page publique de préférences d'e-mail, et les deux chemins de désinscription.
//
// ⛔ CE QUI SE GARDE ICI EST CE QUI SE CASSE EN SILENCE : une copie qui perd l'adresse de
// contact nLPD, une mention de conformité qui laisserait croire que tout peut être coupé, et
// surtout la SÉPARATION des deux URL — l'en-tête pour la machine, le lien pour l'humain.
import { describe, it, expect } from 'vitest'
import { DESINSCRIPTION_COPIE, type LangueDesinscription } from '@/pages/public/desinscriptionCopie'

const LANGUES: LangueDesinscription[] = ['fr', 'de', 'en', 'it']

describe('copie de la page de désinscription', () => {
  // ⚠ DIX-NEUF depuis le 17 août 2026 : `T19`, la mention de droits nLPD affichée sur la
  // page de SUCCÈS, a été retirée sur décision de Julien. Le compte reste écrit en dur —
  // c'est lui qui force à passer par ici quand une chaîne disparaît, plutôt que de la
  // laisser tomber d'une langue en silence.
  it('les quatre langues portent les dix-neuf chaînes', () => {
    const attendu = Object.keys(DESINSCRIPTION_COPIE.fr)
    expect(attendu).toHaveLength(19)
    for (const l of LANGUES) {
      expect(Object.keys(DESINSCRIPTION_COPIE[l]), l).toEqual(attendu)
      for (const [k, v] of Object.entries(DESINSCRIPTION_COPIE[l])) {
        expect(v, `${l}/${k}`).toBeTruthy()
      }
    }
  })

  it("l'adresse de contact nLPD survit à la traduction", () => {
    // Elle est la porte de sortie manuelle quand le lien échoue : la perdre en traduisant
    // laisserait quelqu'un sans recours sur une page qui vient d'échouer.
    //
    // ⚠ T19 A QUITTÉ CETTE LISTE le 17 août 2026 (décision Julien), avec la mention
    // elle-même. Elle n'était PAS un recours : T16 et T18 le sont, sur les chemins qui
    // ÉCHOUENT, et ils restent gardés ici. T19 était la mention de droits affichée sur
    // la page de SUCCÈS — la retirer n'enlève donc le recours de personne, et c'est
    // pourquoi le motif de cette clause tient toujours avec deux clés au lieu de trois.
    for (const l of LANGUES) {
      for (const k of ['T16', 'T18'] as const) {
        expect(DESINSCRIPTION_COPIE[l][k], `${l}/${k}`).toContain('privacy@megga.ch')
      }
    }
  })

  it('la mention de conformité garde ses DEUX affirmations', () => {
    // T11 dit deux choses, et perdre l'une des deux la rend fausse : ces messages répondent
    // à une démarche de la personne, ET ils ne se coupent pas sur cette page.
    const secondeAffirmation: Record<LangueDesinscription, RegExp> = {
      fr: /ne peuvent pas être désactivés ici/i,
      de: /lassen sich hier nicht abschalten/i,
      en: /cannot be turned off here/i,
      it: /non possono essere disattivati qui/i,
    }
    for (const l of LANGUES) {
      expect(DESINSCRIPTION_COPIE[l].T11, l).toMatch(secondeAffirmation[l])
      expect(DESINSCRIPTION_COPIE[l].T11.length, l).toBeGreaterThan(80)
    }
  })

  it('aucune langue ne retombe en français', () => {
    for (const l of LANGUES.filter((x) => x !== 'fr')) {
      expect(DESINSCRIPTION_COPIE[l].T1, l).not.toBe(DESINSCRIPTION_COPIE.fr.T1)
      expect(DESINSCRIPTION_COPIE[l].T12, l).not.toBe(DESINSCRIPTION_COPIE.fr.T12)
    }
  })

  it('aucun tiret cadratin, et aucun eszett en allemand', () => {
    for (const l of LANGUES) {
      const tout = Object.values(DESINSCRIPTION_COPIE[l]).join(' ')
      expect(tout, l).not.toMatch(/[–—]/)
      if (l === 'de') expect(tout).not.toMatch(/ß/)
    }
  })
})
