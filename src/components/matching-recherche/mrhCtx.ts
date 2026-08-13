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

/**
 * Teinte de la BAISSE DE PRIX — pastille « −4 % » de la carte et de la fiche.
 *
 * ⚠ C'est une couleur FONCTIONNELLE, pas une décoration : elle dit « le prix a
 * baissé », une information que les neutres ne savent pas porter. Elle n'a donc
 * pas été reciblée sur l'échelle — elle a été ASSOMBRIE dans sa propre famille
 * jusqu'à passer l'AA. `#C45A00` rendait 4,37:1 sur la carte blanche et 4,15:1
 * sur la sous-carte, dans les deux rôles qu'elle tient (encre, et aplat sous une
 * encre blanche — le contraste est symétrique).
 *
 * ⚠ La valeur n'est pas inventée : `#B45309` est le `--color-warning-dark` que
 * `globals.css` déclare déjà, et le `warnFg` du rapport KYC. Même geste que
 * `tk.goal` sur « Mes biens », monté de `#059669` à un vert que le dépôt
 * employait ailleurs. 5,02:1 sur la carte, 4,77:1 sur la sous-carte.
 *
 * ⛔ UN SEUL EXEMPLAIRE. Elle vivait en quatre — trois littéraux ici et
 * `--sys-yellow` dans `atelier.css`. Sur cette surface, une valeur dupliquée a
 * toujours fini par diverger.
 */
export const MRH_PRICE_DROP = '#B45309'

/**
 * Encre de la baisse de prix posée SUR une surface — et elle suit le THÈME.
 *
 * ⛔ POURQUOI DEUX VALEURS LÀ OÙ L'APLAT N'EN DEMANDE QU'UNE. Un aplat porte son
 * propre fond : l'encre blanche par-dessus rend 5,02:1 quel que soit le thème de
 * la page. Une encre POSÉE, elle, se mesure contre la surface — et aucune valeur
 * ne sert les deux : `#B45309` rend 5,02:1 sur la carte blanche mais 3,97:1 sur
 * la carte sombre, tandis que `#E89B5A` rend 8,79:1 en sombre et 2,27:1 en clair.
 *
 * ⚠ Assombrir la teinte pour la faire passer en clair l'a fait TOMBER en sombre :
 * un correctif qui déplace le défaut d'un thème à l'autre. C'est la garde étendue
 * aux surfaces sombres qui l'a dit, pas l'œil.
 *
 * `#E89B5A` n'est pas choisi non plus : c'est déjà le pendant sombre de
 * `--sys-yellow` dans `atelier.css` (`.sga[data-theme="dark"] .tone-yellow`). La
 * feuille connaissait la réponse ; les composants la lisent maintenant aussi.
 */
export const mrhPriceDropInk = (dark: boolean): string => (dark ? '#E89B5A' : MRH_PRICE_DROP)
