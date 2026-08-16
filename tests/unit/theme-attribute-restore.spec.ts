/**
 * `data-theme` est un attribut GLOBAL, partagé par deux conventions.
 *
 * Le CRM le pose toujours explicitement ('light' ou 'dark') depuis sa clé
 * `megga-theme` ; les surfaces Sugar, dont la console admin, disent le clair par
 * l'ABSENCE de l'attribut et lisent `megga.sugar.dark`. Tant que la console
 * était une application à part, elle possédait son `<html>` et pouvait en faire
 * ce qu'elle voulait. Refusionnée dans le CRM, elle l'écrase le temps de sa vie
 * — et sans restauration, revenir au CRM le laissait dans le mode de la
 * console, jusqu'à une bascule manuelle : le provider du CRM n'a aucune raison
 * de relancer son effet, son propre état n'ayant pas bougé.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { applyCrmThemeAttribute, captureThemeAttribute } from '@/lib/crmDark'
import { readFileSafely, rel, scanRoots } from './helpers/fs-scan'

describe('data-theme — emprunt et restitution', () => {
  let root: HTMLElement

  beforeEach(() => {
    root = document.documentElement
    root.removeAttribute('data-theme')
  })

  it('rend un CRM sombre après un passage en console claire', () => {
    root.setAttribute('data-theme', 'dark') // le CRM, avant l'entrée en console

    const restore = captureThemeAttribute(root)
    applyCrmThemeAttribute(root, false) // console en clair : l'attribut saute
    expect(root.getAttribute('data-theme')).toBeNull()

    restore()
    expect(root.getAttribute('data-theme')).toBe('dark')
  })

  it('rend un CRM clair après un passage en console sombre', () => {
    root.setAttribute('data-theme', 'light')

    const restore = captureThemeAttribute(root)
    applyCrmThemeAttribute(root, true)
    expect(root.getAttribute('data-theme')).toBe('dark')

    restore()
    expect(root.getAttribute('data-theme')).toBe('light')
  })

  it("laisse l'attribut absent s'il l'était au départ", () => {
    // Cas d'une surface Sugar en clair : l'absence est un état, pas un oubli.
    const restore = captureThemeAttribute(root)
    applyCrmThemeAttribute(root, true)
    restore()
    expect(root.hasAttribute('data-theme')).toBe(false)
  })

  it('restitue la valeur de départ, pas la dernière appliquée', () => {
    // Bascules successives dans la console : seule la valeur capturée compte.
    root.setAttribute('data-theme', 'light')
    const restore = captureThemeAttribute(root)
    applyCrmThemeAttribute(root, true)
    applyCrmThemeAttribute(root, false)
    applyCrmThemeAttribute(root, true)
    restore()
    expect(root.getAttribute('data-theme')).toBe('light')
  })
})

/**
 * ⛔ QU'UN HELPER EXISTE NE PROUVE PAS QU'UNE SURFACE S'EN SERVE, et c'est
 * exactement par là que le défaut a survécu.
 *
 * Les quatre clauses ci-dessus éprouvent `captureThemeAttribute` lui-même. Elles
 * étaient VERTES pendant qu'`AuthBentoApp` — troisième écrivain de l'attribut —
 * ne le retirait ni ne le restituait : sur les trois, `useTheme` retirait,
 * `crmDark` restituait, et le troisième ne faisait ni l'un ni l'autre. Une garde
 * qui mesure un OUTIL ne voit pas ses non-usagers ; celle-ci mesure la RÈGLE.
 *
 * ⚠ Elle a été écrite le 17 août 2026, après coup. Le défaut qu'elle attrape
 * était LATENT — chaque sortie d'`AuthBentoApp` est une navigation de document,
 * et `ThemeProvider` repose l'attribut au montage du CRM — donc aucun test de
 * rendu ne l'aurait vu échouer. C'est une règle de discipline, pas une reproduction
 * de bogue, et c'est pour ça qu'elle se mesure sur la SOURCE.
 */
describe('data-theme — tout écrivain le rend', () => {
  const ECRIT = /dataset\.theme\s*=|setAttribute\(\s*['"]data-theme['"]/
  const REND = /removeAttribute\(\s*['"]data-theme['"]|captureThemeAttribute/

  /**
   * ⛔ LE SEUL EXEMPTÉ, ET IL L'EST PAR NATURE : `crmDark.ts` DÉFINIT les deux
   * gestes. C'est lui qu'on cite comme règle ; il ne peut pas s'y conformer.
   */
  const DEFINIT_LA_REGLE = 'src/lib/crmDark.ts'

  const sansCommentaires = (c: string) =>
    c.replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length)).replace(/\/\/[^\n]*/g, ' ')

  const SOURCES = scanRoots([{ root: 'src', keep: (n) => /\.tsx?$/.test(n) }]).files
    .map((abs) => {
      const lu = readFileSafely(abs)
      return { chemin: rel(abs), code: lu.status === 'ok' ? sansCommentaires(lu.value) : '' }
    })

  /** Sans lui, un balayage cassé rendrait la clause verte pour rien (n° 18). */
  it('le balayage voit la source, et les deux motifs matchent encore', () => {
    expect(SOURCES.length, 'zone vide : chemin cassé').toBeGreaterThan(200)
    expect(ECRIT.test("root.setAttribute('data-theme', t)"), "le motif d'écriture ne matche plus").toBe(true)
    expect(ECRIT.test('document.documentElement.dataset.theme = theme'), "la forme `dataset` n'est plus vue").toBe(true)
    expect(REND.test('captureThemeAttribute(document.documentElement)'), 'le motif de restitution ne matche plus').toBe(true)

    // ⚠ TÉMOIN NOMMÉ : le fichier qui a motivé cette clause doit être VU comme écrivain.
    const ecrivains = SOURCES.filter((s) => ECRIT.test(s.code)).map((s) => s.chemin)
    expect(ecrivains, 'AuthBentoApp n’est plus lu comme écrivain — le balayage a dérivé')
      .toContain('src/components/auth-bento/AuthBentoApp.tsx')
  })

  it('chaque fichier qui écrit `data-theme` le retire ou le capture', () => {
    const fautifs = SOURCES
      .filter((s) => s.chemin !== DEFINIT_LA_REGLE)
      .filter((s) => ECRIT.test(s.code) && !REND.test(s.code))
      .map((s) => s.chemin)
    expect(
      fautifs,
      '`data-theme` est GLOBAL : une surface qui l’impose le temps de sa vie doit le rendre en ' +
        'partant, sinon elle laisse le reste de l’application dans SON réglage :\n  ' +
        fautifs.join('\n  '),
    ).toEqual([])
  })

  /** ⚠ Une exemption qui ne correspond plus à rien laisse croire qu’un écart est couvert. */
  it('le fichier exempté écrit toujours, et définit toujours la règle', () => {
    const regle = SOURCES.find((s) => s.chemin === DEFINIT_LA_REGLE)
    expect(regle, `${DEFINIT_LA_REGLE} : absent du balayage — l’exemption ne garde plus rien`).toBeDefined()
    expect(ECRIT.test(regle!.code), `${DEFINIT_LA_REGLE} n’écrit plus l’attribut : exemption périmée`).toBe(true)
    expect(REND.test(regle!.code), `${DEFINIT_LA_REGLE} ne définit plus la restitution`).toBe(true)
  })
})
