// ── Supabase Matching Types ──────────────────────────────────────────────────

export interface MatchReasons {
  budget: boolean
  zone: boolean
  type: boolean
  rooms_surface: boolean
  features: boolean
  budget_score: number
  zone_score: number
  type_score: number
  rooms_surface_score: number
  features_score: number
}

export type MatchStatus = 'suggested' | 'sent' | 'visit_planned' | 'interested' | 'rejected' | 'ignored'

export interface SupabaseMatch {
  id: string
  agency_id: string
  contact_id: string
  property_id: string
  client_search_id: string | null
  score: number
  reasons: MatchReasons | null
  status: MatchStatus
  sent_via: 'email' | 'whatsapp' | 'both' | null
  sent_at: string | null
  response_at: string | null
  created_at: string
}

export interface MatchWithRelations extends SupabaseMatch {
  contact: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string
    whatsapp_phone: string | null
    type: string
    score: string
  } | null
  property: {
    id: string
    title: string
    description: string | null
    type: string
    status: string
    price: number
    rooms: number
    bedrooms: number | null
    bathrooms: number | null
    surface_m2: number
    floor: number | null
    year_built: number | null
    address: string
    city: string
    canton: string
    postal_code: string
    photos: string[] | null
    features: string[] | null
    charges_monthly: number | null
  } | null
}

export interface ClientSearchCriteria {
  budget_min?: number
  budget_max?: number
  zones?: string[]
  type?: string
  rooms_min?: number
  rooms_max?: number
  surface_min?: number
  surface_max?: number
  features?: string[]
}

export interface SupabaseClientSearch {
  id: string
  agency_id: string
  contact_id: string
  label: string | null
  criteria: ClientSearchCriteria
  is_active: boolean
  last_matched_at: string | null
  created_at: string
  updated_at: string
}
