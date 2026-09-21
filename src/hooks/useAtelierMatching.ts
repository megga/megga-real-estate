// Atelier Matching — données + gestes métier (contrat HANDOFF_MATCHING_COUTURES).
//
// Données : matches (+ contact + property/market_listing) groupés par annonce
// pivot (`p:<uuid>` interne / `m:<uuid>` veille marché) + KYC du dernier
// dossier acheteur par contact. Le mode « Par acheteur » réutilise les mêmes
// matches re-groupés par contact (poolFor).
//
// Gestes (exécutés par la page APRÈS la fenêtre d'annulation de 5 s — undo
// Gmail-style : rien n'est écrit tant que le toast offre « Annuler ») :
//   proposer     → « Je l'ai proposé » : le match, s'il est encore 'suggested' → 'sent',
//                  sent_via='agent' + Deal new_lead (créé ou rattaché) + activity_events
//                  'match_propose' + relance interne +3 j + jalon Intercom first_match_sent.
//                  Plus rien à proposer → rien d'autre n'est écrit (`deja`)
//   proposerSelection → ses matchs encore 'suggested' → 'sent' 'agent' + UN deal,
//                  UN 'match_propose', UNE relance +3 j, sur les SEULS matchs marqués (fil)
//   relance      → « J'ai relancé » : matches.sent_at=now + activity_events 'relance' +
//                  relance de proposition repoussée +3 j
//   react        → Intéressé / Pas intéressé : matches.status + relance de proposition close
//   snooze       → matches.snoozed_until=+7 j + reminder 'custom' à échéance
//                  (la ligne « de retour » remonte dans Aujourd'hui) + 'match_reporte'
//   dismiss      → matches.status='ignored' (le moteur ne re-propose jamais
//                  un couple existant — aucun deal) + activity_events 'match_ecarte'
//   wake         → snoozed_until=null + reminder annulé (immédiat, hors queue)
//
// ⛔ Aucun geste n'écrit à l'acheteur — ni e-mail, ni lien, ni WhatsApp (décision de
// Julien, 21.09.2026 : le matching reste chez l'agent). L'agent présente les biens par
// ses propres moyens ; le CRM consigne et lui rappelle de noter la réponse.

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { INTERCOM_EVENTS } from '@/lib/intercom'
import { markIntercomMilestone } from '@/lib/intercom-milestones'
import { useAuth } from '@/hooks/useAuth'
import { mapKycStatus } from '@/lib/crmAdapters'
import type { Json, TablesInsert } from '@/types/database'
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

/** Référence affichée d'une annonce du marché — la même dans l'atelier et dans le fil de matchs. */
export const refAnnonceMarche = (portail: string | null, sourceId: string | null, id: string): string =>
  `MG-${portail === 'flatfox' ? 'FL' : 'MK'}-${sourceId ?? id.slice(0, 6)}`

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

/** Référence affichée d'un bien interne — la même dans l'atelier et dans le fil de matchs. */
export const refBienInterne = (id: string): string => `MG-IN-${id.slice(0, 6).toUpperCase()}`

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

/** true tant que le report (snooze) d'un match n'est pas échu. */
export const isSnoozed = (until: string | null): boolean =>
  until != null && new Date(until).getTime() > Date.now()

// ═══════════════════ Gestes métier (exécuteurs) ═══════════════════════════
// Appelés par la page APRÈS la fenêtre d'annulation (5 s) — cf. en-tête.

export interface GesteContext {
  agencyId: string
  userId: string
}

/**
 * Ce qu'une proposition rend à son appelant et, par lui, au registre d'annulation (`pendingTriage`) :
 * le deal, pour « Voir le deal → », et `deja`.
 *
 * `deja` : aucun des matchs n'était encore à proposer à cet acheteur — déjà proposé, répondu ou
 * écarté entre-temps (un collègue, un autre onglet, un double geste), ou d'un autre acheteur. RIEN
 * d'autre n'est alors écrit : ni deal, ni journal, ni relance. C'est un RÉSULTAT et non une erreur :
 * l'état voulu est déjà là, ou a été tranché autrement. Un rejet passerait par `onError`, qui dit
 * « échec » à l'agent et remonte l'atelier ; l'appelant rafraîchit, et la file se remet d'accord.
 */
