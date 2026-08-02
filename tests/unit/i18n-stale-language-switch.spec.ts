/**
 * Garde-fou : une bascule de langue encore en vol ne renverse pas un choix plus récent.
 *
 * LE DÉFAUT QUE CE TEST INTERDIT. `ensureLanguageLoaded` charge les 13 bundles
 * d'une langue par `import()` dynamique, puis bascule dessus. Entre les deux, il
 * s'écoule le temps d'un aller-retour réseau — et rien n'empêche l'agent de
 * demander autre chose pendant ce temps. Sans garde de fraîcheur, c'est la
 * demande la plus LENTE qui l'emporte, et elle se persiste dans `localStorage`
 * via le détecteur d'i18next : le choix de l'agent est annulé sous ses yeux, et
 * il l'est encore au rechargement suivant.
 *
 * Le cas n'a rien de théorique depuis que le pays du visiteur peut déclencher
 * une bascule au chargement de la page (`src/lib/geoLanguage.ts`) : elle part
 * exactement au moment où l'agent découvre le sélecteur de langue du wizard
 * d'onboarding — la seule sortie de langue derrière le gate d'identité.
 *
 * ⚠ POURQUOI UN MODULE BLOQUÉ À LA MAIN. Une première version de ce test se
 * contentait de lancer les deux bascules et d'attendre. Elle passait AUSSI sans
 * la garde : l'ordre d'arrivée des `import()` n'est pas garanti, et le cache de
 * Vite les rendait parfois plus rapides que `changeLanguage()`. Un test de
 * concurrence qui ne contrôle pas l'ordre ne teste rien. Ici le premier module
 * allemand est retenu sur une promesse qu'on résout nous-mêmes, ce qui fige
 * l'entrelacement : l'allemand ne peut PAS arriver avant l'italien.
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

/** Retient le premier bundle allemand jusqu'à ce que le test le libère. */
let libererAllemand: () => void
const allemandRetenu = new Promise<void>((resolve) => { libererAllemand = resolve })

vi.doMock('@/i18n/locales/de/common.json', async () => {
  await allemandRetenu
  return { default: {} }
})

const { default: i18n, ensureLanguageLoaded } = await import('@/i18n')

describe('bascule de langue — le choix le plus récent gagne', () => {
  it('un chargement retenu ne renverse pas la demande qui lui a succédé', async () => {
    // Préchargement de l'italien, puis retour au français. C'est ce qui rend la
    // suite déterministe : quand l'agent redemandera l'italien, son bundle sera
    // déjà là, donc AUCUN second chargement asynchrone ne courra en parallèle.
    // Sans cette précaution, le chargement de l'italien pouvait se terminer
    // après celui de l'allemand et rebasculer de lui-même — le test passait
    // alors même sans la garde, en mesurant une coïncidence.
    await ensureLanguageLoaded('it')
    await i18n.changeLanguage('fr')

    // L'allemand part en chargement (cas de la détection géographique) et reste
    // bloqué sur son premier module.
    const chargementAllemand = ensureLanguageLoaded('de')
    expect(i18n.hasResourceBundle('de', 'common')).toBe(false)

    // L'agent demande l'italien pendant ce temps (cas du sélecteur du wizard).
    await i18n.changeLanguage('it')
    expect(i18n.language).toBe('it')

    // L'allemand arrive enfin. Il ne doit RIEN renverser.
    libererAllemand()
    await chargementAllemand

    expect(i18n.language, 'la demande la plus lente a écrasé la plus récente').toBe('it')
    expect(window.localStorage.getItem(CLE), 'et elle a persisté son écrasement').toBe('it')
  })

  it('les ressources retenues ont quand même été enregistrées', () => {
    // La garde annule la BASCULE, pas le travail : le bundle allemand est en
    // place, un passage ultérieur à l'allemand n'aura rien à retélécharger.
    expect(i18n.hasResourceBundle('de', 'common')).toBe(true)
  })
})
