import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface DirectoryFilters {
  query: string
  type: 'agents' | 'agencies'
  canton: string | null
  city: string | null
  specialties: string[]
  languages: string[]
  verifiedOnly: boolean
  sortBy: 'relevance' | 'name' | 'rating' | 'listings'
  page: number
}

export interface AgentProfileRow {
  id: string
  profile_id: string | null
  agency_profile_id: string | null
  first_name: string
  last_name: string
  slug: string
  photo_url: string | null
  canton: string | null
  city: string | null
  specialties: string[]
  languages: string[]
  bio: string | null
  experience_years: number | null
  certifications: string[]
  website_url: string | null
  phone: string | null
  email: string | null
  status: 'unclaimed' | 'claimed' | 'verified'
  stats_properties_sold: number
  stats_avg_price: number
  stats_avg_days_to_sell: number
  stats_response_rate: number
  rating_avg: number
  rating_count: number
  agency_name: string | null
  agency_slug: string | null
  created_at: string
}

export interface AgencyProfileRow {
  id: string
  agency_id: string | null
  name: string
  slug: string
  logo_url: string | null
  canton: string | null
  city: string | null
  address: string | null
  description: string | null
  founded_year: number | null
  specialties: string[]
  languages: string[]
  certifications: string[]
  website_url: string | null
  phone: string | null
  email: string | null
  zones_covered: string[]
  status: 'unclaimed' | 'claimed' | 'verified'
  agent_count: number
  active_listings_count: number
  rating_avg: number
  rating_count: number
  created_at: string
}

export interface DirectoryResult {
  total: number
  page: number
  pageSize: number
  items: AgentProfileRow[] | AgencyProfileRow[]
}

const PAGE_SIZE = 20

export const DEFAULT_FILTERS: DirectoryFilters = {
  query: '',
  type: 'agents',
  canton: null,
  city: null,
  specialties: [],
  languages: [],
  verifiedOnly: false,
  sortBy: 'relevance',
  page: 0,
}

export function useAgentDirectory(filters: DirectoryFilters) {
  return useQuery({
    queryKey: ['directory', filters],
    queryFn: async (): Promise<DirectoryResult> => {
      const { data, error } = await supabase.rpc('search_directory', {
        search_query: filters.query,
        search_type: filters.type,
        filter_canton: filters.canton,
        filter_city: filters.city,
        filter_specialties: filters.specialties.length > 0 ? filters.specialties : null,
        filter_languages: filters.languages.length > 0 ? filters.languages : null,
        filter_verified: filters.verifiedOnly ? true : null,
        sort_by: filters.sortBy,
        page_number: filters.page,
        page_size: PAGE_SIZE,
      })
      if (error) throw error
      return data as DirectoryResult
    },
    staleTime: 60_000,
  })
}
