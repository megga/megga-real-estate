/**
 * Hook d'accessibilité : piège le focus clavier dans un conteneur tant que
 * `active` est vrai (modales, panneaux), puis restaure le focus au démontage.
 */
import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps keyboard focus within a container element while active.
 * - Tab cycles through focusable elements inside the container
 * - Shift+Tab cycles backwards
 * - Focus is restored to the previously focused element on cleanup
 * - `onEscape` (optionnel) est appelé sur Échap
 *
 * ⚠ `onEscape` est OPTIONNEL, et il doit le rester : trois appelants de la
 * console admin passent un seul argument.
 *
 * ⚠ Il est lu par une REF, pas par les dépendances de l'effet. Les appelants
 * passent une fonction fléchée en ligne, donc son identité change à chaque
 * rendu : la mettre en dépendance ferait REJOUER le piège à chaque frappe, et
 * chaque rejeu déplace le focus sur le premier élément. Le champ qu'on est en
 * train de remplir perdrait le curseur à chaque caractère.
 *
 * ⚠ Échap est ignoré si un gestionnaire INTERNE l'a déjà consommé
 * (`defaultPrevented`). Sans ça, fermer une liste déroulante à l'intérieur de
 * la modale fermerait aussi la modale — mesuré sur le sélecteur de cantons.
 *
 * ⚠ Un conteneur SANS descendant focalisable est piégé quand même : il reçoit
 * `tabindex="-1"` et le focus. C'est le cas qui rendait ce hook silencieusement
 * inopérant — voir le commentaire du repli, et `focus-trap.spec.ts`.
 */
export function useFocusTrap(active: boolean, onEscape?: () => void) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onEscapeRef = useRef(onEscape)
  useEffect(() => { onEscapeRef.current = onEscape })

  useEffect(() => {
    if (!active) return

    // Save current focus to restore later
    previousFocusRef.current = document.activeElement as HTMLElement

    const container = containerRef.current
    if (!container) return

    // Focus first focusable element
    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    if (focusable.length > 0) {
      focusable[0].focus()
    } else {
      // ⛔ AUCUN DESCENDANT FOCALISABLE — le cas qui rendait ce hook INOPÉRANT
      // en silence. Sans ce repli, rien n'est focalisé : le focus RESTE sur le
      // déclencheur, donc DEHORS, et la première tabulation part dans la page
      // derrière la modale. Mesuré sur deux surfaces (`ui/Sheet`, la feuille de
      // notifications mobile) : elles déclaraient `aria-modal`, affichaient un
      // voile plein écran, et ne piégeaient rien.
      container.setAttribute('tabindex', '-1')
      container.focus()
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.defaultPrevented && onEscapeRef.current) {
        e.preventDefault()
        onEscapeRef.current()
        return
      }
      if (e.key !== 'Tab' || !container) return

      const focusableEls = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)

      // ⚠ Le filet qui rend le piège correct PAR CONSTRUCTION. Les deux tests
      // ci-dessous ne rattrapent le focus qu'aux extrémités exactes de la
      // liste ; dès qu'il est ailleurs qu'à l'intérieur — conteneur vide, nœud
      // retiré sous le curseur, focus posé par du code tiers — aucune branche
      // ne matche et la tabulation sort. On le ramène d'abord, on cycle ensuite.
      if (!container.contains(document.activeElement)) {
        e.preventDefault()
        if (focusableEls.length > 0) focusableEls[0].focus()
        else container.focus()
        return
      }
      if (focusableEls.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusableEls[0]
      const last = focusableEls[focusableEls.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // ⚠ On ne rend le focus qu'à un élément TOUJOURS DANS LE DOCUMENT.
      // Mesuré : une modale ouverte depuis un menu retient l'item de menu, or
      // le menu se ferme AVANT la modale — l'item est alors détaché, et
      // `.focus()` dessus ne fait rien tout en ayant l'air de réussir. Le garde
      // ne répare pas ce cas (le focus retombe sur `body`), il empêche
      // seulement de croire qu'il est réglé. Rendre le focus au DÉCLENCHEUR du
      // menu est le travail du menu, pas du piège.
      const precedent = previousFocusRef.current
      if (precedent?.isConnected) precedent.focus()
    }
  }, [active])

  return containerRef
}
