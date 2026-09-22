/**
 * Hook du module Matching pour MatchingPage : charge les `matches` de l'agence
 * (biens internes + market_listings Flatfox), normalise les deux formes en une
 * forme unifiée `MatchResult`, et expose les gestes agent (ignore, réaction client,
 * relance du matching via l'Edge function `matching-engine`). « Je l'ai proposé »
 * n'est PAS ici : il passe par `execProposer` (useAtelierMatching), seul à poser le
 * journal et la relance. Aucun geste n'écrit à l'acheteur.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { MatchReaction } from '@/types/matching'

// ── Supabase match shape ────────────────────────────────────────────────────

export interface SupabaseMatchResult {
  id: string
  contact_id: string
  property_id: string | null
  market_listing_id: string | null
  client_search_id: string | null
  score: number
  reasons: Record<string, { match: boolean; score: number; detail: string }>
  status: 'suggested' | 'sent' | 'visit_planned' | 'interested' | 'rejected' | 'ignored'
  source: 'internal' | 'market'
  sent_via: string | null
  sent_at: string | null
  created_at: string
  contact?: {
    first_name: string
    last_name: string
    email: string
    phone: string
  }
  property?: {
    title: string
    price: number
    address: string
    city: string
    canton: string
    postal_code: string
    rooms: number
    bedrooms: number
    surface_m2: number
    photos: string[]
    type: string
    description: string
    features: string[]
    floor: number | null
    year_built: number
    charges_monthly: number
    transaction_type?: string | null
  }
  market_listing?: {
    id: string
    title: string
    price: number
    current_price: number
    address: string
    city: string
    canton: string
    postal_code: string
    rooms: number
    bedrooms: number
    bathrooms: number
    surface_m2: number
    photos: string[]
    type: string
    description: string
    features: Record<string, unknown>[]
    floor: number | null
    source_portal: string
    source_id: string | null
    source_url: string
    agency_name: string | null
    price_per_m2: number | null
    days_on_market: number
    status: string
    transaction_type?: string | null
  }
}

// ── Unified match shape used by MatchingPage ────────────────────────────────

export interface MatchResult {
  id: string
  contactId: string
  contactName: string
  /** Prénom et nom séparés : le journal et la relance de « Je l'ai proposé » les nomment. */
  contactFirstName: string
  contactLastName: string
  propertyId: string | null
  marketListingId: string | null
  source: 'internal' | 'market'
  listing: {
    title: string
    price: number
    address: string
    city: string
    canton: string
    postal_code: string
    rooms: number
    bedrooms: number
    surface_m2: number
    photos: string[]
    type: string
    description: string
    features: Record<string, string>
    floor: number | null
    total_floors: number | null
    year_built: number
    charges_monthly: number
    /**
     * 'rent' = location (le prix est un LOYER MENSUEL), 'buy' = vente. La moitié des
     * annonces de marché actives sont des locations (42 743 sur 85 101, 13.09.2026) :
     * sans ce champ, le catalogue les affichait sous « Prix de vente ».
     */
    transaction_type?: 'buy' | 'rent' | null
    // Market-specific fields
    source_portal?: string
    /** Identifiant du portail : il fait la référence affichée (`refAnnonceMarche`). */
    source_id?: string | null
    source_url?: string
    agency_name?: string | null
    price_per_m2?: number | null
    days_on_market?: number
  }
  score: number
  reasons: {
    budget: { match: boolean; score: number; detail: string }
    zone: { match: boolean; score: number; detail: string }
    type: { match: boolean; score: number; detail: string }
    rooms: { match: boolean; score: number; detail: string }
    features: { match: boolean; score: number; detail: string }
  }
  status: 'suggested' | 'sent' | 'visit_planned' | 'interested' | 'rejected' | 'ignored'
  sentVia: string | null
  sentAt: string | null
  createdAt: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** `transaction_type` des deux tables, ramené à 'buy' | 'rent' (NULL si inconnu). */
function typeTransaction(v: string | null | undefined): 'buy' | 'rent' | null {
  return v === 'rent' || v === 'buy' ? v : null
}

