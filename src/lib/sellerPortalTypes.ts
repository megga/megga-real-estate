/**
 * Modèle de vue du portail vendeur : ce qu'un vendeur voit de sa vente (bien,
 * visites, offres, KPIs, agent).
 *
 * Alimenté par `useSellerPortal`, qui lit Supabase à partir du jeton de la route
 * `/portal/:token`. Le jeu de données de démonstration qui vivait ici — et la
 * route `/portal` sans jeton qui le rendait — ont été retirés en juillet 2026 :
 * ils étaient servis publiquement en production.
 */

export interface SellerProperty {
  id: string
  title: string
  address: string
  city: string
  canton: string
  postal_code: string
  price: number
  rooms: number
  surface_m2: number
  type: string
  photo: string
  photos?: string[]
  status: 'active' | 'reserved' | 'sold'
  mandate_type: 'exclusive' | 'simple'
  mandate_signed_at: string
  published_at: string
}

export interface SellerVisit {
  id: string
  date: string
  status: 'planned' | 'confirmed' | 'done' | 'cancelled' | 'no_show'
  feedback: string | null
  rating: number | null // 1-5
}

export interface SellerOffer {
  id: string
  amount: number
  status: 'pending' | 'accepted' | 'rejected' | 'counter_offer' | 'expired'
  received_at: string
  conditions: string | null
}

export interface SellerActivity {
  id: string
  type: 'visit_planned' | 'visit_done' | 'offer_received' | 'document_added' | 'price_update' | 'publication' | 'mandate_signed' | 'message'
  description: string
  date: string
}

export type MandateStep =
  | 'mandate_signed'
  | 'published'
  | 'visits'
  | 'offers'
  | 'negotiation'
  | 'notary'
  | 'sold'

export interface SellerKPIs {
  visits_total: number
  visits_this_month: number
  offers_total: number
  online_views: number
  days_on_market: number
  current_step: MandateStep
}

export interface SellerPortalData {
  property: SellerProperty
  kpis: SellerKPIs
  visits: SellerVisit[]
  offers: SellerOffer[]
  activities: SellerActivity[]
  agent: {
    name: string
    phone: string
    email: string
    photo: string | null
  }
  estimation?: {
    min: number | null
    max: number | null
    median: number | null
    confidence: string | null
    comparable_count: number | null
  }
}
