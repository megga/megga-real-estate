import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ComplianceCase {
  id: string
  type: string
  risk_level: string
  risk_score: number | null
  status: string
  completion_pct: number
  screening_status: string | null
  created_at: string
  contact_name: string
  agency_name: string | null
  agency_id: string
}

export interface ComplianceStats {
  total: number
  pending: number
  pepMatches: number
  avgCompletion: number
}

export function useAdminCompliance() {
  const queryClient = useQueryClient()

  const cases = useQuery({
    queryKey: ['admin-compliance'],
    queryFn: async (): Promise<ComplianceCase[]> => {
      const { data, error } = await supabase
        .from('kyc_cases')
        .select('id, type, risk_level, risk_score, status, completion_pct, screening_status, created_at, contact_id, agency_id')
        .order('created_at', { ascending: false })
      if (error) throw error

      const contactIds = [...new Set((data ?? []).map(c => c.contact_id).filter(Boolean))]
      const agencyIds = [...new Set((data ?? []).map(c => c.agency_id).filter(Boolean))]

      const [contacts, agencies] = await Promise.all([
        contactIds.length > 0
          ? supabase.from('contacts').select('id, first_name, last_name').in('id', contactIds)
          : { data: [] },
        agencyIds.length > 0
          ? supabase.from('agencies').select('id, name').in('id', agencyIds)
          : { data: [] },
      ])

      const contactMap = Object.fromEntries(
        (contacts.data ?? []).map(c => [c.id, `${c.first_name} ${c.last_name}`])
      )
      const agencyMap = Object.fromEntries(
        (agencies.data ?? []).map(a => [a.id, a.name])
      )

      return (data ?? []).map(c => ({
        id: c.id,
        type: c.type,
        risk_level: c.risk_level ?? 'unassessed',
        risk_score: c.risk_score ?? null,
        status: c.status,
        completion_pct: c.completion_pct ?? 0,
        screening_status: c.screening_status ?? null,
        created_at: c.created_at,
        contact_name: contactMap[c.contact_id] ?? 'Inconnu',
        agency_name: c.agency_id ? agencyMap[c.agency_id] ?? null : null,
        agency_id: c.agency_id,
      }))
    },
    staleTime: 30_000,
  })

  // RPC unique (migration 20260518_004) — remplace 4 queries parallèles
  // (3 count:'exact' + 1 SELECT AVG) sur kyc_cases (red-team CLAUDE.md §7).
  const stats = useQuery({
    queryKey: ['admin-compliance-stats'],
    queryFn: async (): Promise<ComplianceStats> => {
      const { data, error } = await supabase.rpc('get_admin_compliance_stats')
      if (error) throw error
      const row = ((data as Array<{
        total: number
        pending: number
        screening_match: number
        avg_completion: number
      }> | null) ?? [])[0]
      return {
        total: Number(row?.total ?? 0),
        pending: Number(row?.pending ?? 0),
        pepMatches: Number(row?.screening_match ?? 0),
        avgCompletion: Math.round(Number(row?.avg_completion ?? 0)),
      }
    },
    staleTime: 60_000,
  })

  const updateRiskLevel = useMutation({
    mutationFn: async ({ id, riskLevel }: { id: string; riskLevel: string }) => {
      const { error } = await supabase.from('kyc_cases').update({ risk_level: riskLevel }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-compliance'] })
      queryClient.invalidateQueries({ queryKey: ['admin-compliance-stats'] })
    },
  })

  return {
    cases: cases.data ?? [],
    isLoading: cases.isLoading,
    stats: stats.data,
    statsLoading: stats.isLoading,
    updateRiskLevel,
  }
}
