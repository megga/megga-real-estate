// Atelier Matching — données (contrat HANDOFF_MATCHING_COUTURES).
//
// Données : matches (+ contact + property/market_listing) groupés par annonce
// pivot (`p:<uuid>` interne / `m:<uuid>` veille marché) + KYC du dernier
// dossier acheteur par contact. Le mode « Par acheteur » réutilise les mêmes
// matches re-groupés par contact (poolFor).
//
// Les gestes que l'agent pose sur ces matchs ne sont pas ici : ils vivent dans
// `@/lib/matchingGestes`, que le fil de matchs partage — un seul écrivain par geste.

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { mapKycStatus } from '@/lib/crmAdapters'
import { isSnoozed, refAnnonceMarche, refBienInterne } from '@/lib/matchingGestes'
import type { SearchCriteria } from '@/types/contact'
import type { KycCase } from '@/types/kyc'
import { composeAiHint } from '@/components/matching-atelier/composeAiHint'
import { fmtBudgetRange } from '@/components/matching-atelier/format'
import type {
  AtelierBuyer,
  AtelierListing,
  AtelierPivot,
  AtelierPoolMatch,
  AtelierReason,
} from '@/components/matching-atelier/types'

// ─── Rows Supabase (snake_case, embeds) ─────────────────────────────────
interface RawContact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  type: string
  search_criteria: SearchCriteria | null
}

interface RawPropertyRow {
  id: string
  title: string | null
  description: string | null
  type: string | null
  transaction_type: string | null
  price: number | string | null
  rooms: number | string | null
  bedrooms: number | null
  bathrooms: number | null
  surface_m2: number | string | null
  address: string | null
  city: string | null
  canton: string | null
  postal_code: string | null
  lat: number | string | null
  lng: number | string | null
  photos: string[] | null
  features: unknown
  floor: number | null
  year_built: number | null
  charges_monthly: number | string | null
  created_at: string | null
}

interface RawMarketRow extends Omit<RawPropertyRow, 'features' | 'created_at'> {
  status: string | null
  source_id: string | null
  source_portal: string | null
  source_url: string | null
  current_price: number | string | null
  price_at_first_seen: number | string | null
  price_per_m2: number | string | null
  photos_count: number | null
  features: unknown
  is_furnished: boolean | null
  agency_name: string | null
  agency_phone: string | null
  quality_score: number | null
  days_on_market: number | null
  first_seen_at: string | null
  last_seen_at: string | null
}

interface RawMatch {
  id: string
  contact_id: string
  property_id: string | null
  market_listing_id: string | null
  score: number
  reasons: Record<string, { match: boolean; score: number; detail: string }> | null
  status: 'suggested' | 'sent' | 'visit_planned' | 'interested' | 'rejected' | 'ignored'
  source: 'internal' | 'market'
  sent_at: string | null
  snoozed_until?: string | null
  created_at: string
  contact: RawContact | null
  property: RawPropertyRow | null
  market_listing: RawMarketRow | null
}

// ─── Mappers bien → AtelierListing ──────────────────────────────────────
const TYPE_FR: Record<string, string> = {
  apartment: 'Appartement', house: 'Maison', villa: 'Villa', office: 'Bureau',
  commercial: 'Commercial', parking: 'Parking', storage: 'Dépôt', land: 'Terrain',
}
const FEATURE_FR: Record<string, string> = {
  ascenseur: 'Ascenseur', balcon: 'Balcon', terrasse: 'Terrasse', jardin: 'Jardin',
  parking: 'Parking', garage: 'Garage', cave: 'Cave', parquet: 'Parquet',
  cheminée: 'Cheminée', piscine: 'Piscine', climatisation: 'Climatisation',
  elevator: 'Ascenseur', balcony: 'Balcon', terrace: 'Terrasse', garden: 'Jardin',
  cellar: 'Cave', fireplace: 'Cheminée', pool: 'Piscine',
}

const num = (v: number | string | null | undefined): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : null
}

function featureList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((f): f is string => typeof f === 'string')
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => k)
  }
  return []
}

function gallery(photos: string[] | null): AtelierListing['gallery'] {
  return (photos ?? []).map((url, i) => ({
    url,
    room: 'Photos',
    label: `Photo ${String(i + 1).padStart(2, '0')}`,
  }))
}

