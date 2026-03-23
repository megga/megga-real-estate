import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { MatchWithRelations, MatchStatus } from '@/types/matching'

// ── Shared select for matches with relations ────────────────────────────────

const MATCH_SELECT = `
  *,
  contact:contacts(id, first_name, last_name, email, phone, whatsapp_phone, type, score),
  property:properties(id, title, description, type, status, price, rooms, bedrooms, bathrooms, surface_m2, floor, year_built, address, city, canton, postal_code, photos, features, charges_monthly)
`

// ── Filters ─────────────────────────────────────────────────────────────────

export interface MatchFilters {
  status?: MatchStatus | 'all'
  contactId?: string
  propertyId?: string
}

// ── useMatches — list matches with filters ──────────────────────────────────

export function useMatches(filters?: MatchFilters) {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  return useQuery({
    queryKey: ['matches', agencyId, filters],
    queryFn: async () => {
      if (!agencyId) return []

      let query = supabase
        .from('matches')
        .select(MATCH_SELECT)
        .eq('agency_id', agencyId)
        .order('score', { ascending: false })

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      if (filters?.contactId) {
        query = query.eq('contact_id', filters.contactId)
      }
      if (filters?.propertyId) {
        query = query.eq('property_id', filters.propertyId)
      }

      const { data, error } = await query
      if (error) throw error
      return (data || []) as MatchWithRelations[]
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })
}

// ── useContactMatches — matches for a specific contact ──────────────────────

export function useContactMatches(contactId: string) {
  return useMatches({ contactId })
}

// ── usePropertyMatches — matches for a specific property ────────────────────

export function usePropertyMatches(propertyId: string) {
  return useMatches({ propertyId })
}

// ── useRunMatching — trigger the matching engine Edge Function ───────────────

export function useRunMatching() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      trigger: 'new_property' | 'new_search' | 'daily'
      property_id?: string
      contact_id?: string
    }) => {
      if (!profile?.agency_id) throw new Error('No agency_id')

      const { data, error } = await supabase.functions.invoke('matching-engine', {
        body: {
          trigger: params.trigger,
          property_id: params.property_id,
          contact_id: params.contact_id,
          agency_id: profile.agency_id,
        },
      })

      if (error) throw error
      return data as { matches_created: number; matches: MatchWithRelations[] }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })
}

// ── useUpdateMatchStatus — change a match's status ──────────────────────────

export function useUpdateMatchStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ matchId, status }: { matchId: string; status: MatchStatus }) => {
      const { data, error } = await supabase
        .from('matches')
        .update({ status })
        .eq('id', matchId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })
}

// ── useSendMatchToClient — send property via Edge Function ──────────────────

export function useSendMatchToClient() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      matchId,
      channel,
      message,
    }: {
      matchId: string
      channel: 'email' | 'whatsapp'
      message: string
    }) => {
      if (!profile?.agency_id) throw new Error('No agency_id')

      const { data, error } = await supabase.functions.invoke('send-property-email', {
        body: {
          match_id: matchId,
          channel,
          message,
          agency_id: profile.agency_id,
          agent_id: profile.id,
        },
      })

      if (error) throw error
      return data as { success: boolean; match_id: string; channel: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })
}
