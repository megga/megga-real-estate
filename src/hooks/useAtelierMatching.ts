// Atelier Matching — données + gestes métier (contrat HANDOFF_MATCHING_COUTURES).
//
// Données : matches (+ contact + property/market_listing) groupés par annonce
// pivot (`p:<uuid>` interne / `m:<uuid>` veille marché) + KYC du dernier
// dossier acheteur par contact. Le mode « Par acheteur » réutilise les mêmes
// matches re-groupés par contact (poolFor).
//
// Gestes (exécutés par la page APRÈS la fenêtre d'annulation de 5 s — undo
// Gmail-style : rien n'est écrit tant que le toast offre « Annuler ») :
//   sendDossier  → matches.status='sent' + Deal new_lead (créé ou rattaché) +
//                  activity_events 'dossier_envoye' + reminder +5 j +
//                  send-property-email (si email)
//   relance      → matches.sent_at=now + activity_events 'relance' +
//                  reminder repoussé +5 j + send-relance-email (si email)
//   snooze       → matches.snoozed_until=+7 j + reminder 'custom' à échéance
//                  (la ligne « de retour » remonte dans Aujourd'hui)
//   dismiss      → matches.status='ignored' (le moteur ne re-propose jamais
//                  un couple existant — aucune écriture deal/timeline)
//   wake         → snoozed_until=null + reminder annulé (immédiat, hors queue)

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { mapKycStatus } from '@/lib/sugarAdapters'
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

