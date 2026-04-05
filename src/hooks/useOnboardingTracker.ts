import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface AgencyOnboarding {
  agency_id: string
  agency_name: string
  created_at: string
  steps: {
    profile_completed: boolean
    first_contact: boolean
    first_property: boolean
    first_kyc: boolean
    first_transaction: boolean
    first_match: boolean
  }
  completion: number // 0-100
  status: 'active' | 'at_risk' | 'dormant'
  last_activity: string | null
}

export type { AgencyOnboarding }

export function useOnboardingTracker() {
  return useQuery({
    queryKey: ['admin-onboarding-tracker'],
    queryFn: async (): Promise<AgencyOnboarding[]> => {
      // Get all agencies
      const { data: agencies, error } = await supabase
        .from('agencies')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      if (!agencies?.length) return []

      const ids = agencies.map(a => a.id)

      // Use RPC for server-side milestone detection (single SQL query with EXISTS)
      const { data: milestones } = await supabase.rpc('get_onboarding_milestones', { agency_ids: ids })
      const milestoneMap: Record<string, { has_contact: boolean; has_property: boolean; has_kyc: boolean; has_transaction: boolean; has_match: boolean; last_activity_at: string | null }> = {}
      for (const m of milestones ?? []) {
        milestoneMap[m.agency_id] = m
      }

      return agencies.map(agency => {
        const m = milestoneMap[agency.id]
        const steps = {
          profile_completed: true, // They signed up, so profile exists
          first_contact: m?.has_contact ?? false,
          first_property: m?.has_property ?? false,
          first_kyc: m?.has_kyc ?? false,
          first_transaction: m?.has_transaction ?? false,
          first_match: m?.has_match ?? false,
        }

        const completedCount = Object.values(steps).filter(Boolean).length
        const completion = Math.round((completedCount / 6) * 100)

        const lastActivity = m?.last_activity_at ?? null
        const daysSinceActivity = lastActivity
          ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
          : 999

        const status: 'active' | 'at_risk' | 'dormant' =
          daysSinceActivity <= 7 ? 'active' :
          daysSinceActivity <= 21 ? 'at_risk' : 'dormant'

        return {
          agency_id: agency.id,
          agency_name: agency.name,
          created_at: agency.created_at,
          steps,
          completion,
          status,
          last_activity: lastActivity,
        }
      })
    },
    staleTime: 60_000,
  })
}
