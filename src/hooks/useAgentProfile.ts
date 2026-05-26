import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AgentProfileRow, AgencyProfileRow } from './useAgentDirectory'

export function useAgentProfile(slug: string) {
  return useQuery({
    queryKey: ['agent-profile', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_profiles')
        .select('*')
        .eq('slug', slug)
        .single()
      if (error) throw error

      let agency: AgencyProfileRow | null = null
      if (data.agency_profile_id) {
        const { data: agencyData } = await supabase
          .from('agency_profiles')
          .select('*')
          .eq('id', data.agency_profile_id)
          .single()
        agency = agencyData as unknown as AgencyProfileRow | null
      }

      return { agent: data as unknown as AgentProfileRow, agency }
    },
    enabled: !!slug,
    staleTime: 60_000,
  })
}

export function useAgencyProfile(slug: string) {
  return useQuery({
    queryKey: ['agency-profile', slug],
    queryFn: async () => {
      const { data: agency, error } = await supabase
        .from('agency_profiles')
        .select('*')
        .eq('slug', slug)
        .single()
      if (error) throw error

      const { data: agents } = await supabase
        .from('agent_profiles')
        .select('id, first_name, last_name, slug, photo_url, specialties, languages, status, rating_avg, rating_count')
        .eq('agency_profile_id', agency.id)
        .order('status', { ascending: true })
        .order('rating_avg', { ascending: false })

      return { agency: agency as AgencyProfileRow, agents: (agents ?? []) as AgentProfileRow[] }
    },
    enabled: !!slug,
    staleTime: 60_000,
  })
}
