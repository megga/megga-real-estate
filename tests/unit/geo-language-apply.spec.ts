/**
 * Garde-fou : quand la langue déduite du pays est appliquée au CRM, et surtout
 * quand elle ne l'est PAS.
 *
 * La détection ne doit s'appliquer que dans un cas très étroit — premier contact,
 * réponse sûre, langue différente de celle en cours. Tout le reste est une
 * abstention. C'est cette étroitesse qui est testée ici : les abstentions
 * d'abord, l'application ensuite, parce que l'instance i18next est globale et
 * qu'une fois basculée elle ne revient pas.
 *
 * Le stockage est stubé avant l'import : sans lui, `hasExplicitLanguage`
 * retomberait sur son repli « stockage refusé » (vrai), et TOUS les cas
 * s'abstiendraient — la suite passerait au vert sans rien distinguer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const memoire = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (cle: string) => (memoire.has(cle) ? memoire.get(cle)! : null),
  setItem: (cle: string, valeur: string) => { memoire.set(cle, String(valeur)) },
  removeItem: (cle: string) => { memoire.delete(cle) },
  clear: () => { memoire.clear() },
  key: (i: number) => [...memoire.keys()][i] ?? null,
  get length() { return memoire.size },
})

const fetchSimule = vi.fn()
vi.stubGlobal('fetch', fetchSimule)

const { default: i18n } = await import('@/i18n')
const { applyDetectedLanguage } = await import('@/lib/geoLanguage')

/** Réponse de `/api/geo` telle que la rendrait le worker. */
function reponse(corps: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corps) })
}

describe('la langue déduite ne s\'applique pas', () => {
  beforeEach(() => { fetchSimule.mockReset() })

  it('quand le bord ne sait pas (confiance basse)', async () => {
    fetchSimule.mockReturnValue(reponse({ country: 'CH', region: null, language: 'fr', confidence: 'low', source: 'defaut' }))
    expect(await applyDetectedLanguage()).toBeNull()
    expect(i18n.language).toBe('fr')
  })

  it('quand c\'est déjà la langue en cours', async () => {
    fetchSimule.mockReturnValue(reponse({ country: 'FR', region: null, language: 'fr', confidence: 'medium', source: 'pays' }))
    expect(await applyDetectedLanguage()).toBeNull()
  })

  it('quand la réponse annonce une langue que le produit ne parle pas', async () => {
    // Une valeur inattendue au bord ne doit pas devenir une bascule vers une
    // langue inexistante : le CRM afficherait des clés brutes.
    fetchSimule.mockReturnValue(reponse({ country: 'ES', region: null, language: 'es', confidence: 'high', source: 'pays' }))
    expect(await applyDetectedLanguage()).toBeNull()
    expect(i18n.language).toBe('fr')
  })

  it('quand l\'endpoint répond en erreur', async () => {
    fetchSimule.mockReturnValue(reponse({}, false))
    expect(await applyDetectedLanguage()).toBeNull()
  })

  it('quand le réseau échoue — megga.ch injoignable, CORS refusé, délai dépassé', async () => {
    fetchSimule.mockRejectedValue(new Error('network'))
    expect(await applyDetectedLanguage()).toBeNull()
    expect(i18n.language, 'le CRM doit démarrer normalement, en français').toBe('fr')
  })

  it('sans jamais poser d\'en-tête, pour rester une requête CORS « simple »', async () => {
    fetchSimule.mockReturnValue(reponse({ country: 'CH', region: null, language: 'fr', confidence: 'low', source: 'defaut' }))
    await applyDetectedLanguage()

    // Un en-tête personnalisé déclencherait une préflight OPTIONS avant chaque
    // détection, et la préflight n'emporte pas d'Authorization : elle serait
    // arrêtée par le gate Basic Auth de la vitrine.
    const [url, init] = fetchSimule.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://megga.ch/api/geo')
    expect(init.headers).toBeUndefined()
    expect(init.credentials).toBe('omit')
  })
})

describe('la langue déduite s\'applique', () => {
  it('quand le bord est sûr et que la langue diffère', async () => {
    fetchSimule.mockReset()
    fetchSimule.mockReturnValue(reponse({ country: 'CH', region: 'ZH', language: 'de', confidence: 'high', source: 'canton' }))

    expect(await applyDetectedLanguage()).toBe('de')
    expect(i18n.language).toBe('de')
    // Le bundle est chargé AVANT la bascule : pas de passage par le français.
    expect(i18n.hasResourceBundle('de', 'common')).toBe(true)
  })

  it('et ne se rejouera pas, la déduction étant devenue une préférence', async () => {
    // La bascule a fait écrire `megga-language` par le détecteur d'i18next.
    // Au chargement suivant, `hasExplicitLanguage` sera vrai et plus rien ne
    // sera deviné : la déduction ne vaut que pour le premier contact.
    expect(window.localStorage.getItem('megga-language')).toBe('de')
  })
})
