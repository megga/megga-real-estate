/**
 * Garde-fou : la préférence clair/sombre SURVIT au renommage de sa clé.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * Le 17 août 2026, le chantier « plus de Sugar dans les noms » a touché environ
 * deux cents symboles. Un seul ne désignait pas du code : `megga.sugar.dark`,
 * la clé `localStorage` qui porte le thème choisi par chaque agent. Renommer un
 * symbole est réversible et vérifié par le compilateur ; renommer une clé de
 * stockage ne l'est ni l'un ni l'autre — le compilateur ne voit rien, et la
 * donnée est déjà écrite sur la machine de l'utilisateur.
 *
 * ⛔ LE MODE D'ÉCHEC EST SILENCIEUX ET INDISCERNABLE D'UN BUG. Un agent qui
 * avait choisi le sombre rouvre le CRM en CLAIR, sans message, sans trace. Rien
 * dans les tests, le build ou la CI ne peut le voir : tous partent d'un stockage
 * vide, où l'ancienne et la nouvelle clé sont également absentes.
 *
 * ── CE QUE LA GARDE TIENT ────────────────────────────────────────────────────
 * 1. Le repli EXISTE et fonctionne : une ancienne clé seule est lue.
 * 2. Il TRANSCRIT : après lecture, la valeur vit sous le nouveau nom — sans quoi
 *    la migration se rejouerait à chaque montage et l'ancienne clé ne mourrait
 *    jamais.
 * 3. La nouvelle clé PRIME : un agent qui a rebasculé depuis le déploiement ne
 *    doit pas se faire écraser par sa préférence d'avant.
 *
 * ⚠ ET ELLE EXISTE SURTOUT POUR LE JOUR OÙ QUELQU'UN VOUDRA « NETTOYER ».
 * `LEGACY_DARK_KEY` a l'air d'un résidu — c'est exactement ce qu'il faut ne PAS
 * croire. Tant qu'un agent peut revenir après une longue absence avec l'ancienne
 * clé et aucune nouvelle, la retirer lui reprend son thème. La retirer fera
 * rougir ce fichier, qui dira pourquoi.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CRM_DARK_KEY, LEGACY_DARK_KEY, readCrmDark } from '@/lib/crmDark'

/** Stockage minimal — l'environnement de test n'en fournit pas toujours un. */
function poserStockage(initial: Record<string, string> = {}) {
  const donnees = new Map(Object.entries(initial))
  const faux = {
    getItem: (k: string) => donnees.get(k) ?? null,
    setItem: (k: string, v: string) => void donnees.set(k, v),
    removeItem: (k: string) => void donnees.delete(k),
  }
  vi.stubGlobal('window', {
    localStorage: faux,
    matchMedia: () => ({ matches: false }),
  })
  return donnees
}

describe('Thème sombre — la préférence survit au renommage de la clé', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('les deux clés sont distinctes, et l’ancienne est bien l’ancienne', () => {
    expect(CRM_DARK_KEY).not.toBe(LEGACY_DARK_KEY)
    // ⚠ Ancré sur le NOM historique : si quelqu'un « corrigeait » le repli pour
    // qu'il pointe la clé neuve, la migration deviendrait un no-op silencieux.
    expect(LEGACY_DARK_KEY).toBe('megga.sugar.dark')
    expect(CRM_DARK_KEY).not.toContain('sugar')
  })

  it('une préférence écrite sous l’ANCIENNE clé est encore lue', () => {
    poserStockage({ [LEGACY_DARK_KEY]: '1' })
    expect(readCrmDark(), 'un agent qui avait le sombre repasserait au clair').toBe(true)

    poserStockage({ [LEGACY_DARK_KEY]: '0' })
    expect(readCrmDark(), 'un agent qui avait FORCÉ le clair retomberait sur le système').toBe(false)
  })

  it('la lecture TRANSCRIT sous le nouveau nom', () => {
    const donnees = poserStockage({ [LEGACY_DARK_KEY]: '1' })
    readCrmDark()
    expect(
      donnees.get(CRM_DARK_KEY),
      'sans transcription, la migration se rejoue à chaque montage et l’ancienne clé ne meurt jamais',
    ).toBe('1')
  })

  it('la NOUVELLE clé prime sur l’ancienne', () => {
    // Un agent qui a rebasculé depuis le déploiement : sa préférence récente
    // gagne, sinon on lui réimpose celle d'avant à chaque visite.
    poserStockage({ [LEGACY_DARK_KEY]: '1', [CRM_DARK_KEY]: '0' })
    expect(readCrmDark()).toBe(false)
  })

  it('sans aucune des deux clés, on retombe sur le système — pas sur le clair', () => {
    vi.stubGlobal('window', {
      localStorage: { getItem: () => null, setItem: () => {} },
      matchMedia: () => ({ matches: true }),
    })
    expect(readCrmDark()).toBe(true)
  })

  /**
   * ⛔ LA CLÉ N'EST ÉCRITE QU'À UN SEUL ENDROIT. Avant ce lot, 37 sites la
   * portaient en dur — dont 24 lectures qui refaisaient `readCrmDark` à la main,
   * certaines SANS le repli système. Une migration ne peut pas fonctionner si la
   * moitié du dépôt lit la clé sans passer par elle.
   */
  it('aucun autre fichier ne connaît le nom des clés', async () => {
    const { scanRoots, readFileSafely, rel, emptyRoots } = await import('./helpers/fs-scan')
    const scan = scanRoots([{ root: 'src', keep: (n: string) => /\.tsx?$/.test(n) }])
    expect(emptyRoots(scan), 'racine vide : chemin cassé').toEqual([])
    expect(scan.files.length).toBeGreaterThan(300)

    const fautifs: string[] = []
    for (const abs of scan.files) {
      const chemin = rel(abs)
      if (chemin === 'src/lib/crmDark.ts') continue
      const lu = readFileSafely(abs)
      if (lu.status !== 'ok') continue
      const code = lu.value
        .replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length))
        .replace(/\/\/[^\n]*/g, ' ')
      code.split('\n').forEach((ligne, i) => {
        if (/'megga\.(sugar|crm)\.dark'/.test(ligne)) fautifs.push(`${chemin}:${i + 1}`)
      })
    }
    expect(
      fautifs,
      'la clé de thème est écrite hors de `lib/crmDark.ts` — la migration ne peut pas ' +
        'atteindre ce site, qui lira une clé vide et rendra le mauvais thème :\n  ',
    ).toEqual([])
  })
})
