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
    source_url: string
    agency_name: string | null
    price_per_m2: number | null
    days_on_market: number
    status: string
  }
}

// ── Unified match shape used by MatchingPage ────────────────────────────────

export interface MatchResult {
  id: string
  contactId: string
  contactName: string
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
    // Market-specific fields
    source_portal?: string
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
        source_url: ml.source_url,
        agency_name: ml.agency_name,
        price_per_m2: ml.price_per_m2 ? Number(ml.price_per_m2) : null,
        days_on_market: ml.days_on_market ?? 0,
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
      }

  return {
    id: m.id,
    contactId: m.contact_id,
    contactName: contact ? `${contact.first_name} ${contact.last_name}` : 'Contact inconnu',
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

export function useMatching(contactId?: string) {
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
          '*, contact:contacts(first_name, last_name, email, phone), property:properties(title, price, address, city, canton, postal_code, rooms, bedrooms, surface_m2, photos, type, description, features, floor, year_built, charges_monthly), market_listing:market_listings(id, title, price, current_price, address, city, canton, postal_code, rooms, bedrooms, bathrooms, surface_m2, photos, type, description, features, floor, source_portal, source_url, agency_name, price_per_m2, days_on_market, status)'
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
    enabled: true,
  })

  // ── Update match status ──
  const sendMatchMutation = useMutation({
    mutationFn: async ({ matchId, channel }: { matchId: string; channel: string }) => {
      const { error } = await supabase
        .from('matches')
        .update({
          status: 'sent',
          sent_via: channel,
          sent_at: new Date().toISOString(),
        })
        .eq('id', matchId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
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
    sendMatch: (matchId: string, channel: 'email' | 'whatsapp' | 'both') =>
      sendMatchMutation.mutate({ matchId, channel }),
    ignoreMatch: (matchId: string) => ignoreMatchMutation.mutate(matchId),
    markReaction: (matchId: string, reaction: MatchReaction) =>
      reactionMutation.mutate({ matchId, reaction }),
    runMatching: (targetContactId: string) => runMatchingMutation.mutate(targetContactId),
    isRunning: runMatchingMutation.isPending,
  }
}

// ── Re-exports for compatibility with main's MatchingPanel/SendMatchDialog ──

export { useMatching as useContactMatches }

export function useRunMatching() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { trigger: string; property_id?: string; contact_id?: string }) => {
      if (!profile?.agency_id) throw new Error('No agency_id')
      const { data, error } = await supabase.functions.invoke('matching-engine', {
        body: { ...params, agency_id: profile.agency_id },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['matches'] }) },
  })
}

export function useUpdateMatchStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ matchId, status }: { matchId: string; status: string }) => {
      const { error } = await supabase.from('matches').update({ status }).eq('id', matchId)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['matches'] }) },
  })
}

export function useSendMatchToClient() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ matchId, channel, message }: { matchId: string; channel: string; message: string }) => {
      if (!profile?.agency_id) throw new Error('No agency_id')
      const { data, error } = await supabase.functions.invoke('send-property-email', {
        body: { match_id: matchId, channel, message, agency_id: profile.agency_id, agent_id: profile.id },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['matches'] }) },
  })
}
