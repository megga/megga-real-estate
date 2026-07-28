/**
 * Hooks React Query de la console super-admin des agences : liste enrichie de
 * compteurs (via RPC `get_agency_stats`), détail d'une agence et ses sous-ressources
 * (membres, biens, transactions, activité). Alimente AdminAgencyDetailPage.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AgencyWithStats {
  id: string
  name: string
  slug: string
  logo_url: string | null
  address: string | null
  phone: string | null
  email: string | null
  plan: string | null
  status: string
  created_at: string
  agent_count: number
  property_count: number
  transaction_count: number
  // Statut d'abonnement Stripe (miroir subscriptions) — pour badges trials/past_due.
  subscription_status: string | null
  current_period_end: string | null
}

/** Liste des agences + compteurs agrégés côté serveur, et mutation suspend/réactive (via edge `admin-agency-lifecycle`). */
export function useAdminAgencies() {
  const queryClient = useQueryClient()

  const agencies = useQuery({
    queryKey: ['admin-agencies'],
    queryFn: async (): Promise<AgencyWithStats[]> => {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name, slug, logo_url, address, phone, email, plan, status, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error

      const agencyIds = (data ?? []).map(a => a.id)
      if (agencyIds.length === 0) return []

      // Use RPC for server-side counting (single SQL query instead of fetching all rows)
      // + abonnements en une passe (policy super_admin_read_all_subscriptions) pour les badges trials.
      const [{ data: stats }, { data: subs }] = await Promise.all([
        supabase.rpc('get_agency_stats', { agency_ids: agencyIds }),
        supabase.from('subscriptions').select('agency_id, status, current_period_end').in('agency_id', agencyIds),
      ])
      const statsMap: Record<string, { agent_count: number; property_count: number; transaction_count: number }> = {}
      for (const s of stats ?? []) {
        statsMap[s.agency_id] = { agent_count: Number(s.agent_count), property_count: Number(s.property_count), transaction_count: Number(s.transaction_count) }
      }
      const subMap: Record<string, { status: string | null; current_period_end: string | null }> = {}
      for (const s of subs ?? []) {
        subMap[s.agency_id] = { status: s.status ?? null, current_period_end: s.current_period_end ?? null }
      }

      return (data ?? []).map(agency => ({
        ...agency,
        status: agency.status ?? 'active',
        agent_count: statsMap[agency.id]?.agent_count ?? 0,
        property_count: statsMap[agency.id]?.property_count ?? 0,
        transaction_count: statsMap[agency.id]?.transaction_count ?? 0,
        subscription_status: subMap[agency.id]?.status ?? null,
        current_period_end: subMap[agency.id]?.current_period_end ?? null,
      }))
    },
    staleTime: 30_000,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'suspended' }) => {
      // P4 : passe par l'edge admin-agency-lifecycle — l'ancien update nu de
      // agencies.status ne bloquait personne (aucun ban GoTrue des membres).
      const { error } = await supabase.functions.invoke('admin-agency-lifecycle', {
        body: { action: status === 'suspended' ? 'suspend' : 'reactivate', agency_id: id },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-agencies'] })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  return {
    agencies: agencies.data ?? [],
    isLoading: agencies.isLoading,
    isError: agencies.isError,
    refetch: agencies.refetch,
    updateStatus,
  }
}

/** Détail complet d'une agence par id (`select('*')`). */
export function useAdminAgency(id: string) {
  return useQuery({
    queryKey: ['admin-agency', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
    staleTime: 30_000,
  })
}

/** Membres (profiles) d'une agence, les plus récents d'abord. */
export function useAgencyMembers(agencyId: string) {
  return useQuery({
    queryKey: ['admin-agency-members', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, role, phone, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })
}

/** Biens d'une agence (colonnes de liste seulement, sans description lourde). */
export function useAgencyProperties(agencyId: string) {
  return useQuery({
    queryKey: ['admin-agency-properties', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, title, status, price, city, canton, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })
}

/** Transactions d'une agence (stade pipeline, statut, montant offert). */
export function useAgencyTransactions(agencyId: string) {
  return useQuery({
    queryKey: ['admin-agency-transactions', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, stage, status, price_offered, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })
}

/** 30 derniers événements d'activité d'une agence. */
export function useAgencyActivity(agencyId: string) {
  return useQuery({
    queryKey: ['admin-agency-activity', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, metadata, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data ?? []
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })
}
