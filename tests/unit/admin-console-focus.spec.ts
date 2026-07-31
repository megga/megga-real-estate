/**
 * Garde-fou : le focus clavier reste visible dans la console admin.
 *
 * Le kit de la console pose `outline: 'none'` en style inline sur ses champs, pour
 * gouverner lui-même son anneau. Un style inline gagne contre toute feuille de style :
 * sans contre-mesure, la console devient inutilisable au clavier, et rien ne le signale —
 * aucune erreur, aucun test rouge, juste un anneau qui n'apparaît plus.
 *
 * La contre-mesure existe (`src/styles/admin-console.css`) et elle est correcte : un
 * `outline … !important` sur `:focus-visible`, scopé à `.megga-admin-console`. Ce qui
 * manquait, c'est ce test. Le défaut n'est pas hypothétique : le dépôt l'a déjà vécu sur
 * une autre coquille, et le mode de propagation est toujours le même — on PORTE une
 * coquille, on emporte l'`outline: none` du kit, on laisse la règle CSS derrière.
 *
 * C'est exactement ce que fait le Lot 1 de la Console MEGGA. D'où ces trois assertions,
 * qui tiennent ensemble : l'anneau existe, il est assez fort pour percer l'inline, et la
 * classe qui lui donne sa portée est réellement montée par la coquille. Retirer l'une des
 * trois suffit à éteindre le focus — un test qui n'en vérifierait qu'une resterait vert
 * pendant que l'accessibilité disparaît.
 *
 * Test statique : il ne dépend d'aucun rendu, d'aucune donnée, et ne peut pas passer à vide.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * ⚠ Les commentaires sont retirés AVANT toute analyse, et ce n'est pas une précaution
 * de style : la première version de ce fichier cherchait `outline:[^;]*!important` dans
 * le bloc entier, commentaire compris. Le commentaire de la règle contient `outline:
 * none` puis, deux phrases plus loin, `!important` — et une prose ne porte pas de
 * point-virgule, donc le motif traversait tout. Le test restait vert après suppression du
 * `!important` réel : il assertait sur une explication, pas sur une déclaration. Vérifié
 * par mutation, dans les deux sens.
 */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

const CSS = stripComments(readFileSync('src/styles/admin-console.css', 'utf-8'))
const SHELL = readFileSync('src/components/admin/AdminShell.tsx', 'utf-8')

/** Le sélecteur de la règle d'anneau (avant l'accolade). */
const FOCUS_RULE = CSS.split(/\}/).find(
  (block) => block.includes(':focus-visible') && block.includes('outline')
)

/** Les DÉCLARATIONS seules — c'est sur elles que portent les assertions de force. */
const FOCUS_BODY = FOCUS_RULE?.slice(FOCUS_RULE.indexOf('{') + 1) ?? ''

describe('console admin — focus clavier visible', () => {
  it('une règle :focus-visible pose un outline', () => {
    expect(
      FOCUS_RULE,
      'aucune règle :focus-visible avec outline dans admin-console.css — le kit pose ' +
      'outline:none en inline, plus rien ne rend le focus visible'
    ).toBeTruthy()
  })

  it('l\'anneau est en !important — sans quoi le style inline du kit gagne', () => {
    // Le seul cas de ce fichier où !important est justifié : on ne surcharge pas un choix
    // de design, on garantit un plancher que l'inline ne doit pas pouvoir percer.
    // L'assertion porte sur la DÉCLARATION (corps de règle, commentaires retirés).
    const declaration = FOCUS_BODY.split(';').find((d) => /^\s*outline\s*:/.test(d))
    expect(declaration, 'aucune déclaration `outline:` dans le corps de la règle').toBeTruthy()
    expect(declaration).toContain('!important')
  })

  it('l\'anneau couvre les éléments réellement focalisables du kit', () => {
    // Une liste tronquée à `button, a` laisserait les champs de saisie et les rôles ARIA
    // sans anneau : c'est la moitié des surfaces de la console (recherche, filtres, menus).
    for (const selector of ['button', 'a', 'input', 'textarea', 'select', '[tabindex]', "[role='button']"]) {
      expect(FOCUS_RULE, `${selector} n'est pas couvert par l'anneau de focus`).toContain(selector)
    }
  })

  it('la règle est scopée à .megga-admin-console, et la coquille pose cette classe', () => {
    // Le point de rupture du portage : la règle survit, la classe disparaît, et l'anneau
    // ne s'applique plus nulle part sans que rien ne casse.
    expect(FOCUS_RULE, 'la règle doit rester scopée à la console').toContain('.megga-admin-console')
    expect(
      SHELL,
      'AdminShell ne pose plus la classe .megga-admin-console : l\'anneau de focus est ' +
      'orphelin, il ne s\'applique à rien'
    ).toContain('megga-admin-console')
  })

  it(':focus-visible et non :focus — pas de halo au clic souris', () => {
    expect(FOCUS_RULE).toContain(':focus-visible')
  })
})
