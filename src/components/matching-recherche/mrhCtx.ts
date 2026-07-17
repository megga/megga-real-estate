// Matching · Recherche — contexte partagé passé aux composants de grille/carte
// (palette, surfaces, sélection, handlers). Évite le prop-drilling ; identité de
// type stable pour ne pas remonter la grille à chaque rendu.

import type { SugarPalette } from '@/components/crm-sugar/tokens'
import type { MrhBien, MrhContact } from './types'

export interface MrhSurf {
  card: string
  cardSub: string
  hairline: string
  shadow: string
  shadowHov: string
}

export interface MrhScore {
  score: number
  /** clés de raison (recherche.reason.*) */
  reasons: string[]
}

export interface MrhCtx {
  sp: SugarPalette
  surf: MrhSurf
  dark: boolean
  /** noir Sugar (inversé en sombre) */
  ACC: string
  ONACC: string
  line: string
  chipBg: string
  /** surface opaque pour les popovers (jamais translucide) */
  cardSolid: string
  sel: string[]
  buyer: MrhContact | null
  toggleSel: (id: string) => void
  /** ouvrir le bien (fiche détail marché) */
  onOpen: (b: MrhBien) => void
  /** MEGGA AI — expliquer un match / analyser une annonce */
  onAskAi: (b: MrhBien, score: number | null) => void
  /** anime l'entrée des cartes (uniquement au 1er affichage) */
  animate: boolean
}
