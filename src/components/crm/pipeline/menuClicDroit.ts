/**
 * Ce que partagent les menus du clic droit du Pipeline — leurs entrées, et la règle qui rend au
 * navigateur SON menu. Module sans composant : voir `react-refresh/only-export-components`.
 */
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { MEIconName } from '@/components/propertyx/MEIcon'

export type EntreeMenu =
  | {
    genre: 'action'
    cle: string
    libelle: string
    icone?: MEIconName
    /** Une pastille de couleur à la place de l'icône (la teinte d'une phase). */
    pastille?: string
    /** La couleur de l'icône, quand elle porte un sens (le vert de « Marquer conclu »). */
    teinte?: string
    danger?: boolean
    /** L'état en cours : coché, et pas choisissable. */
    coche?: boolean
    onChoisir: () => void
  }
  | { genre: 'sous-menu'; cle: string; libelle: string; icone?: MEIconName; entrees: EntreeMenu[] }
  | { genre: 'separateur'; cle: string }

export interface MenuOuvert {
  x: number
  y: number
  /** Le nom du menu pour les lecteurs d'écran : le client de l'affaire, la phase. */
  libelle: string
  entrees: EntreeMenu[]
}

/**
 * Le clic droit que le NAVIGATEUR doit garder : ⇧, un champ, un lien, ou du texte sélectionné.
 * Un menu maison qui confisque « Copier » ou « Ouvrir le lien » se fait haïr.
 */
export function menuNatifVoulu(e: ReactMouseEvent): boolean {
  if (e.shiftKey) return true
  const cible = e.target instanceof Element ? e.target : null
  if (cible?.closest('input, textarea, select, [contenteditable="true"], a[href]')) return true
  const selection = window.getSelection()
  return !!selection && !selection.isCollapsed && selection.toString().trim().length > 0
}
