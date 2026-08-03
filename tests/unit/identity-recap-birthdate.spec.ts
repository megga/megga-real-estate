/**
 * Date de naissance du récapitulatif KYB (StepRecapitulatif.birthDate).
 *
 * CE QUE CE FICHIER GARDE, et pourquoi il vaut mieux qu'une relecture : le
 * récapitulatif affichait la date ISO brute du brouillon (« 1980-05-15 »), et le
 * réflexe pour corriger ça est d'appeler `formatDate()` de lib/utils. Ce réflexe
 * est FAUX ici, et il l'est de façon invisible depuis la Suisse : `formatDate`
 * passe par `new Date('1980-05-15')`, que la spec ES parse en UTC minuit pour la
 * forme date-seule, puis réaffiche en heure LOCALE — la veille sort dès que le
 * fuseau de la session est à l'ouest de UTC. Vérifié : « 14.05.1980 » sous
 * America/Los_Angeles, « 15.05.1980 » sous Europe/Zurich.
 *
 * Une date de naissance est exactement ce que la case d'attestation du même écran
 * demande de certifier exact ; un décalage d'un jour y est une fausse déclaration,
 * pas un défaut d'affichage. Le test tourne donc SOUS UN FUSEAU NÉGATIF, seul
 * endroit où la régression se voit — sous Europe/Zurich il passerait aussi avec
 * l'implémentation fautive, et ne prouverait rien.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { birthDate } from '@/components/crm-sugar-identity/steps/StepRecapitulatif'

const originalTZ = process.env.TZ

describe('birthDate', () => {
  // Le fuseau est posé pour tout le fichier : la seule chose qui distingue une
  // réécriture de chaîne d'un aller-retour par un instant est de s'en éloigner.
  beforeAll(() => { process.env.TZ = 'America/Los_Angeles' })
  afterAll(() => { process.env.TZ = originalTZ })

  it('rend le format suisse sans décaler le jour, fuseau négatif compris', () => {
    expect(birthDate('1980-05-15')).toBe('15.05.1980')
    expect(birthDate('1985-11-02')).toBe('02.11.1985')
    // 1er janvier : le cas où un décalage d'un jour change AUSSI l'année.
    expect(birthDate('1990-01-01')).toBe('01.01.1990')
  })

  it('rend une chaîne vide quand la date manque', () => {
    expect(birthDate(null)).toBe('')
    expect(birthDate('')).toBe('')
  })

  it('laisse passer telle quelle une forme inattendue plutôt que de la réécrire de travers', () => {
    expect(birthDate('15.05.1980')).toBe('15.05.1980')
    expect(birthDate('1980-05-15T00:00:00Z')).toBe('1980-05-15T00:00:00Z')
  })
})