/** Bien de veille marché (market_listings) → AtelierListing : clé `m:<id>`, prix courant + prix barré si baisse détectée. */
export function mapMarketListing(row: RawMarketRow): AtelierListing {
  const features = featureList(row.features).map(f => f.toLowerCase())
  const price = num(row.current_price) ?? num(row.price) ?? 0
  const was = num(row.price_at_first_seen)
  const photos = row.photos ?? []
  return {
    key: `m:${row.id}`,
    id: row.id,
    kind: 'market',
    ref: refAnnonceMarche(row.source_portal, row.source_id, row.id),
    title: row.title ?? 'Annonce',
    addr: [row.address, [row.postal_code, row.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    canton: row.canton ?? '',
    lat: num(row.lat),
    lng: num(row.lng),
    price,
    priceWas: was && was > price ? was : null,
    pricePerM2: num(row.price_per_m2),
    charges: num(row.charges_monthly),
    type: TYPE_FR[row.type ?? ''] ?? 'Bien',
    transaction: row.transaction_type === 'buy' ? 'Vente' : 'Location',
    rooms: num(row.rooms),
    area: num(row.surface_m2),
    beds: row.bedrooms,
    baths: row.bathrooms,
    year: row.year_built,
    floor: row.floor,
    lift: features.includes('ascenseur') || features.includes('elevator'),
    features: featureList(row.features).map(f => FEATURE_FR[f.toLowerCase()] ?? f),
    photos: row.photos_count ?? photos.length,
    gallery: gallery(photos),
    desc: row.description ?? '',
    quartier: row.city ?? '',
    daysOnMarket: row.days_on_market,
    qualityScore: row.quality_score,
    agency: { name: row.agency_name, phone: row.agency_phone },
    sourceUrl: row.source_url,
    firstSeenAt: row.first_seen_at,
    isFurnished: row.is_furnished ?? false,
  }
}

/** Bien interne (properties) → AtelierListing : clé `p:<id>`, jours-sur-marché dérivés de created_at. */
export function mapProperty(row: RawPropertyRow): AtelierListing {
  const features = featureList(row.features).map(f => f.toLowerCase())
  const photos = row.photos ?? []
  const days = row.created_at
    ? Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / 864e5))
    : null
  return {
    key: `p:${row.id}`,
    id: row.id,
    kind: 'property',
    ref: refBienInterne(row.id),
    title: row.title ?? 'Bien',
    addr: [row.address, [row.postal_code, row.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    canton: row.canton ?? '',
    lat: num(row.lat),
    lng: num(row.lng),
    price: num(row.price) ?? 0,
    priceWas: null,
    pricePerM2: num(row.price) && num(row.surface_m2) ? Math.round((num(row.price)! / num(row.surface_m2)!) * 100) / 100 : null,
    charges: num(row.charges_monthly),
    type: TYPE_FR[row.type ?? ''] ?? 'Bien',
    transaction: row.transaction_type === 'rent' ? 'Location' : 'Vente',
    rooms: num(row.rooms),
    area: num(row.surface_m2),
    beds: row.bedrooms,
    baths: row.bathrooms,
    year: row.year_built,
    floor: row.floor,
    lift: features.includes('ascenseur') || features.includes('elevator'),
    features: featureList(row.features).map(f => FEATURE_FR[f.toLowerCase()] ?? f),
    photos: photos.length,
    gallery: gallery(photos),
    desc: row.description ?? '',
    quartier: row.city ?? '',
    daysOnMarket: days,
    qualityScore: null,
    agency: { name: null, phone: null },
    sourceUrl: null,
    firstSeenAt: row.created_at,
    isFurnished: false,
  }
}

// ─── Reasons moteur (JSONB) → liste atelier ─────────────────────────────
const REASON_LABELS: Record<string, string> = {
  budget: 'Budget',
  zone: 'Quartier',
  type: 'Type',
  rooms: 'Pièces & surface',
  features: 'Critères',
}

function mapReasons(raw: RawMatch['reasons']): AtelierReason[] {
  if (!raw) return []
  return Object.entries(raw)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([k, v]) => ({
      label: REASON_LABELS[k] ?? k,
      detail: v.detail || (v.match ? 'Correspond' : 'Ne correspond pas'),
      pts: v.score ?? 0,
      ok: Boolean(v.match),
    }))
}

// ─── Statut DB → statut atelier + libellé d'engagement ──────────────────
function mapStatus(m: RawMatch): { status: AtelierBuyer['status']; engage: string } {
  switch (m.status) {
    case 'sent': return { status: 'no-reply', engage: 'Proposé · sans retour' }
    case 'interested': return { status: 'engaged', engage: 'Intéressé' }
    case 'visit_planned': return { status: 'engaged', engage: 'Visite planifiée' }
    default: return { status: 'to-send', engage: 'Nouveau match' }
  }
}

const CONTACT_TYPE_FR: Record<string, string> = {
  buyer: 'Acheteur', investor: 'Investisseur', tenant: 'Locataire',
  both: 'Acheteur-vendeur', lead: 'Lead', seller: 'Vendeur', landlord: 'Bailleur',
}

// Couleur avatar déterministe — palette dérivée des avatars du handoff
const AV_PALETTE = ['#5b6cff', '#8B5CF6', '#2370ff', '#1abcfe', '#e0795f', '#74d184', '#d8923f', '#679cff', '#c0566b', '#4cb0a0', '#9b7cf0', '#c98a3a']
function avatarColor(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return AV_PALETTE[Math.abs(h) % AV_PALETTE.length]
}

// ─── Hook données ────────────────────────────────────────────────────────
const MATCH_SELECT =
  '*, contact:contacts(id, first_name, last_name, email, phone, type, search_criteria), property:properties(*), market_listing:market_listings(*)'

export interface UseAtelierMatchingReturn {
  isLoading: boolean
  /** true si la query matches ou kyc a échoué — état d'erreur de l'atelier. */
  isError: boolean
  pivots: AtelierPivot[]
  pivotByKey: Map<string, AtelierPivot>
  defaultPivotKey: string | null
  /** Tous les biens matchés d'un acheteur (mode « Par acheteur »), score desc */
  poolFor: (contactId: string, currentKey: string | null) => AtelierPoolMatch[]
  /** Profil acheteur (meilleur match) — deep-link ?contact= */
  buyerFor: (contactId: string) => AtelierBuyer | null
  refresh: () => void
}

/**
 * Données de l'Atelier Matching : matches (annonce pivot ↔ acheteurs) enrichis KYC,
 * groupés par annonce (pivots) et re-groupables par acheteur (poolFor / buyerFor).
 * Les couples écartés/rejetés sont exclus de la file.
 */
export function useAtelierMatching(): UseAtelierMatchingReturn {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  const { data: rawMatches = [], isLoading: matchesLoading, isError: matchesError } = useQuery({
    queryKey: ['atelier-matches', agencyId],
    queryFn: async (): Promise<RawMatch[]> => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('matches')
        .select(MATCH_SELECT)
        .eq('agency_id', agencyId)
        .order('score', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as RawMatch[]
    },
    enabled: !!agencyId,
  })

  const buyerIds = useMemo(
    () => Array.from(new Set(rawMatches.map(m => m.contact_id))),
    [rawMatches],
  )

  const { data: kycCases = [], isError: kycError } = useQuery({
    queryKey: ['atelier-kyc', agencyId, buyerIds],
    queryFn: async (): Promise<KycCase[]> => {
      if (!agencyId || buyerIds.length === 0) return []
      const { data, error } = await supabase
        .from('kyc_cases')
        .select('id, contact_id, type, status, dossier_status, risk_level, expires_at, created_at')
        .in('contact_id', buyerIds)
        .in('type', ['buyer_pp', 'buyer_pm'])
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as KycCase[]
    },
    enabled: !!agencyId && buyerIds.length > 0,
  })

  const kycByContact = useMemo(() => {
    const map = new Map<string, KycCase>()
    for (const k of kycCases) if (!map.has(k.contact_id)) map.set(k.contact_id, k)
    return map
  }, [kycCases])

  // Un match (annonce ↔ acheteur) → AtelierBuyer pour la file
  const toBuyer = useCallback((m: RawMatch): AtelierBuyer | null => {
    const c = m.contact
    if (!c) return null
    const { status, engage } = mapStatus(m)
    const kyc = mapKycStatus(kycByContact.get(c.id)?.dossier_status)
    const reasons = mapReasons(m.reasons)
    const crit = c.search_criteria
    return {
      id: c.id,
      matchId: m.id,
      first: c.first_name,
      last: c.last_name,
      av: avatarColor(c.id),
      type: CONTACT_TYPE_FR[c.type] ?? 'Acheteur',
      budget: fmtBudgetRange(crit?.budget_min, crit?.budget_max),
      zone: crit?.zones?.length ? crit.zones.slice(0, 2).join(' / ') : '—',
      kyc,
      status,
      engage,
      score: m.score,
      ai: composeAiHint({ status, kyc, score: m.score, reasons, sentAt: m.sent_at, engage }),
      reasons,
      email: c.email,
      phone: c.phone,
      snoozedUntil: m.snoozed_until ?? null,
      criteria: crit,
      source: m.source,
      sentAt: m.sent_at,
    }
  }, [kycByContact])

  const listingOf = useCallback((m: RawMatch): AtelierListing | null => {
    if (m.property_id && m.property) return mapProperty(m.property)
    if (m.market_listing_id && m.market_listing) return mapMarketListing(m.market_listing)
    return null
  }, [])

  // Groupes par annonce pivot — écartés/rejetés exclus de la file
  const { pivots, pivotByKey } = useMemo(() => {
    const groups = new Map<string, AtelierPivot>()
    for (const m of rawMatches) {
      if (m.status === 'ignored' || m.status === 'rejected') continue
      // Annonce retirée du marché → bien disparu, on ne le propose pas à l'agent.
      // Défense intra-journée : la purge nocturne (purge_stale_market_matches)
      // supprime ces matchs à la source, ce filtre couvre la fenêtre entre deux
      // passes (une annonce marquée 'removed' au sync du matin).
      if (m.market_listing && m.market_listing.status === 'removed') continue
      const L = listingOf(m)
      const b = toBuyer(m)
      if (!L || !b) continue
      const entry = groups.get(L.key) ?? { listing: L, buyers: [], actionable: 0 }
      entry.buyers.push(b)
      if (m.status === 'suggested' && !isSnoozed(b.snoozedUntil)) entry.actionable++
      groups.set(L.key, entry)
    }
    const list = Array.from(groups.values())
      .map(g => ({ ...g, buyers: g.buyers.sort((a, z) => z.score - a.score) }))
      .sort((a, z) => z.actionable - a.actionable || z.buyers.length - a.buyers.length)
    return { pivots: list, pivotByKey: new Map(list.map(g => [g.listing.key, g])) }
  }, [rawMatches, listingOf, toBuyer])

  const poolFor = useCallback((contactId: string, currentKey: string | null): AtelierPoolMatch[] => {
    return rawMatches
      .filter(m => m.contact_id === contactId && m.status !== 'ignored' && m.status !== 'rejected')
      .map((m): AtelierPoolMatch | null => {
        const L = listingOf(m)
        if (!L) return null
        return {
          matchId: m.id,
          lid: L.key,
          L,
          score: m.score,
          reasons: mapReasons(m.reasons),
          current: currentKey != null && L.key === currentKey,
          snoozedUntil: m.snoozed_until ?? null,
          status: mapStatus(m).status,
        }
      })
      .filter((x): x is AtelierPoolMatch => x !== null)
      .sort((a, z) => z.score - a.score)
  }, [rawMatches, listingOf])

  const buyerFor = useCallback((contactId: string): AtelierBuyer | null => {
    const best = rawMatches.find(m => m.contact_id === contactId && m.status !== 'ignored' && m.status !== 'rejected')
    return best ? toBuyer(best) : null
  }, [rawMatches, toBuyer])

  const queryClient = useQueryClient()
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['atelier-matches'] })
    void queryClient.invalidateQueries({ queryKey: ['atelier-kyc'] })
    void queryClient.invalidateQueries({ queryKey: ['matches'] })
  }, [queryClient])

  return {
    // Idem useContactsScreen : le KYC n'alimente qu'un badge, il ne doit pas
    // remettre tout l'atelier en écran de chargement quand il se rafraîchit.
    isLoading: matchesLoading,
    isError: matchesError || kycError,
    pivots,
    pivotByKey,
    defaultPivotKey: pivots[0]?.listing.key ?? null,
    poolFor,
    buyerFor,
    refresh,
  }
}
