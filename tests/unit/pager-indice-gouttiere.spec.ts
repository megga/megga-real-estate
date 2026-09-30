/**
 * L'indice de molette d'un pager vit dans la GOUTTIÈRE sous son cadre (revue UX du 29.09.2026). Celui du Matching,
 * monté hors de l'espace de travail, se calait sur le bord de l'écran — sous la barre latérale ; celui de Mes biens,
 * posé dans le coin du cadre, chevauchait les cartes, et leur libellé, révélé au survol, recouvrait le contenu.
 *
 * Ce que cette spec refuse, pour chaque pager :
 *   · un indice monté hors du `<main>` de la page, ou dans un `<main>` qui n'est pas son bloc de positionnement ;
 *   · un indice qui ne serait pas adossé au bas de la page (`bottom: 0`) ;
 *   · une hauteur d'indice qui ne serait pas celle de la gouttière — le `paddingBottom` du `<main>`, même jeton.
 *
 * Lecture du code : le rendu du pager de Matching est éprouvé à part (`matching-pager.spec.tsx`) ; celui de Mes biens
 * n'a pas de spec de rendu.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGERS = [
  { fichier: 'src/pages/agent/MatchingPage.tsx', indice: 'MatchingScrollHint' },
  { fichier: 'src/components/crm/biens/pager/BiensPager.tsx', indice: 'BpgScrollHint' },
] as const

const GOUTTIERE = "'var(--crm-space-6xl)'"

describe('l’indice de molette d’un pager, dans la gouttière sous le cadre', () => {
  for (const { fichier, indice } of PAGERS) {
    it(indice, () => {
      const source = readFileSync(join(process.cwd(), fichier), 'utf8')

      const corps = source.slice(source.indexOf(`function ${indice}(`))
      const composant = corps.slice(0, corps.indexOf('\n}\n'))
      expect(composant).toMatch(/position: 'absolute', bottom: 0,/)
      expect(composant).toContain(`height: ${GOUTTIERE}`)

      const main = /<main style=\{\{([^\n]*)\}\}>/.exec(source)?.[1] ?? ''
      expect(main).toContain("position: 'relative'")
      expect(main).toContain(`paddingBottom: ${GOUTTIERE}`)

      const ouverture = source.indexOf('<main ')
      const montage = source.indexOf(`<${indice} `)
      expect(montage, 'monté dans le <main>').toBeGreaterThan(ouverture)
      expect(montage, 'monté dans le <main>').toBeLessThan(source.indexOf('</main>', ouverture))
    })
  }
})
