/**
 * Garde-fou : une capture de référence ne survit pas à l'écran qu'elle décrit.
 *
 * ⛔ POURQUOI CE FICHIER EXISTE. Le 15 août 2026, la seule capture gardée du
 * dépôt — `/dashboard/pipeline` — a survécu à un redesign complet du kanban
 * (rainures supprimées, rayons à 0, board qui bleede aux quatre filets). Mesuré
 * sur la CI : **10 067 pixels sur 921 600, soit 1,09 %** contre un seuil de 1 %.
 * Un commit a rougi, le SUIVANT est repassé au vert contre la même référence
 * périmée. Mode d'échec : **verte et fausse** — la capture décrit un écran qui
 * n'existe plus, et la porte l'accepte. `megga/gardes-vacuites` n° 44.
 *
 * ⚠ AUCUN SEUIL NE RÉPARE ÇA, et c'est la leçon transférable. Un seuil répond à
 * « de combien l'image a-t-elle bougé ». Il ne peut pas répondre à « cette
 * référence décrit-elle encore l'écran ». Ce sont deux questions, il faut deux
 * clauses. Le lot 0 du chantier l'a montré par la mesure : peupler l'écran
 * n'achetait que ×1,1 de sensibilité, donc le sujet n'était pas le levier.
 *
 * ⚠ CE QUE CETTE GARDE NE FAIT PAS : elle ne dit rien de la RESSEMBLANCE entre
 * la capture et l'écran. Elle dit seulement que les sources ont bougé depuis.
 * C'est `visual-regression.spec.ts` qui compare les pixels ; ici on garde le
 * RATTACHEMENT. Les deux ensemble couvrent ce qu'aucune ne couvre seule.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { repoPath } from './helpers/fs-scan'
import {
  CHEMIN_EMPREINTES,
  ECRANS,
  empreinteEcran,
  empreintesCourantes,
} from '../../scripts/_shared/visual-baseline-empreinte.mjs'

const RACINE = repoPath('.')
const DOSSIER_CAPTURES = 'tests/e2e/visual-regression.spec.ts-snapshots'

describe('Fraîcheur des captures de référence', () => {
  /**
   * Sans lui, tout le reste passerait par vacuité : une empreinte calculée sur
   * ZÉRO fichier est parfaitement stable et ne décrit rien.
   */
  it('le balayage lit vraiment les sources de chaque écran', () => {
    const noms = Object.keys(ECRANS)
    expect(noms.length, 'aucun écran inventorié').toBeGreaterThan(0)
    for (const nom of noms) {
      const { fichiers, empreinte } = empreinteEcran(nom, RACINE)
      expect(fichiers.length, `${nom} : aucun fichier lu`).toBeGreaterThan(3)
      expect(empreinte, `${nom} : empreinte vide`).toMatch(/^[0-9a-f]{16}$/)
      // Témoins NOMMÉS plutôt qu'un compte : un compte se périme au premier
      // fichier ajouté légitimement, un témoin décrit le BALAYAGE.
      expect(fichiers, `${nom} : la page n'est plus lue`).toContain('src/pages/agent/PipelineSugarV2Page.tsx')
      expect(
        fichiers.some((f: string) => f.includes('crm-sugar/pipeline/SugarStageColumn')),
        `${nom} : la colonne de kanban n'est plus lue`,
      ).toBe(true)
    }
  })

  /**
   * ⛔ L'INVENTAIRE DÉCRIT ENCORE LE DÉPÔT. Un chemin renommé ferait lire zéro
   * fichier — et une empreinte de rien est stable pour toujours. La clause
   * précédente l'attrape par le compte ; celle-ci le dit à l'endroit exact.
   */
  it('chaque chemin inventorié existe encore', () => {
    const manquants: string[] = []
    for (const [nom, chemins] of Object.entries(ECRANS) as [string, string[]][]) {
      for (const c of chemins) if (!existsSync(`${RACINE}/${c}`)) manquants.push(`${nom} → ${c}`)
    }
    expect(manquants, `chemin inventorié absent du dépôt :\n  ${manquants.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ CHAQUE CAPTURE EST RATTACHÉE À UN ÉCRAN. Une capture sans empreinte est
   * exactement l'état du 15 août : une image que plus rien ne relie au code.
   */
  it('aucune capture n’est orpheline, aucune empreinte sans capture', () => {
    const captures = readdirSync(`${RACINE}/${DOSSIER_CAPTURES}`)
      .filter((f) => f.endsWith('.png'))
      // `nom-chromium-linux.png` → `nom`
      .map((f) => f.replace(/-[a-z]+-[a-z]+\.png$/, ''))
    const inventoriés = Object.keys(ECRANS)
    const orphelines = captures.filter((c) => !inventoriés.includes(c))
    const sansCapture = inventoriés.filter((n) => !captures.includes(n))
    expect(orphelines, `capture rattachée à aucun écran :\n  ${orphelines.join('\n  ')}`).toEqual([])
    expect(sansCapture, `écran inventorié sans capture :\n  ${sansCapture.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LA CLAUSE QUI AURAIT ATTRAPÉ LE 15 AOÛT.
   *
   * ⚠ Elle est délibérément CONSERVATRICE : elle empreinte le contenu des
   * sources, commentaires retirés — pas seulement les blocs de style. Un
   * `const PIPE_PAD_X = 34` ne ressemble pas à du style et déplace pourtant tout
   * le board. Un changement sans effet sur le rendu fera donc rougir, et
   * demandera une régénération. L'asymétrie est assumée : un faux ROUGE coûte un
   * commentaire de PR, un faux VERT a coûté la soirée.
   */
  it('la référence décrit encore l’écran', () => {
    expect(
      existsSync(`${RACINE}/${CHEMIN_EMPREINTES}`),
      `${CHEMIN_EMPREINTES} absent — les références ne sont rattachées à aucun écran`,
    ).toBe(true)
    const stockees = JSON.parse(readFileSync(`${RACINE}/${CHEMIN_EMPREINTES}`, 'utf8'))
    const courantes = empreintesCourantes(RACINE)
    const perimees = Object.entries(courantes)
      .filter(([k, v]) => stockees[k] !== v)
      .map(([k, v]) => `${k} : capture prise sur ${stockees[k] ?? '(rien)'}, écran à ${v}`)
    expect(
      perimees,
      `la référence ne décrit plus l'écran — commenter /regenerate-visual-baselines sur la PR :\n  ${perimees.join('\n  ')}`,
    ).toEqual([])
  })
})
