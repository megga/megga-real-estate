/**
 * Un écran de la coquille du CRM — il se comprime lui-même quand le dock MEGGA AI
 * s'ouvre, TANT QU'AUCUN plan de travail ne s'y est inscrit pour le faire.
 *
 * Le pourquoi (la plaque derrière le dock, le repli par écran, l'inscription par
 * effet plutôt que par `:has()`) est dans `usePousseeDock` ; ce fichier n'est que
 * la mécanique, et il vit ici parce qu'il PEINT — une règle de feuille et un
 * conteneur —, ce qu'un module de `hooks/` ne fait pas.
 */
import { useCallback, useLayoutEffect, useRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { DOCK_MOTION, DOCK_PUSH_VAR } from '@/components/ai-copilot/panel/aiPanel'
import { PousseeDockContext, type InscrirePoussee } from '@/hooks/usePousseeDock'

/**
 * Posé par l'inscription, retiré avec elle. ⚠ Un ATTRIBUT et non un style : React
 * ne le rend pas, donc aucun rendu de l'écran ne peut l'écraser.
 */
const ATTR_PORTE = 'data-porte-sa-poussee'

const REGLE = `
[data-ecran-pousse] { transition: padding-right ${DOCK_MOTION}; }
[data-ecran-pousse]:not([${ATTR_PORTE}]) { padding-right: var(${DOCK_PUSH_VAR}); }
`

/**
 * Change le porteur SANS transition : la bascule est appliquée avec la
 * transition coupée, la mise en page est forcée pour qu'elle soit acquise, puis
 * la transition revient — sur une valeur qui ne bouge plus.
 */
function basculer(el: HTMLDivElement, porte: boolean): void {
  el.style.transition = 'none'
  el.toggleAttribute(ATTR_PORTE, porte)
  void el.offsetWidth
  el.style.removeProperty('transition')
}

/** Un écran : il porte le repli de la poussée, et le cède au plan de travail qui s'inscrit. */
export function EcranPousse({ children, ...attrs }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  // Un compteur et non un booléen : l'ordre des effets entre un plan qui part et
  // un plan qui arrive dans le même rendu n'est pas garanti.
  const inscrits = useRef(0)
  /** Aligne l'attribut sur le compte — seulement s'il change, et sans transition. */
  const aligner = useCallback(() => {
    const el = ref.current
    if (!el) return
    const porte = inscrits.current > 0
    if (el.hasAttribute(ATTR_PORTE) !== porte) basculer(el, porte)
  }, [])
  const inscrire = useCallback<InscrirePoussee>(() => {
    inscrits.current += 1
    aligner()
    return () => {
      inscrits.current -= 1
      aligner()
    }
  }, [aligner])
  // ⛔ LE RATTRAPAGE SANS LEQUEL LA PAGE SERAIT POUSSÉE DEUX FOIS. Un plan de
  // travail monté dans le MÊME rendu que son écran — page déjà chargée, second
  // onglet sur un écran déjà visité — s'inscrit AVANT que la ref de l'écran soit
  // posée : React termine les enfants d'abord, et son `aligner()` ne trouve rien.
  // Cet effet-ci passe après les enfants ET après la ref, avant la peinture.
  useLayoutEffect(aligner, [aligner])
  return (
    <PousseeDockContext.Provider value={inscrire}>
      <style>{REGLE}</style>
      <div ref={ref} data-ecran-pousse="" {...attrs}>{children}</div>
    </PousseeDockContext.Provider>
  )
}

