// Helpers partagés biens (liste) + fiche mobile — tons de statut, mapping de type
// vers les clés i18n, libellés. Tons fonctionnels (pastilles data-only), jamais
// l'accent UI.

import type { CrmBien } from '@/components/crm-sugar/mockData'

// Union couvrant les DEUX sources : CrmBien (galerie démo, a 'paused') ET
// Property/PropertyStatus (fiche live, a 'archived'). Évite le trou du cast
// `as BienStatus` qui masquait un statut 'archived' réel → pastille sans fond.
export type BienStatus = CrmBien['status'] | 'archived'
export type BienType = CrmBien['type']

/** Tons de statut (fond plein de pastille, texte blanc — lisibles sur photo). */
export const STATUS_TONE: Record<BienStatus, string> = {
  active: '#0E9F6E',
  reserved: '#D97706',
  draft: '#6B7280',
  paused: '#6B7280',
  sold: '#111827',
  archived: '#6B7280',
}
/** Couleur de pastille de statut, avec repli sûr si statut inconnu. */
export const statusTone = (s: string): string => STATUS_TONE[s as BienStatus] ?? '#6B7280'

/** CrmBien.type (FR) → clé i18n `listings:type.*` (EN). */
const TYPE_KEY: Record<BienType, string> = {
  appartement: 'apartment',
  maison: 'house',
  villa: 'villa',
  commercial: 'commercial',
  office: 'office',
  parking: 'parking',
  storage: 'storage',
  land: 'land',
}
export const typeKey = (t: BienType): string => `type.${TYPE_KEY[t] ?? 'apartment'}`
