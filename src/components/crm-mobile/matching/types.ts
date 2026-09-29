/**
 * Matching au téléphone — le contrat de données de l'écran mobile (`MobileMatchingScreen`) : les formes que produit sa
 * lecture, `useAtelierMatching` (matches + contacts + kyc_cases + properties/market_listings, handoff §9 adapté
 * Supabase), et les gestes que l'écran câble (`AtelierGestes`). Elles portent le nom de l'atelier de bureau, qui les
 * partageait jusqu'à son retrait (lot E1) ; elles partent avec l'écran mobile au lot E2.
 */

import type { SearchCriteria } from '@/types/contact'
import type { PendingHandle } from '@/lib/matchingAnnulation'

export type AtelierTab = 'all' | 'to-send' | 'engaged' | 'no-reply'
export type AtelierKyc = 'verified' | 'pending' | 'stale' | 'none'
export type AtelierStatus = 'to-send' | 'engaged' | 'no-reply'

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

// Bien matché pour un acheteur pivot (vue focus du mobile)
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

/**
 * Les gestes que l'écran mobile câble sur un match. Les cinq premiers diffèrent leur écriture dans la file
 * d'annulation (`PendingRegistry`) et appellent l'exécuteur de `matchingGestes` ; `wake` écrit tout de suite, et
 * `visit` ouvre le flux visite.
 */
export interface AtelierGestes {
  /** « Je l'ai proposé » : l'agent a présenté le bien lui-même, le CRM consigne. Sans effet sur un
   *  match qui n'est plus à proposer (`ResultatProposition.deja`) */
  send: (matchId: string) => PendingHandle
  /** « J'ai relancé » : la relance interne est repoussée, rien n'est envoyé */
  relance: (matchId: string) => PendingHandle
  snooze: (matchId: string) => PendingHandle
  dismiss: (matchId: string) => PendingHandle
  /** réponse de l'acheteur, consignée par l'agent (Intéressé / Pas intéressé) → matches.status
   *  interested/rejected, produit response_at via trigger. Même fenêtre d'annulation 5 s. */
  react: (matchId: string, reaction: 'interested' | 'rejected') => PendingHandle
  /** réactivation d'un reporté — immédiate, pas de fenêtre d'annulation */
  wake: (matchId: string) => void
  /** « Proposer une visite » — bascule vers le flux visite (picker réel) */
  visit: (matchId: string) => void
}
