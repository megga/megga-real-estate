/**
 * Aiguillage responsive au niveau d'un élément de route (crm-mobile/shell) :
 * enrobe une paire desktop/mobile et monte l'un ou l'autre selon la largeur du viewport.
 */
import type { ReactElement } from 'react'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface ResponsiveRouteProps {
  desktop: ReactElement
  mobile: ReactElement
}

/**
 * Choisit l'arbre desktop ou mobile au niveau d'un élément de route, sans
 * toucher au layout parent ni au fichier desktop. Seuil unique 768px
 * (`useIsMobile`), initialisé correctement au premier paint (pas de flash).
 * Tant qu'un écran mobile n'est pas livré, passer `mobile={desktop}` (no-op).
 */
export default function ResponsiveRoute({ desktop, mobile }: ResponsiveRouteProps) {
  return useIsMobile() ? mobile : desktop
}
