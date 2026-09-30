/**
 * « Aujourd'hui » — le geste d'une ligne est SECONDAIRE (revue UX du 29.09.2026). Chaque ligne des dossiers, des
 * annonces et du segment Matching portait un aplat d'accent : quatre à cinq boutons pleins par écran, et plus aucune
 * affordance principale. Sous MEGGA X, le primaire porte l'accent et le ghost est le secondaire (CLAUDE.md §3).
 *
 * Ce que cette spec refuse :
 *   · un bouton de ligne (`.hl-cta`) qui ne passe pas par `hlCtaStyle()` — un style recopié dériverait seul ;
 *   · un `hlCtaStyle` qui peindrait l'accent, en fond ou en encre.
 *
 * Lecture du code, commentaires retirés, comme `aujourdhui-une-page.spec.ts` : l'écran n'a pas de spec de rendu.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (fichier: string): string =>
  readFileSync(join(process.cwd(), fichier), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const ECRANS = ['src/components/crm/today/PageAujourdhuiH.tsx', 'src/components/crm/today/HlMatching.tsx']

describe('« Aujourd’hui » — le geste d’une ligne', () => {
  it('chaque bouton de ligne prend `hlCtaStyle()`', () => {
    let boutons = 0
    for (const fichier of ECRANS) {
      // La ligne entière : un `>` ne ferme pas la balise, `onClick={() => …}` en porte un.
      for (const [balise] of code(fichier).matchAll(/<button[^\n]*className="hl-cta"[^\n]*/g)) {
        boutons += 1
        expect(balise, fichier).toContain('style={hlCtaStyle()}')
      }
    }
    // Les dossiers, les annonces, le segment Matching : une liste vide passerait sans rien vérifier.
    expect(boutons).toBe(3)
  })

  it('`hlCtaStyle` ne peint pas l’accent : le fond de carte, un filet, l’encre de la page', () => {
    const tk = code('src/components/crm/today/tk.ts')
    const corps = tk.slice(tk.indexOf('export function hlCtaStyle'))
    const style = corps.slice(0, corps.indexOf('\n}\n'))
    expect(style).toContain('background: TK.card')
    expect(style).toContain('color: TK.ink')
    expect(style).not.toMatch(/accent/)
  })
})
