// Atelier Matching — hôte de portail pour les overlays (handoff : AtlOverlayLayer).
//
// POURQUOI : embarqué dans le pager (`.atl-stage.atl-embedded`), l'étage porte
// `contain:layout paint` et un ancêtre translaté (la piste du pager). Les deux
// font d'un `position:fixed` interne un cadre LOCAL : confirmation, feuille
// d'envoi et galerie se retrouvaient rognées au bento au lieu de couvrir la
// fenêtre. Règle projet (CLAUDE.md) : les modales passent par
// createPortal(document.body).
//
// Les tokens vivent sur `.atl[data-theme]` : le portail sortant de l'arbre de
// l'étage, il faut rejouer ce scope sur le nœud d'accueil, sinon les variables
// CSS ne résolvent plus et l'overlay perd son thème.

import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

interface AtlOverlayHostProps {
  dark: boolean
  children: ReactNode
}

/** Monte ses enfants dans document.body, sous un scope `.atl` thémé. */
export default function AtlOverlayHost({ dark, children }: AtlOverlayHostProps) {
  return createPortal(
    <div className="atl atl-portal" data-theme={dark ? 'dark' : 'light'} data-density="confort">
      {children}
    </div>,
    document.body,
  )
}
