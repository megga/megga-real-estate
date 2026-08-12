/**
 * Garde-fou : `useFocusTrap` piège VRAIMENT, y compris quand il n'y a rien à
 * focaliser.
 *
 * ⛔ POURQUOI CE FICHIER EXISTE. Le hook a passé une passe de câblage complète
 * sur 23 modales sans que personne voie qu'il ne faisait RIEN sur deux d'entre
 * elles. Le défaut : sans descendant focalisable, `focusable[0]` est
 * `undefined`, plus rien n'est focalisé, le focus reste sur le DÉCLENCHEUR — donc
 * dehors — et le gestionnaire de tabulation, qui ne compare qu'aux extrémités
 * exactes de la liste, ne matche jamais. La modale s'affiche, déclare
 * `aria-modal`, pose un voile plein écran, et la première tabulation s'en va
 * dans la page derrière.
 *
 * Rien ne le signalait : pas d'exception, pas de log, pas de type faux. Le seul
 * oracle est le COMPORTEMENT au clavier — c'est ce que ce fichier éprouve, et
 * c'est pourquoi les cas sans élément focalisable y pèsent plus que les autres.
 *
 * ⚠ Ces tests montent le hook dans jsdom, qui n'implémente PAS la navigation
 * par tabulation : presser Tab n'y déplace aucun focus. On n'éprouve donc pas
 * « le focus va au bon endroit » mais « le hook intervient » — `preventDefault`
 * appelé, focus reposé là où il faut. La preuve de bout en bout est ailleurs,
 * au clavier, dans un vrai navigateur (`/dev/modales` et les autres bancs).
 *
 * ⚠ Montage par `react-dom/client`, sans `@testing-library/react` : le dépôt ne
 * l'a pas, et aucun autre test unitaire ne rend du React. Une dépendance pour un
 * fichier serait un coût permanent pour une commodité. Le composant attache la
 * ref comme le ferait la production — poser `ref.current` à la main testerait
 * un chemin qui n'existe pas.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { createElement, act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useFocusTrap } from '@/hooks/useFocusTrap'

// Exigé par React pour que `act` encadre les effets sans avertir.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let racine: Root | null = null

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  document.body.innerHTML = ''
})

/** Composant minimal : le hook, sa ref, et le contenu demandé. */
function Modale({ enfants, onEscape }: { enfants: ReactNode; onEscape?: () => void }) {
  const ref = useFocusTrap(true, onEscape)
  return createElement('div', { ref, role: 'dialog' }, enfants)
}

/** Monte un déclencheur focalisé (hors modale) puis la modale elle-même. */
function monter(enfants: ReactNode, onEscape?: () => void) {
  const dehors = document.createElement('button')
  dehors.textContent = 'dehors'
  document.body.appendChild(dehors)
  dehors.focus()

  const hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  act(() => racine!.render(createElement(Modale, { enfants, onEscape })))

  const conteneur = hote.querySelector('[role="dialog"]') as HTMLDivElement
  return { conteneur, dehors }
}

/** Boutons enfants, dans l'ordre. */
const boutons = (...libelles: string[]) =>
  libelles.map((l) => createElement('button', { key: l }, l))

/** Presse Tab sur le document et rend l'événement (pour lire `defaultPrevented`). */
function tabuler(shift = false) {
  const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true })
  document.dispatchEvent(e)
  return e
}

describe('useFocusTrap', () => {
  it('pose le focus sur le premier élément focalisable', () => {
    const { conteneur } = monter(boutons('un', 'deux'))
    expect(document.activeElement).toBe(conteneur.querySelector('button'))
  })

  /**
   * ⛔ LE TEST QUI PORTE LE FICHIER — le défaut mesuré sur `ui/Sheet` et sur la
   * feuille de notifications mobile. Retirer le repli du hook fait rougir
   * celui-ci ET le suivant, et EUX SEULS : c'est le contrôle négatif.
   */
  it('piège même un conteneur SANS élément focalisable', () => {
    const { conteneur, dehors } = monter(createElement('p', null, 'rien de focalisable ici'))
    expect(document.activeElement, 'le focus est resté sur le déclencheur, DEHORS').not.toBe(dehors)
    expect(document.activeElement).toBe(conteneur)
    expect(conteneur.getAttribute('tabindex')).toBe('-1')
  })

  it('retient la tabulation dans un conteneur vide', () => {
    monter(createElement('p', null, 'rien de focalisable ici'))
    expect(tabuler().defaultPrevented, 'la tabulation est sortie de la modale').toBe(true)
    expect(tabuler(true).defaultPrevented).toBe(true)
  })

  /**
   * Le focus peut se retrouver dehors autrement qu'en tabulant : un nœud retiré
   * sous le curseur, un `focus()` posé par du code tiers. Le piège doit le
   * ramener au lieu d'attendre qu'il repasse par une extrémité de la liste.
   */
  it('ramène un focus qui a déjà quitté le conteneur', () => {
    const { conteneur, dehors } = monter(boutons('un', 'deux'))
    dehors.focus()
    expect(tabuler().defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(conteneur.querySelector('button'))
  })

  it('cycle du dernier au premier, et inversement', () => {
    const { conteneur } = monter(boutons('un', 'deux'))
    const [premier, dernier] = [...conteneur.querySelectorAll('button')]

    dernier.focus()
    expect(tabuler().defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(premier)

    premier.focus()
    expect(tabuler(true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(dernier)
  })

  it('ne retient PAS la tabulation au milieu de la liste', () => {
    const { conteneur } = monter(boutons('un', 'deux', 'trois'))
    const milieu = conteneur.querySelectorAll('button')[1]
    milieu.focus()
    // jsdom ne déplace pas le focus ; ce qui compte est que le hook n'intervienne
    // pas, sinon il écraserait la navigation naturelle du navigateur.
    expect(tabuler().defaultPrevented).toBe(false)
  })

  describe('Échap', () => {
    function echapper(prevenu = false) {
      const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      if (prevenu) e.preventDefault()
      document.dispatchEvent(e)
      return e
    }

    it('appelle onEscape', () => {
      let appels = 0
      monter(boutons('un'), () => { appels += 1 })
      echapper()
      expect(appels).toBe(1)
    })

    /**
     * ⚠ Un gestionnaire INTERNE qui a déjà consommé Échap (fermeture d'une
     * liste déroulante) ne doit pas fermer la modale par-dessus — mesuré sur le
     * sélecteur de cantons.
     */
    it('ignore un Échap déjà consommé', () => {
      let appels = 0
      monter(boutons('un'), () => { appels += 1 })
      echapper(true)
      expect(appels).toBe(0)
    })

    it('ne casse pas quand aucun onEscape n’est passé', () => {
      monter(boutons('un'))
      expect(() => echapper()).not.toThrow()
    })
  })
})