export interface ResultatProposition {
  dealId: string | null
  deja: boolean
}

/**
 * Ce qu'un geste lit d'un acheteur et d'un bien, et rien de plus : le journal et la relance nomment
 * l'acheteur, le bien par sa référence et son titre ; le deal se rattache par le genre et l'id du
 * bien. Le fil de matchs et « Aujourd'hui » n'ont pas la forme complète de l'atelier : les
 * exécuteurs restent la source UNIQUE des écritures, et ne leur demandent que ce qu'ils lisent.
 */
export type AcheteurGeste = Pick<AtelierBuyer, 'id' | 'matchId' | 'first' | 'last' | 'score'>
export type BienGeste = Pick<AtelierListing, 'kind' | 'id' | 'ref' | 'title'>

/**
 * Le deal d'un acheteur à qui l'on propose un bien : l'actif le plus récent s'il existe — un bien en
 * mandat y est rattaché s'il n'en porte aucun, jamais écrasé —, sinon un `new_lead` créé sur ce bien.
 * Partagé par la proposition d'un bien et celle d'une sélection, pour qu'elles ne divergent pas.
 */
async function rattacherDeal(ctx: GesteContext, contactId: string, listing: Pick<BienGeste, 'kind' | 'id'>): Promise<string> {
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, property_id')
    .eq('agency_id', ctx.agencyId)
    .eq('contact_buyer_id', contactId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  if (existing && existing.length > 0) {
    const deal = existing[0] as { id: string; property_id: string | null }
    if (listing.kind === 'property' && !deal.property_id) {
      await supabase.from('transactions').update({ property_id: listing.id }).eq('id', deal.id)
    }
    return deal.id
  }
  const insert: TablesInsert<'transactions'> = {
    agency_id: ctx.agencyId,
    contact_buyer_id: contactId,
    assigned_to: ctx.userId,
    stage: 'new_lead',
    status: 'active',
  }
  if (listing.kind === 'property') insert.property_id = listing.id
  else insert.market_listing_id = listing.id
  const { data: created, error } = await supabase.from('transactions').insert(insert).select('id').single()
  if (error) throw error
  return (created as { id: string }).id
}

/**
 * « Je l'ai proposé » (E) — l'agent a présenté le bien à l'acheteur, par ses propres moyens.
 *
 * ⛔ LE CRM N'ENVOIE RIEN À L'ACHETEUR (décision de Julien, 21.09.2026 : le matching reste chez
 * l'agent). Le geste consigne : le match passe `sent` avec `sent_via = 'agent'`, le deal est
 * rattaché (ou créé en `new_lead`), une ligne `match_propose` au journal, et UNE relance interne
 * à +3 jours (canal `task`) pour que l'agent consigne la réponse.
 *
 * Le marquage ne touche le match que s'il est ENCORE `suggested` et qu'il est bien celui de CET
 * acheteur. ⛔ Sinon, un double geste (ou celui d'un collègue) réécrivait un match déjà proposé, voire
 * `interested`, en `sent`, et posait un deuxième deal, une deuxième ligne de journal, une deuxième
 * relance. Aucune ligne marquée : rien d'autre n'est écrit, `deja` le dit (cf. `ResultatProposition`).
 */
export async function execProposer(
  ctx: GesteContext,
  buyer: AcheteurGeste,
  listing: BienGeste,
): Promise<ResultatProposition> {
  // 1. Match → proposé par l'agent, s'il est encore à proposer
  const { data: marques, error: mErr } = await supabase
    .from('matches')
    .update({ status: 'sent', sent_via: 'agent', sent_at: new Date().toISOString() })
    .eq('id', buyer.matchId)
    .eq('contact_id', buyer.id)
    .eq('status', 'suggested')
    .select('id')
  if (mErr) throw mErr
  if (!marques || marques.length === 0) return { dealId: null, deja: true }
  // Jalon Intercom (une première proposition par agent). Signal seul : ni le bien ni l'acheteur ne partent.
  void markIntercomMilestone(INTERCOM_EVENTS.FIRST_MATCH_SENT)

  // 2. Deal : rattacher au deal actif existant, sinon créer en new_lead
  const dealId = await rattacherDeal(ctx, buyer.id, listing)

  // 3. Timeline contact (consignation systématique)
  await logEvent(ctx, {
    action: 'match_propose',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last} · ${listing.title}`,
    metadata: { match_ids: [buyer.matchId], deal_id: dealId, bien_refs: [listing.ref], nombre: 1, score: buyer.score },
  })

  // 4. La relance interne : l'agent notera la réponse de l'acheteur
  await poserRelance(ctx, {
    contactId: buyer.id,
    matchId: buyer.matchId,
    dealId,
    propertyId: listing.kind === 'property' ? listing.id : null,
    message: `Retour de ${buyer.first} ${buyer.last} sur ${listing.ref}`,
  })

  return { dealId, deja: false }
}

/** Un bien d'une sélection du marché, tel que la proposition le consigne. */
export interface PropositionSelection { matchId: string; score: number; bien: BienGeste }

/**
 * « J'ai proposé N biens » — la sélection du marché d'un acheteur, que l'agent lui a présentée par ses
 * propres moyens. ⛔ Rien ne part vers l'acheteur (décision du 21.09.2026) : même consignation que
 * `execProposer`, pour la sélection entière.
 *
 * Le marquage ne touche que les matchs encore `suggested` DE CET ACHETEUR. ⛔ Sans cette restriction, un
 * match déjà `interested` ou `ignored` repris dans la sélection serait réécrit en `sent` : il sortirait
 * de « Réponses », et la réponse consignée par l'agent serait perdue.
 *
 * ⛔ LE SUIVI NE PORTE QUE CE QUI A ÉTÉ MARQUÉ : le journal (`match_ids`, `bien_refs`, `nombre`), le deal
 * et la relance se calculent sur les matchs que la base a réellement réécrits, pas sur ceux qu'on lui a
 * soumis. Aucun : rien d'autre n'est écrit, `deja` le dit (cf. `ResultatProposition`).
 *
 * ⛔ UN GESTE, UN SUIVI : un deal, UNE ligne de journal et UNE relance à +3 j pour la sélection entière.
 * Appeler `execProposer` N fois poserait N relances identiques pour le même acheteur dans
 * « Aujourd'hui ». Le deal et la relance portent le MEILLEUR bien de la sélection.
 */
export async function execProposerSelection(
  ctx: GesteContext,
  acheteur: Pick<AtelierBuyer, 'id' | 'first' | 'last'>,
  propositions: readonly PropositionSelection[],
): Promise<ResultatProposition> {
  if (propositions.length === 0) return { dealId: null, deja: true }
  const { data: marques, error: mErr } = await supabase
    .from('matches')
    .update({ status: 'sent', sent_via: 'agent', sent_at: new Date().toISOString() })
    .in('id', propositions.map((p) => p.matchId))
    .eq('contact_id', acheteur.id)
    .eq('status', 'suggested')
    .select('id')
  if (mErr) throw mErr
  const marquesIds = new Set((marques ?? []).map((r) => r.id))
  const proposees = propositions.filter((p) => marquesIds.has(p.matchId))
  if (proposees.length === 0) return { dealId: null, deja: true }
  void markIntercomMilestone(INTERCOM_EVENTS.FIRST_MATCH_SENT)

  const meilleur = proposees.reduce((a, b) => (b.score > a.score ? b : a))
  const dealId = await rattacherDeal(ctx, acheteur.id, meilleur.bien)
  const n = proposees.length
  const biens = `${n} bien${n > 1 ? 's' : ''}`

  await logEvent(ctx, {
    action: 'match_propose',
    contactId: acheteur.id,
    label: `${acheteur.first} ${acheteur.last} · ${biens}`,
    metadata: {
      match_ids: proposees.map((p) => p.matchId), deal_id: dealId, bien_refs: proposees.map((p) => p.bien.ref), nombre: n,
    },
  })

  // Une sélection du marché ne porte aucun bien en mandat : la relance n'en nomme pas.
  await poserRelance(ctx, {
    contactId: acheteur.id,
    matchId: meilleur.matchId,
    dealId,
    propertyId: null,
    message: `Retour de ${acheteur.first} ${acheteur.last} sur ${biens} proposé${n > 1 ? 's' : ''}`,
  })

  return { dealId, deja: false }
}

/**
 * « J'ai relancé » (R) — l'agent a relancé l'acheteur lui-même ; le CRM repousse la relance interne.
 *
 * ⛔ Rien ne part vers l'acheteur (décision du 21.09.2026) : le geste lui envoyait jusque-là un e-mail
 * de relance. Pas de nouveau deal ; le match reste `sent`, `sent_at` date la dernière sollicitation.
 */
export async function execRelance(
  ctx: GesteContext,
  buyer: AcheteurGeste,
  listing: BienGeste,
): Promise<void> {
  // 1. Dernière sollicitation = maintenant (le match reste 'sent' / sans retour)
  const { error: mErr } = await supabase
    .from('matches')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', buyer.matchId)
  if (mErr) throw mErr

  // 2. Timeline
  await logEvent(ctx, {
    action: 'relance',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last} · ${listing.title}`,
    metadata: { match_id: buyer.matchId, bien_ref: listing.ref, canal: 'agent' },
  })

  // 3. Relance interne repoussée de 3 j (celle du match, sinon posée). Seule la relance de
  // PROPOSITION se reprend, la plus récente : un match porte aussi le rappel d'un report
  // (`custom`, « de retour dans la file »), que ce geste ne doit ni dater ni réécrire.
  const message = `Retour de ${buyer.first} ${buyer.last} sur ${listing.ref}, après relance`
  const { data: pending } = await supabase
    .from('reminders')
    .select('id')
    .eq('match_id', buyer.matchId)
    .eq('type', 'follow_up_sent_property')
    .in('status', ['pending', 'triggered'])
    .order('created_at', { ascending: false })
    .limit(1)
  if (pending && pending.length > 0) {
    await supabase
      .from('reminders')
      .update({ trigger_at: inDays(DELAI_RELANCE_JOURS), status: 'pending', message_template: message })
      .eq('id', (pending[0] as { id: string }).id)
  } else {
    await poserRelance(ctx, {
      contactId: buyer.id,
      matchId: buyer.matchId,
      dealId: null,
      propertyId: listing.kind === 'property' ? listing.id : null,
      message,
    })
  }
}

