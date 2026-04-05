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
}

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
      const { data: stats } = await supabase.rpc('get_agency_stats', { agency_ids: agencyIds })
      const statsMap: Record<string, { agent_count: number; property_count: number; transaction_count: number }> = {}
      for (const s of stats ?? []) {
        statsMap[s.agency_id] = { agent_count: Number(s.agent_count), property_count: Number(s.property_count), transaction_count: Number(s.transaction_count) }
      }

      return (data ?? []).map(agency => ({
        ...agency,
        status: agency.status ?? 'active',
        agent_count: statsMap[agency.id]?.agent_count ?? 0,
        property_count: statsMap[agency.id]?.property_count ?? 0,
        transaction_count: statsMap[agency.id]?.transaction_count ?? 0,
      }))
    },
    staleTime: 30_000,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'suspended' }) => {
      const { error } = await supabase.from('agencies').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-agencies'] })
    },
  })

  return {
    agencies: agencies.data ?? [],
    isLoading: agencies.isLoading,
    updateStatus,
  }
}

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

export function useAgencyProperties(agencyId: string) {
  return useQuery({
    queryKey: ['admin-agency-properties', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, title, status, price, city, canton, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })
}

export function useAgencyTransactions(agencyId: string) {
  return useQuery({
    queryKey: ['admin-agency-transactions', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, stage, status, price_offered, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })
}

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
