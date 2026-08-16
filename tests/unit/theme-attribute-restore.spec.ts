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
