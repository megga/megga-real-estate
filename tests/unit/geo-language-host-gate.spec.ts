/**
 * Garde-fou : le CRM n'appelle PAS `/api/geo` depuis un hôte où il n'existe pas.
 *
 * LE DÉFAUT QUE CE TEST INTERDIT, et il a réellement eu lieu. La détection
 * appelait `https://megga.ch/api/geo` au démarrage, sans condition. En
 * développement et en intégration continue, le CRM tourne sur `localhost` : la
 * requête part vers une autre origine, l'endpoint n'y est pas encore déployé, et
 * le navigateur journalise « blocked by CORS policy ».
 *
 * Le `try/catch` du client n'y peut RIEN : un échec réseau est tracé par le
 * navigateur lui-même, il n'est pas levé dans notre code. 35 tests Playwright,
 * qui assertent l'absence d'erreur console sur chaque route du CRM, sont tombés
 * d'un coup — et AUCUNE porte locale ne pouvait le voir, puisque rien en unitaire
 * ni en build n'exerce le navigateur.
 *
 * Le fond n'était pas le CORS : c'était de faire dépendre le démarrage du CRM
 * d'un endpoint absent de son environnement. Cette dépendance aurait de surcroît
 * gardé la CI rouge jusqu'au merge, l'endpoint n'arrivant qu'avec le déploiement
 * de la vitrine.
 *
 * Ce fichier tourne donc sous le `localhost` PAR DÉFAUT de jsdom — c'est tout
 * l'objet du test. Son pendant, `geo-language-apply.spec.ts`, force l'URL sur
 * app.megga.ch pour éprouver la décision elle-même.
 */
import { describe, it, expect, vi } from 'vitest'

const memoire = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (cle: string) => (memoire.has(cle) ? memoire.get(cle)! : null),
  setItem: (cle: string, valeur: string) => { memoire.set(cle, String(valeur)) },
  removeItem: (cle: string) => { memoire.delete(cle) },
  clear: () => { memoire.clear() },
  key: (i: number) => [...memoire.keys()][i] ?? null,
  get length() { return memoire.size },
})

const fetchSimule = vi.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ country: 'CH', region: 'ZH', language: 'de', confidence: 'high', source: 'canton' }) })
)
vi.stubGlobal('fetch', fetchSimule)

const { default: i18n } = await import('@/i18n')
const { applyDetectedLanguage, fetchGeoLanguage } = await import('@/lib/geoLanguage')

describe('depuis un hôte sans endpoint, on ne tente rien du tout', () => {
  it('l\'environnement du test est bien celui du développement et de la CI', () => {
    expect(window.location.hostname).toBe('localhost')
  })

  it('aucune requête n\'est émise', async () => {
    expect(await fetchGeoLanguage()).toBeNull()
    expect(
      fetchSimule,
      'une requête vers une autre origine journalise une erreur CORS que le navigateur trace, et qu\'aucun catch n\'intercepte',
    ).not.toHaveBeenCalled()
  })

  it('et la langue n\'est pas touchée', async () => {
    // La réponse simulée dirait « allemand » : si elle était consultée, la
    // langue basculerait. Elle ne doit même pas être demandée.
    expect(await applyDetectedLanguage()).toBeNull()
    expect(fetchSimule).not.toHaveBeenCalled()
    expect(i18n.language).toBe('fr')
  })
})
