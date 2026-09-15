/**
 * Hook d'accessibilité : piège le focus clavier dans un conteneur tant que
 * `active` est vrai (modales, panneaux), puis restaure le focus au démontage.
 */
import { useEffect, useRef, useState } from 'react'
import { useEcranActif } from '@/hooks/useEcranActif'

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
 *
 * ⛔ Et le piège se LÈVE dans un écran d'onglet caché (`useEcranActif`). Sa garde
 * rattrape toute tabulation dont le focus est hors du conteneur : restée active
 * derrière l'onglet regardé, elle ramenait chaque Tab vers une modale invisible —
 * où `focus()` échoue — et la tabulation ne marchait plus nulle part. Il se
 * réarme au retour sur l'écran, focus dans la modale.
 */
export function useFocusTrap(active: boolean, onEscape?: () => void) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onEscapeRef = useRef(onEscape)
  useEffect(() => { onEscapeRef.current = onEscape })
  const ecranActif = useEcranActif()
  const arme = active && ecranActif

  // Le focus d'AVANT l'ouverture, lu au RENDU qui ouvre. L'effet arrive trop tard quand le
  // contenu porte un `autoFocus` : React l'a déjà appliqué, et le piège retenait le champ de
  // la modale — détaché à la fermeture — au lieu du bouton qui l'avait ouverte (revue du
  // 15.09.2026 : fermer « Nouveau message » laissait le focus sur `body`).
  const [avantOuverture, setAvantOuverture] = useState<Element | null>(() => (active ? document.activeElement : null))
  const [etaitActif, setEtaitActif] = useState(active)
  if (active !== etaitActif) {
    setEtaitActif(active)
    setAvantOuverture(active ? document.activeElement : null)
  }
  // Le focus que le piège avait DANS le conteneur quand il s'est levé. Rendre le focus au
  // déclencheur ne vaut que pour une vraie fermeture : un piège qui se RÉARME — retour sur son
  // écran, ou le démontage simulé du mode strict — le rend là où il était, pas à la croix.
  const dernierDedansRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!arme) return
    const container = containerRef.current
    if (!container) return

    // ⚠ Un focus DÉJÀ posé dans le conteneur est gardé : c'est un `autoFocus`, que React
    // applique au montage, AVANT cet effet. Le piège le déplaçait sur le premier
    // focalisable — la croix de fermeture —, et « Nouveau message » s'ouvrait le curseur
    // hors du champ « À » qu'il désignait (mesuré le 14.09.2026 : focus sur « Fermer »).
    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    const dejaDedans = container.contains(document.activeElement)
    // Sans `autoFocus`, le focus de l'instant reste le bon : deux pièges qui se passent la
    // main (confirmation, puis « fait ») rendent le focus au premier déclencheur.
    const precedent = dejaDedans ? avantOuverture : document.activeElement
    const retour = dernierDedansRef.current
    dernierDedansRef.current = null
    if (!dejaDedans && retour?.isConnected && container.contains(retour)) {
      retour.focus()
    } else if (!dejaDedans && focusable.length > 0) {
      focusable[0].focus()
    } else if (!dejaDedans) {
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
      const actif = document.activeElement
      if (actif instanceof HTMLElement && container.contains(actif)) dernierDedansRef.current = actif
      if (precedent instanceof HTMLElement && precedent.isConnected) precedent.focus()
    }
  }, [arme, avantOuverture])

  return containerRef
}