/** « Plus tard » (P) — snooze +7 j sur le match, retour visible dans Aujourd'hui, consigné au journal */
export async function execSnooze(ctx: GesteContext, buyer: AcheteurGeste): Promise<void> {
  const until = inDays(7)
  const { error } = await supabase
    .from('matches')
    .update({ snoozed_until: until })
    .eq('id', buyer.matchId)
  if (error) throw error

  await supabase.from('reminders').insert({
    agency_id: ctx.agencyId,
    contact_id: buyer.id,
    match_id: buyer.matchId,
    type: 'custom',
    trigger_rule: 'manual',
    trigger_days: 7,
    trigger_at: until,
    status: 'pending',
    channel: 'notification',
    message_template: `${buyer.first} ${buyer.last} — acheteur reporté, de retour dans la file matching`,
  })

  await logEvent(ctx, {
    action: 'match_reporte',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last}`,
    metadata: { match_id: buyer.matchId, jusqu_au: until, score: buyer.score },
  })
}

/** « Écarter » (X) — le couple n'est plus jamais proposé. Aucun deal ; consigné au journal. */
export async function execDismiss(ctx: GesteContext, buyer: AcheteurGeste): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'ignored' })
    .eq('id', buyer.matchId)
  if (error) throw error

  await logEvent(ctx, {
    action: 'match_ecarte',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last}`,
    metadata: { match_id: buyer.matchId, score: buyer.score },
  })
}

