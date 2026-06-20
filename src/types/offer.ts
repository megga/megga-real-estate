// MEGGA CRM Sprint 2 — Types Offer (offre + contre-offre)
// Source de vérité : HANDOFF_SPRINT_2_CLAUDE_CODE.md §Modèle de données
// Migration DB : 20260517_001_sprint2_crm_offers_visits.sql

export type OfferKind = 'offer' | 'counter'
export type OfferParty = 'buyer' | 'seller'
export type OfferStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'withdrawn'

/** Une condition suspensive booléenne avec sous-champs optionnels. */
export interface OfferCondition {
  active: boolean
  days?: number | null
  note?: string | null
}

export interface OfferConditions {
  financing: OfferCondition
  sale: OfferCondition
  diagnostic: OfferCondition
  occupancy: OfferCondition
  /** Texte libre — visible dans le PDF offre. */
  other: string
}

export interface OfferAttachment {
  id: string
  name: string
  size: string
}

/** Offre ou contre-offre — un noeud de la chaîne de négociation. */
export interface Offer {
  id: string
  deal_id: string
  agency_id: string
  parent_offer_id: string | null

  kind: OfferKind
  from_party: OfferParty
  by_id: string | null
  by_label: string

  amount: number
  currency: 'CHF'

  conditions: OfferConditions
  deposit: number | null
  closing_date: string | null
  expires_at: string

  attachments: OfferAttachment[]
  notes: string | null
  status: OfferStatus

  created_at: string
  responded_at: string | null
}

/** Conditions vides par défaut — toggles désactivés. */
export const EMPTY_OFFER_CONDITIONS: OfferConditions = {
  financing: { active: false, days: null, note: null },
  sale: { active: false, note: null },
  diagnostic: { active: false, note: null },
  occupancy: { active: false, note: null },
  other: '',
}

/** Compte les conditions actives (4 toggles + 1 si other non vide). */
export function countActiveConditions(c: OfferConditions): number {
  return (
    (c.financing.active ? 1 : 0) +
    (c.sale.active ? 1 : 0) +
    (c.diagnostic.active ? 1 : 0) +
    (c.occupancy.active ? 1 : 0) +
    (c.other.trim() ? 1 : 0)
  )
}
