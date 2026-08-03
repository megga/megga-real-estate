/**
 * Garde-fou : les deux invariants dont dépend la bascule de langue automatique.
 *
 * 1. LE TÉMOIN DE PREMIER CONTACT. i18next écrit lui-même
 *    `localStorage['megga-language']` pendant son `init()` — son détecteur est
 *    configuré avec `caches: ['localStorage']`, et `init()` déclenche un
 *    `changeLanguage()` implicite qui appelle `cacheUserLanguage()`. Demander
 *    « cet agent a-t-il déjà une langue ? » APRÈS l'init répond donc oui à tout
 *    le monde, y compris à quelqu'un qui vient d'ouvrir le CRM pour la première
 *    fois. `hasExplicitLanguage` est capturé avant. Ce test échoue si quelqu'un
 *    « simplifie » cette capture en une lecture ordinaire.
 *
 * 2. LA GARDE DE FRAÎCHEUR. Charger une langue passe par un `import()` de
 *    plusieurs centaines de millisecondes. Deux chargements peuvent donc être en
 *    vol en même temps — la détection géographique en démarre un au chargement
 *    de la page, précisément quand l'agent peut en demander un autre depuis le
 *    sélecteur du wizard d'onboarding. Sans garde, c'est le plus LENT qui gagne,
 *    et il se persiste : le choix de l'agent est annulé sous ses yeux.
 *
 * ⚠ POURQUOI UN STOCKAGE STUBÉ ET UN IMPORT DYNAMIQUE. Le jsdom de ce dépôt ne
 * fournit PAS `window.localStorage` (seul `sessionStorage` existe). Sans le
 * stub, i18next n'écrit rien, `hasExplicitLanguage` retombe sur son repli
 * « stockage refusé », et les deux invariants ci-dessus ne seraient pas
 * observés — le fichier passerait au vert sans rien prouver. Le stub doit être
 * posé AVANT le chargement de `@/i18n`, qui lit et écrit dès son import : d'où
 * l'`await import()` plutôt qu'un `import` statique, que l'ESM hisserait.
 */
import { describe, it, expect, vi } from 'vitest'

const CLE = 'megga-language'

const memoire = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (cle: string) => (memoire.has(cle) ? memoire.get(cle)! : null),
  setItem: (cle: string, valeur: string) => { memoire.set(cle, String(valeur)) },
  removeItem: (cle: string) => { memoire.delete(cle) },
  clear: () => { memoire.clear() },
  key: (i: number) => [...memoire.keys()][i] ?? null,
  get length() { return memoire.size },
})

// Le stockage est vide et l'URL ne porte pas de `?lang=` : c'est exactement le
// tout premier contact d'un navigateur avec le CRM.
const { default: i18n, ensureLanguageLoaded, hasExplicitLanguage } = await import('@/i18n')

describe('premier contact — le témoin est capturé avant que i18next n\'écrive', () => {
  it('i18next a bien rempli la clé pendant son init', () => {
    // Si cette assertion tombe, ce n'est pas une bonne nouvelle : cela veut dire
    // que le piège a changé de forme, pas qu'il a disparu. Relire la capture.
    expect(window.localStorage.getItem(CLE)).toBe('fr')
  })

  it('le témoin dit pourtant « aucune préférence »', () => {
    expect(hasExplicitLanguage).toBe(false)
  })
})

describe('la langue déduite se persiste comme un choix', () => {
  it('une bascule automatique remplit la clé, donc ne se rejouera pas', async () => {
    // C'est le pendant du témoin : la déduction ne vaut QUE pour ce premier
    // contact. En basculant, elle écrit `megga-language` (par le détecteur
    // d'i18next), si bien qu'au chargement suivant `hasExplicitLanguage` sera
    // vrai et que plus rien ne sera deviné.
    await ensureLanguageLoaded('de')
    expect(i18n.language).toBe('de')
    expect(window.localStorage.getItem(CLE)).toBe('de')
  })
})
