/**
 * « Aujourd'hui » à une page (lot E1, conception `2026-09-27-matching-lot-e1-bureau-design.md` §4.4 et §8). Le
 * catalogue de matchs, sa seconde page, est retiré : un refus y portait « Nouveau », la baisse de prix y valait 0 en dur,
 * et il chargeait tous les matchs de l'agence. Le segment Matching de la page (lot D1) et le fil de matchs en tiennent
 * lieu.
 *
 * Ce que cette spec refuse :
 *   · une seconde page rendue par l'écran, sous quelque nom que ce soit, ou le catalogue revenu ;
 *   · un point de page, un indice de molette, un rail qui glisse, ou une page retenue par l'onglet ;
 *   · un changement de page à la molette, au toucher ou aux touches de page (↑/↓, PageUp/PageDown) ;
 *   · un autre membre que `navigate` dans le contexte de navigation de l'écran (`goToPage` y était) ;
 *   · les libellés du pager et du catalogue (`today.pager.*`, `today.catalogue.*`, `today.focus.viewCatalogue`), dans
 *     l'une des quatre langues.
 *
 * Lecture du code, commentaires retirés : l'écran n'a pas de spec de rendu, et ce qu'on refuse ici est une structure
 * — des pages, des écouteurs, des clés —, pas un état. D'où un INVENTAIRE plutôt qu'une liste de noms interdits : un
 * pager revenu sous d'autres noms passerait une liste noire.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const R = process.cwd()
const ECRAN = 'src/pages/agent/TodayPage.tsx'

/** Le code d'un fichier sans ses commentaires : ce qui compte est ce qu'il fait, pas ce qu'il raconte. */
function code(fichier: string): string {
  return readFileSync(join(R, fichier), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('« Aujourd’hui » à une page', () => {
  it('l’écran ne rend que sa coquille et la page du jour, une fois', () => {
    // Un élément JSX suit un blanc, `(`, `{` ou `>` ; un générique (`Record<…>`) suit un identifiant.
    const composants = new Set([...code(ECRAN).matchAll(/(?:^|[\s({>])<([A-Z]\w*)/gm)].map((m) => m[1]))
    expect([...composants].sort()).toEqual(['CrmWorkspace', 'PageAujourdhuiH', 'TodayNavProvider'])
    expect(code(ECRAN).match(/<PageAujourdhuiH\b/g)).toHaveLength(1)
  })

  it('le catalogue de matchs n’existe plus', () => {
    expect(existsSync(join(R, 'src/components/crm/today/PageCatalogue.tsx'))).toBe(false)
  })

  it('aucun geste de page : ni écouteur, ni touche de page, ni rail qui glisse, ni page retenue par l’onglet', () => {
    const c = code(ECRAN)
    // Ni `addEventListener`, ni gestionnaire de molette, de toucher ou de clavier — propriété du DOM ou prop React.
    expect(c).not.toMatch(/addEventListener|\bon(?:key\w*|wheel|touch\w*)\s*=|\bon(?:Wheel|Touch\w*|Key\w*)=\{/)
    expect(c).not.toMatch(/\b(?:PageUp|PageDown|ArrowUp|ArrowDown)\b/)
    // L'écran ne tient plus aucun état d'onglet : il n'a plus de page à retenir, sous quelque clé que ce soit.
    expect(c).not.toMatch(/translateY\(\$\{|willChange|\buseTabScopedState\b/)
  })

  it('le contexte de navigation de l’écran ne porte que `navigate`', () => {
    const corps = code('src/components/crm/today/TodayNavContext.tsx').match(/export interface TodayNav \{([\s\S]*?)\n\}/)
    expect(corps).not.toBeNull()
    expect([...corps![1].matchAll(/^\s*(\w+)\??\s*[:(]/gm)].map((m) => m[1])).toEqual(['navigate'])
    expect(code(ECRAN)).not.toMatch(/\bgoToPage\b/)
  })

  it.each(['fr', 'de', 'en', 'it'])('%s : ni les libellés du pager, ni ceux du catalogue', (langue) => {
    const { today } = JSON.parse(readFileSync(join(R, `src/i18n/locales/${langue}/dashboard.json`), 'utf8')) as {
      today: Record<string, unknown> & { focus?: Record<string, unknown> }
    }
    expect(Object.keys(today)).toContain('h')
    expect(Object.keys(today)).not.toContain('pager')
    expect(Object.keys(today)).not.toContain('catalogue')
    expect(Object.keys(today.focus ?? {})).toContain('upNext')
    expect(Object.keys(today.focus ?? {})).not.toContain('viewCatalogue')
  })
})