export function mapMarketListing(row: RawMarketRow): AtelierListing {
  const features = featureList(row.features).map(f => f.toLowerCase())
  const price = num(row.current_price) ?? num(row.price) ?? 0
  const was = num(row.price_at_first_seen)
  const photos = row.photos ?? []
  return {
    key: `m:${row.id}`,
    id: row.id,
    kind: 'market',
    ref: `MG-${row.source_portal === 'flatfox' ? 'FL' : 'MK'}-${row.source_id ?? row.id.slice(0, 6)}`,
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
    ref: `MG-IN-${row.id.slice(0, 6).toUpperCase()}`,
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
    case 'sent': return { status: 'no-reply', engage: 'Envoyé · sans retour' }
    case 'interested': return { status: 'engaged', engage: 'Dossier consulté' }
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

  const { data: kycCases = [], isLoading: kycLoading, isError: kycError } = useQuery({
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
    isLoading: matchesLoading || kycLoading,
    isError: matchesError || kycError,
    pivots,
    pivotByKey,
    defaultPivotKey: pivots[0]?.listing.key ?? null,
    poolFor,
    buyerFor,
    refresh,
  }
}

export const isSnoozed = (until: string | null): boolean =>
  until != null && new Date(until).getTime() > Date.now()

// ═══════════════════ Gestes métier (exécuteurs) ═══════════════════════════
// Appelés par la page APRÈS la fenêtre d'annulation (5 s) — cf. en-tête.

export interface GesteContext {
  agencyId: string
  userId: string
  agentName: string
  agentPhone: string | null
}

export interface SendResult {
  dealId: string | null
  emailSent: boolean
}

/** « Envoyer le dossier » (E) — deal + timeline + nextAction + notification */
export async function execSendDossier(
  ctx: GesteContext,
  buyer: AtelierBuyer,
  listing: AtelierListing,
): Promise<SendResult> {
  // 1. Match → sent
  const { error: mErr } = await supabase
    .from('matches')
    .update({ status: 'sent', sent_via: 'email', sent_at: new Date().toISOString() })
    .eq('id', buyer.matchId)
  if (mErr) throw mErr

  // 2. Deal : rattacher au deal actif existant, sinon créer en new_lead
  let dealId: string | null = null
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, property_id')
    .eq('agency_id', ctx.agencyId)
    .eq('contact_buyer_id', buyer.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  if (existing && existing.length > 0) {
    dealId = (existing[0] as { id: string; property_id: string | null }).id
    // Rattacher le bien si le deal n'en porte pas encore (jamais d'écrasement)
    if (listing.kind === 'property' && !(existing[0] as { property_id: string | null }).property_id) {
      await supabase.from('transactions').update({ property_id: listing.id }).eq('id', dealId)
    }
  } else {
    const insert: TablesInsert<'transactions'> = {
      agency_id: ctx.agencyId,
      contact_buyer_id: buyer.id,
      assigned_to: ctx.userId,
      stage: 'new_lead',
      status: 'active',
    }
    if (listing.kind === 'property') insert.property_id = listing.id
    else insert.market_listing_id = listing.id
    const { data: created, error: dErr } = await supabase
      .from('transactions')
      .insert(insert)
      .select('id')
      .single()
    if (dErr) throw dErr
    dealId = (created as { id: string }).id
  }

  // 3. Timeline contact (consignation systématique)
  await logEvent(ctx, {
    action: 'dossier_envoye',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last} · ${listing.title}`,
    metadata: {
      match_id: buyer.matchId,
      deal_id: dealId,
      bien_ref: listing.ref,
      bien_key: listing.key,
      canal: buyer.email ? 'email' : 'aucun',
      score: buyer.score,
    },
  })

  // 4. nextAction +5 j (remonte dans « Aujourd'hui » à échéance ; la même
  // entrée bloque le doublon +3 j de l'automation-engine — dédup par match_id)
  await supabase.from('reminders').insert({
    agency_id: ctx.agencyId,
    contact_id: buyer.id,
    property_id: listing.kind === 'property' ? listing.id : null,
    transaction_id: dealId,
    match_id: buyer.matchId,
    type: 'follow_up_sent_property',
    trigger_rule: 'manual',
    trigger_days: 5,
    trigger_at: inDays(5),
    status: 'pending',
    channel: 'task',
    message_template: `Sans réponse au dossier ${listing.ref} — relancer ${buyer.first} ${buyer.last}`,
  })

  // 5. Notification e-mail (l'agent a validé dans la confirmation — human-in-the-loop)
  let emailSent = false
  if (buyer.email) {
    const { error: eErr } = await supabase.functions.invoke('send-property-email', {
      body: {
        to: buyer.email,
        contactFirstName: buyer.first,
        agentName: ctx.agentName,
        agentPhone: ctx.agentPhone ?? '',
        property: {
          title: listing.title,
          price: listing.price,
          address: listing.addr,
          city: '',
          rooms: listing.rooms ?? 0,
          surface_m2: listing.area ?? 0,
          type: listing.type,
          photo_url: listing.gallery[0]?.url ?? null,
          source_url: listing.sourceUrl,
          source_agency: listing.agency.name,
          source_portal: null,
        },
      },
    })
    emailSent = !eErr
  }

  return { dealId, emailSent }
}

/** « Relancer · autre canal » (R) — pas de nouveau deal, nextAction repoussée */
export async function execRelance(
  ctx: GesteContext,
  buyer: AtelierBuyer,
  listing: AtelierListing,
): Promise<SendResult> {
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
    metadata: { match_id: buyer.matchId, bien_ref: listing.ref, canal: buyer.email ? 'email' : 'aucun' },
  })

  // 3. nextAction repoussée +5 j (reminder existant du match, sinon créé)
  const { data: pending } = await supabase
    .from('reminders')
    .select('id')
    .eq('match_id', buyer.matchId)
    .in('status', ['pending', 'triggered'])
    .limit(1)
  if (pending && pending.length > 0) {
    await supabase
      .from('reminders')
      .update({ trigger_at: inDays(5), status: 'pending', message_template: `Relance 2 — toujours sans réponse de ${buyer.first} ${buyer.last} (${listing.ref})` })
      .eq('id', (pending[0] as { id: string }).id)
  } else {
    await supabase.from('reminders').insert({
      agency_id: ctx.agencyId,
      contact_id: buyer.id,
      match_id: buyer.matchId,
      type: 'follow_up_sent_property',
      trigger_rule: 'manual',
      trigger_days: 5,
      trigger_at: inDays(5),
      status: 'pending',
      channel: 'task',
      message_template: `Relance 2 — toujours sans réponse de ${buyer.first} ${buyer.last} (${listing.ref})`,
    })
  }

  // 4. Relance douce par e-mail
  let emailSent = false
  if (buyer.email) {
    const { error: eErr } = await supabase.functions.invoke('send-relance-email', {
      body: {
        to: buyer.email,
        subject: `Toujours disponible — ${listing.title}`,
        body: `Bonjour ${buyer.first},\n\nJe me permets de revenir vers vous au sujet du bien « ${listing.title} » (${listing.addr}) que je vous ai transmis récemment.\n\nIl est toujours disponible et correspond bien à votre recherche. Souhaitez-vous le visiter ou en discuter ?\n\nBien à vous,`,
        agentName: ctx.agentName,
        leadId: buyer.id,
        agencyId: ctx.agencyId,
      },
    })
    emailSent = !eErr
  }

  return { dealId: null, emailSent }
}

/** « Plus tard » (P) — snooze +7 j sur le match, retour visible dans Aujourd'hui */
export async function execSnooze(ctx: GesteContext, buyer: AtelierBuyer): Promise<void> {
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
}

/** « Écarter » (X) — le couple n'est plus jamais proposé. Aucune écriture deal/timeline. */
export async function execDismiss(buyer: AtelierBuyer): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'ignored' })
    .eq('id', buyer.matchId)
  if (error) throw error
}

/** Réaction du client à un dossier envoyé (HITL, Intéressé/Pas intéressé). Pose
 *  matches.status -> déclenche set_match_response_at (response_at) + log_match_reaction
 *  (audit) — ferme la boucle de réactivité depuis la route live. */
export async function execReact(
  buyer: AtelierBuyer,
  reaction: 'interested' | 'rejected',
): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status: reaction })
    .eq('id', buyer.matchId)
  if (error) throw error
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
