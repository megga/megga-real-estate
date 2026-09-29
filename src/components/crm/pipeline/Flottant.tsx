/**
 * Un panneau porté dans `<body>` et placé d'après son déclencheur — les menus des cartes du board
 * (`CardQuickActions`) et des pastilles du Timeline (`PipelineAgenda`), 27.09.2026.
 *
 * ⛔ POURQUOI UN PORTAIL. Positionnés dans leur carte ou leur ligne, les menus étaient coupés par la
 * colonne défilante (`overflow: hidden/auto`) : « …er une visite ». Même réponse que
 * `LabsFolderPicker` : porté, placé d'après le déclencheur, borné au cadre de page (`[data-cadre]`,
 * l'écran à défaut). À court de place d'un côté il s'ouvre de l'autre, à court de place en bas il
 * s'ouvre vers le haut.
 *
 * ⚠ Placé AVANT la peinture, à même le nœud (`useLayoutEffect`) : il se mesure sans second rendu,
 * donc sans saut visible. React ne réécrit pas ces trois propriétés, qui ne changent pas entre deux
 * rendus dans ses props.
 *
 * ⚠ Le survol n'en souffre pas : React calcule l'entrée et la sortie sur l'arbre des composants, où
 * le panneau porté reste DANS son déclencheur.
 */
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/** Écart minimal entre un panneau et le bord de ce qui le borne. */
const MARGE = 8

/** L'attribut que portent les panneaux : un défilement DANS l'un d'eux ne doit rien fermer. */
export const ATTR_FLOTTANT = 'data-flottant'

export function Flottant({ ancre, aligner = 'fin', children }: {
  ancre: RefObject<HTMLElement | null>
  /** `fin` : aligné sur le bord droit du déclencheur (il pousse vers la gauche) ; `debut` : sur le gauche. */
  aligner?: 'debut' | 'fin'
  children: ReactNode
}) {
  const boite = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = boite.current
    const a = ancre.current
    if (!el || !a) return
    const r = a.getBoundingClientRect()
    const p = el.getBoundingClientRect()
    const cadre = a.closest('[data-cadre]')?.getBoundingClientRect()
    const gauche = Math.max(MARGE, (cadre?.left ?? 0) + MARGE)
    const droite = Math.min(window.innerWidth, cadre?.right ?? window.innerWidth) - MARGE
    const bas = Math.min(window.innerHeight, cadre?.bottom ?? window.innerHeight) - MARGE
    let x = aligner === 'fin' ? r.right - p.width : r.left
    if (aligner === 'fin' && x < gauche) x = r.left
    if (aligner === 'debut' && x + p.width > droite) x = r.right - p.width
    x = Math.max(gauche, Math.min(x, droite - p.width))
    let y = r.bottom + 4
    if (y + p.height > bas) y = Math.max(MARGE, r.top - 4 - p.height)
    el.style.left = `${Math.round(x)}px`
    el.style.top = `${Math.round(y)}px`
    el.style.visibility = 'visible'
  })
  return createPortal(
    <div ref={boite} {...{ [ATTR_FLOTTANT]: '' }} style={{ position: 'fixed', left: 0, top: 0, zIndex: 150, visibility: 'hidden' }}>
      {children}
    </div>,
    document.body,
  )
}
