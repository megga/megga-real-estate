/**
 * Affichage du fil de matchs sans React : les teintes qui ENCODENT (le palier d'un score, un critère
 * tenu, un écart), l'encre d'une action en texte, et l'écriture d'un prix.
 *
 * ⚠ Jamais d'aplat teinté sous du texte : la couleur est portée par une pastille ou une icône, le
 * chiffre et les libellés restent à l'encre. Les couleurs de système de la vitrine sont PÂLES,
 * réglées pour le noir ; en clair l'encre passe par `STATUT_CLAIR` (CLAUDE.md §3, point 4 de
 * « Sombre — échelle MEGGA X »).
 */
import type { TFunction } from 'i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { STATUT_CLAIR } from '@/components/megga-x-crm/statut'
import { formatCHF } from '@/lib/utils'
import type { FilBien, PalierScore } from './filModele'

/** Pastille du palier : vert, bleu de marque, ou la sourdine. */
export function teinteScore(palier: PalierScore, sp: CrmPalette): string {
  if (palier === 'fort') return sp.isDark ? MXC_SYSTEM.green400 : STATUT_CLAIR.okInk
  if (palier === 'bon') return sp.isDark ? MXC_SYSTEM.blue300 : sp.accent
  return sp.sub
}

/** Un critère tenu, un KYC vérifié. */
export const teinteTenu = (sp: CrmPalette): string => (sp.isDark ? MXC_SYSTEM.green400 : STATUT_CLAIR.okInk)

/** Un écart signalé par le moteur. */
export const teinteEcart = (sp: CrmPalette): string => (sp.isDark ? MXC_SYSTEM.yellow400 : STATUT_CLAIR.warnInk)

/**
 * Encre d'une action en TEXTE, et filet d'un élément ACTIF : sur sombre, l'accent ne passe ni l'AA en
 * texte ni le seuil de 3:1 d'un filet (3,07:1 sur une carte).
 */
export const encreAccent = (sp: CrmPalette): string => (sp.isDark ? MXC_SYSTEM.blue300 : sp.accent)

/** « CHF 1'450'000 », ou « CHF 2'950 / mois » pour une location. */
export function prixBien(bien: FilBien, t: TFunction): string {
  if (bien.prix == null) return t('fil.valeurs.inconnu')
  return bien.location ? t('fil.valeurs.parMois', { valeur: formatCHF(bien.prix) }) : formatCHF(bien.prix)
}

/**
 * Marge droite des panneaux du fil : les points de page du pager (`MatchingPage`) flottent au bord
 * droit, et recouvraient le grand score et le bouton principal.
 */
export const MARGE_POINTS = 'calc(var(--crm-space-7xl) + var(--crm-space-lg))'
