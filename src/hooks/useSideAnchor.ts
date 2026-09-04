/**
 * Pose latérale d'une popover ancrée dans la barre latérale du CRM.
 *
 * Extrait de `CrmNotificationsPopover` le 4 septembre 2026, pour une raison de
 * mécanique plus que de rangement : exporter un hook depuis un fichier de
 * composant casse le rafraîchissement à chaud (`react-refresh/only-export-components`,
 * en ERREUR dans ce dépôt). Les deux popovers de la barre — notifications et
 * compte — le partagent.
 */
import { useEffect, useRef, useState } from 'react'

/**
 * Où la popover se pose, relativement à son ancre.
 *
 * ⛔ Elle n'avait AUCUN réglage : `top: calc(100% + 10px); right: 0` était écrit
 * en dur, parce que son unique ancre était la cloche d'une barre HORIZONTALE.
 * Ancrée à une ligne de la barre latérale, cette pose la ferait déborder de
 * 136 px hors de l'écran à gauche — 316 px barre repliée.
 */
export type CrmPopoverPlacement = 'below-right' | 'side'

/** Gouttière entre l'ancre et la popover, et marge minimale au bord de fenêtre. */
const SIDE_GAP = 10
const VIEWPORT_EDGE = 12
/** Durée de la sonde — couvre les 250 ms de glissade de la barre, avec du mou. */
const SONDE_MS = 400

/**
 * Pose latérale : à droite de l'ancre, alignée sur son BAS, et REMONTÉE si elle
 * dépassait sous la fenêtre.
 *
 * ⛔ Une pose purement déclarative ne suffit pas ici, et les deux essais naïfs
 * échouent de façon symétrique : `top: 0` (aligné sur le haut de l'ancre) fait
 * sortir par le BAS une popover ancrée à une ligne basse — mesuré, la cloche est
 * à 753 px dans une fenêtre de 900 et la popover fait 232 px ; `bottom: 0` ferait
 * sortir par le HAUT si l'ancre était près du sommet. Il faut donc mesurer, puis
 * borner — ce que fait déjà, dans ce même fichier, le menu « ⋯ » d'une ligne.
 *
 * ⛔ LA MESURE PASSE PAR UNE SONDE rAF, PAS PAR UN `ResizeObserver` — et ce
 * n'est pas une préférence. Première écriture faite à l'observateur, en
 * s'appuyant sur sa livraison initiale (« Observation will fire when observation
 * starts if Element is being rendered ») : la popover est restée garée à
 * -9999 px. Mesuré dans la page, sur les deux éléments réellement rendus —
 * `new ResizeObserver(…)` posé sur la popover ET sur son ancre a rendu **zéro
 * livraison en 500 ms**. La sonde rAF, elle, tient aussi les 250 ms de glissade
 * de la barre : on remesure à chaque frame pendant `SONDE_MS`, puis on s'arrête.
 *
 * ⚠ Le `setState` vit dans le rappel de la frame, jamais dans le corps de
 * l'effet — la règle `react-hooks` du dépôt refuse le second — et il court-circuite
 * sur l'égalité, donc une boîte stable ne provoque aucun re-rendu.
 */
export function useSideAnchor(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    const anchor = el?.parentElement
    if (!enabled || !el || !anchor) { return }
    const place = () => {
      const a = anchor.getBoundingClientRect()
      const h = el.offsetHeight
      const plafond = window.innerHeight - h - VIEWPORT_EDGE
      setBox(prev => {
        const next = {
          left: Math.round(a.right + SIDE_GAP),
          top: Math.round(Math.max(VIEWPORT_EDGE, Math.min(a.bottom - h, plafond))),
        }
        return prev && prev.left === next.left && prev.top === next.top ? prev : next
      })
    }
    // ⛔ MESURE INITIALE HORS rAF, et c'est la seconde correction du même piège.
    // Une sonde rAF seule laisse la popover garée à -9999 px dès que le rendu
    // est gelé — onglet en arrière-plan, volet d'aperçu masqué : mesuré, le
    // rappel de frame ne tire PAS, et `ResizeObserver` non plus (sa livraison
    // est accrochée au même cycle de rendu). Un microtask, lui, tire toujours,
    // et la mise en page est déjà résolue quand un effet s'exécute.
    queueMicrotask(place)
    let raf = 0
    const t0 = performance.now()
    const tick = () => {
      place()
      if (performance.now() - t0 < SONDE_MS) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    window.addEventListener('resize', place)
    // ⚠ En CAPTURE, et c'est ce qui compte : l'ancre vit dans la liste de nav de
    // la barre, qui a son propre `overflow-y: auto`. Un défilement de CETTE
    // liste ne remonte pas jusqu'à `window` en phase de bulle — la popover
    // resterait plantée à sa place pendant que sa ligne s'en va. La capture
    // attrape le défilement de n'importe quel ancêtre.
    window.addEventListener('scroll', place, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [enabled])

  return { ref, box }
}