/** La réponse de l'acheteur à un bien proposé, consignée par l'agent (Intéressé / Pas intéressé).
 *  Pose matches.status -> déclenche set_match_response_at (response_at) + log_match_reaction
 *  (audit, tracé `actor_kind = 'user'`) — la boucle se ferme chez l'agent.
 *
 *  La réponse est là : la relance de proposition du match (« Retour de … ») n'a plus d'objet et
 *  passe `done`. Sans ça, elle remontait dans « Aujourd'hui » pour un acheteur qui avait répondu.
 *  Un refus est signalé sans faire lever : la réponse, elle, est consignée. */
export async function execReact(
  buyer: Pick<AtelierBuyer, 'matchId'>,
  reaction: 'interested' | 'rejected',
): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status: reaction })
    .eq('id', buyer.matchId)
  if (error) throw error

  const { error: rErr } = await supabase
    .from('reminders')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('match_id', buyer.matchId)
    .eq('type', 'follow_up_sent_property')
    .in('status', ['pending', 'triggered'])
  if (rErr) console.error('[atelier] reminder close failed', rErr)
}

/** Réactivation manuelle anticipée d'un reporté (parking) — immédiat */
export async function execWake(matchId: string): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ snoozed_until: null })
    .eq('id', matchId)
  if (error) throw error
  await supabase
    .from('reminders')
    .update({ status: 'cancelled' })
    .eq('match_id', matchId)
    .eq('type', 'custom')
    .in('status', ['pending', 'triggered'])
}

