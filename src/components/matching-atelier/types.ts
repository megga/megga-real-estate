// Atelier Matching — contrat de données (handoff §9, adapté Supabase).
// Le triptyque consomme ces shapes ; useAtelierMatching les produit à partir
// de matches + contacts + kyc_cases + properties/market_listings.

import type { SearchCriteria } from '@/types/contact'

export type AtelierTab = 'all' | 'to-send' | 'engaged' | 'no-reply'
export type AtelierKyc = 'verified' | 'pending' | 'stale' | 'none'
export type AtelierStatus = 'to-send' | 'engaged' | 'no-reply'
export type TriageKind = 'sent' | 'skipped' | 'later' | 'relance' | 'interested' | 'rejected'

export interface AtelierReason {
  label: string
  detail: string
  pts: number
  ok: boolean
}

export interface AtelierGalleryPhoto {
  url: string
  room: string
  label: string
}

// Annonce pivot — bien interne (properties) OU annonce marché (market_listings)
export interface AtelierListing {
  /** `p:<uuid>` (properties) ou `m:<uuid>` (market_listings) */
  key: string
  id: string
  kind: 'property' | 'market'
  ref: string
  title: string
  addr: string
  canton: string
  lat: number | null
  lng: number | null
  price: number
  priceWas: number | null
  pricePerM2: number | null
  charges: number | null
  type: string
  transaction: 'Vente' | 'Location'
  rooms: number | null
  area: number | null
  beds: number | null
  baths: number | null
  year: number | null
  floor: number | null
  lift: boolean
  features: string[]
  photos: number
  gallery: AtelierGalleryPhoto[]
  desc: string
  quartier: string
  daysOnMarket: number | null
  qualityScore: number | null
  agency: { name: string | null; phone: string | null }
  sourceUrl: string | null
  firstSeenAt: string | null
  isFurnished: boolean
}

// Acheteur scoré contre l'annonce pivot (1 row = 1 match)
export interface AtelierBuyer {
  /** contact id */
  id: string
  matchId: string
  first: string
  last: string
  av: string
  type: string
  budget: string
  zone: string
  kyc: AtelierKyc
  status: AtelierStatus
  engage: string
  score: number
  ai: string
  reasons: AtelierReason[]
  email: string | null
  phone: string | null
  snoozedUntil: string | null
  criteria: SearchCriteria | null
  /** source du match — visite proposable uniquement sur bien interne */
  source: 'internal' | 'market'
  sentAt: string | null
}

// Bien matché pour un acheteur pivot (mode « Par acheteur »)
export interface AtelierPoolMatch {
  matchId: string
  lid: string
  L: AtelierListing
  score: number
  reasons: AtelierReason[]
  current: boolean
  snoozedUntil: string | null
  /** statut d'engagement (mobile : « Envoyé » déjà transmis vs « Envoyer ») */
  status: AtelierStatus
}

// Pivot affichable dans la file (groupe annonce → acheteurs)
export interface AtelierPivot {
  listing: AtelierListing
  buyers: AtelierBuyer[]
  actionable: number
}