/** Normalise un match Supabase (bien interne OU market_listing) en `MatchResult` unifié pour l'UI. */
function supabaseToMatch(m: SupabaseMatchResult): MatchResult {
  const contact = m.contact
  const isMarket = m.source === 'market'
  const property = m.property
  const ml = m.market_listing

  // Convert features array to Record<string, string> for compatibility with existing UI
  const featuresRecord: Record<string, string> = {}
  if (!isMarket && Array.isArray(property?.features)) {
    for (const f of property.features) {
      featuresRecord[f] = '✓'
    }
  }

  // Build listing from either internal property or market listing
  const listing: MatchResult['listing'] = isMarket && ml
    ? {
        title: ml.title ?? 'Bien inconnu',
        price: Number(ml.current_price ?? ml.price ?? 0),
        address: ml.address ?? '',
        city: ml.city ?? '',
        canton: ml.canton ?? '',
        postal_code: ml.postal_code ?? '',
        rooms: Number(ml.rooms ?? 0),
        bedrooms: ml.bedrooms ?? 0,
        surface_m2: Number(ml.surface_m2 ?? 0),
        photos: ml.photos ?? [],
        type: ml.type ?? '',
        description: ml.description ?? '',
        features: {},
        floor: ml.floor ?? null,
        total_floors: null,
        year_built: 0,
        charges_monthly: 0,
        source_portal: ml.source_portal,
        source_id: ml.source_id,
        source_url: ml.source_url,
        agency_name: ml.agency_name,
        price_per_m2: ml.price_per_m2 ? Number(ml.price_per_m2) : null,
        days_on_market: ml.days_on_market ?? 0,
        transaction_type: typeTransaction(ml.transaction_type),
      }
    : {
        title: property?.title ?? 'Bien inconnu',
        price: property?.price ?? 0,
        address: property?.address ?? '',
        city: property?.city ?? '',
        canton: property?.canton ?? '',
        postal_code: property?.postal_code ?? '',
        rooms: property?.rooms ?? 0,
        bedrooms: property?.bedrooms ?? 0,
        surface_m2: property?.surface_m2 ?? 0,
        photos: property?.photos ?? [],
        type: property?.type ?? '',
        description: property?.description ?? '',
        features: featuresRecord,
        floor: property?.floor ?? null,
        total_floors: null,
        year_built: property?.year_built ?? 0,
        charges_monthly: property?.charges_monthly ?? 0,
        transaction_type: typeTransaction(property?.transaction_type),
      }

  return {
    id: m.id,
    contactId: m.contact_id,
    contactName: contact ? `${contact.first_name} ${contact.last_name}` : 'Contact inconnu',
    contactFirstName: contact?.first_name ?? '',
    contactLastName: contact?.last_name ?? '',
    propertyId: m.property_id,
    marketListingId: m.market_listing_id,
    source: m.source || 'internal',
    listing,
    score: m.score,
    reasons: {
      budget: m.reasons?.budget ?? { match: false, score: 0, detail: '' },
      zone: m.reasons?.zone ?? { match: false, score: 0, detail: '' },
      type: m.reasons?.type ?? { match: false, score: 0, detail: '' },
      rooms: m.reasons?.rooms ?? { match: false, score: 0, detail: '' },
      features: m.reasons?.features ?? { match: false, score: 0, detail: '' },
    },
    status: m.status,
    sentVia: m.sent_via,
    sentAt: m.sent_at,
    createdAt: m.created_at,
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Matches de l'agence (optionnellement filtrés par contact) + actions associées.
 * Passer `{ enabled: false }` garde les surfaces démo inertes (aucun fetch Supabase).
 */
export function useMatching(contactId?: string, opts?: { enabled?: boolean }) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const agencyId = profile?.agency_id

  // ── Load matches from Supabase ──
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['matches', agencyId, contactId],
    queryFn: async (): Promise<MatchResult[]> => {
      if (!agencyId) return []

      let query = supabase
        .from('matches')
        .select(
          '*, contact:contacts(first_name, last_name, email, phone), property:properties(title, price, address, city, canton, postal_code, rooms, bedrooms, surface_m2, photos, type, description, features, floor, year_built, charges_monthly, transaction_type), market_listing:market_listings(id, title, price, current_price, address, city, canton, postal_code, rooms, bedrooms, bathrooms, surface_m2, photos, type, description, features, floor, source_portal, source_id, source_url, agency_name, price_per_m2, days_on_market, status, transaction_type)'
        )
        .eq('agency_id', agencyId)
        .order('score', { ascending: false })

      if (contactId) {
        query = query.eq('contact_id', contactId)
      }

      const { data, error } = await query
      if (error) throw error

      const supabaseMatches = (data || []) as unknown as SupabaseMatchResult[]
      return supabaseMatches.map(supabaseToMatch)
    },
    // Rétro-compatible : `enabled` vaut true par défaut (comportement inchangé
    // pour tous les appelants existants). Permet aux surfaces démo de rester
    // inertes (aucun fetch Supabase) en passant `{ enabled: false }`.
    enabled: opts?.enabled ?? true,
  })

  const ignoreMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase
        .from('matches')
        .update({ status: 'ignored' })
        .eq('id', matchId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })

  // ── Réaction du client à un dossier envoyé (interested / visit_planned /
  // rejected). On ne pose PAS response_at ici : le trigger DB
  // (set_match_response_at) en est la source unique. Invalide les DEUX
  // queryKeys car la page Atelier lit ['atelier-matches'] et useMatching ['matches'].
  const reactionMutation = useMutation({
    mutationFn: async ({ matchId, reaction }: { matchId: string; reaction: MatchReaction }) => {
      const { error } = await supabase
        .from('matches')
        .update({ status: reaction })
        .eq('id', matchId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      queryClient.invalidateQueries({ queryKey: ['atelier-matches'] })
    },
  })

  // ── Trigger matching via Edge Function ──
  const runMatchingMutation = useMutation({
    mutationFn: async (targetContactId: string) => {
      const { data, error } = await supabase.functions.invoke('matching-engine', {
        body: {
          mode: 'match-contact',
          contact_id: targetContactId,
          agency_id: agencyId,
        },
      })
      if (error) throw error
      return data as { newMatches: number; mode: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })

  const suggested = matches.filter((m) => m.status === 'suggested')
  const sent = matches.filter((m) => m.status === 'sent')
  const internalMatches = matches.filter((m) => m.source === 'internal')
  const marketMatches = matches.filter((m) => m.source === 'market')

  return {
    matches,
    suggested,
    sent,
    internalMatches,
    marketMatches,
    isLoading,
    ignoreMatch: (matchId: string) => ignoreMatchMutation.mutate(matchId),
    markReaction: (matchId: string, reaction: MatchReaction) =>
      reactionMutation.mutate({ matchId, reaction }),
    runMatching: (targetContactId: string) => runMatchingMutation.mutate(targetContactId),
    isRunning: runMatchingMutation.isPending,
  }
}

