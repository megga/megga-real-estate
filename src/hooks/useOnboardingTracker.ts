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

      // Parallel queries for each milestone
      const [contacts, properties, kycCases, transactions, matches, activities] = await Promise.all([
        supabase.from('contacts').select('agency_id').in('agency_id', ids),
        supabase.from('properties').select('agency_id').in('agency_id', ids),
        supabase.from('kyc_cases').select('agency_id').in('agency_id', ids),
        supabase.from('transactions').select('agency_id').in('agency_id', ids),
        supabase.from('matches').select('agency_id').in('agency_id', ids),
        supabase.from('activity_events').select('agency_id, created_at').in('agency_id', ids).order('created_at', { ascending: false }),
      ])

      const hasContact = new Set((contacts.data ?? []).map(c => c.agency_id))
      const hasProperty = new Set((properties.data ?? []).map(p => p.agency_id))
      const hasKyc = new Set((kycCases.data ?? []).map(k => k.agency_id))
      const hasTransaction = new Set((transactions.data ?? []).map(t => t.agency_id))
      const hasMatch = new Set((matches.data ?? []).map(m => m.agency_id))

      // Last activity per agency
      const lastActivityMap: Record<string, string> = {}
      for (const evt of activities.data ?? []) {
        if (evt.agency_id && !lastActivityMap[evt.agency_id]) {
          lastActivityMap[evt.agency_id] = evt.created_at
        }
      }

      return agencies.map(agency => {
        const steps = {
          profile_completed: true, // They signed up, so profile exists
          first_contact: hasContact.has(agency.id),
          first_property: hasProperty.has(agency.id),
          first_kyc: hasKyc.has(agency.id),
          first_transaction: hasTransaction.has(agency.id),
          first_match: hasMatch.has(agency.id),
        }

        const completedCount = Object.values(steps).filter(Boolean).length
        const completion = Math.round((completedCount / 6) * 100)

        const lastActivity = lastActivityMap[agency.id] ?? null
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