// ─── privé ──────────────────────────────────────────────────────────────
const inDays = (d: number): string => new Date(Date.now() + d * 864e5).toISOString()

/** Délai de la relance interne : posée par « Je l'ai proposé », repoussée d'autant par « J'ai relancé ». */
const DELAI_RELANCE_JOURS = 3

/**
 * La relance interne d'une proposition : une tâche de l'agent (canal `task`), jamais un message à
 * l'acheteur. Elle remplace la relance J+3 automatique d'`automation-engine`, retirée avec ce lot : elle
 * doublait celle-ci et pouvait écrire au client. Partagée par les trois gestes pour qu'ils ne
 * divergent pas.
 *
 * Un refus est signalé sans faire lever : le match est déjà proposé et le journal écrit, le geste ne
 * doit pas passer pour échoué — mais il ne doit pas passer inaperçu non plus (même règle que `logEvent`).
 */
async function poserRelance(
  ctx: GesteContext,
  r: { contactId: string; matchId: string; dealId: string | null; propertyId: string | null; message: string },
): Promise<void> {
  const { error } = await supabase.from('reminders').insert({
    agency_id: ctx.agencyId,
    contact_id: r.contactId,
    property_id: r.propertyId,
    transaction_id: r.dealId,
    match_id: r.matchId,
    type: 'follow_up_sent_property',
    trigger_rule: 'manual',
    trigger_days: DELAI_RELANCE_JOURS,
    trigger_at: inDays(DELAI_RELANCE_JOURS),
    status: 'pending',
    channel: 'task',
    message_template: r.message,
  })
  if (error) console.error('[atelier] reminder insert failed', error)
}

async function logEvent(
  ctx: GesteContext,
  e: { action: string; contactId: string; label: string; metadata: Record<string, unknown> },
): Promise<void> {
  const { error } = await supabase.from('activity_events').insert({
    agency_id: ctx.agencyId,
    actor_id: ctx.userId,
    actor_kind: 'user',
    action: e.action,
    entity_type: 'contact',
    entity_id: e.contactId,
    category: 'deal',
    severity: 'info',
    object_label: e.label,
    metadata: e.metadata as Json,
  })
  // Consignation = exigence du contrat ; une erreur RLS ne doit pas passer inaperçue
  if (error) console.error('[atelier] activity_events insert failed', error)
}
