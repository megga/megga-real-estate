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
  // Niveau 1 — Must-have / nice-to-have
  must_have_met: boolean
  must_have_missing: string[]
  nice_to_have_matched: string[]
  // Niveau 2 — Géospatial
  distance_km: number | null
  // Niveau 3 — Decay temporel
  freshness_decay: number
  days_on_market: number
}

export type MatchStatus = 'suggested' | 'sent' | 'visit_planned' | 'interested' | 'rejected' | 'ignored'

// Statuts de RÉACTION du client à un dossier envoyé (producteur HITL côté agent).
// Chacun pose matches.response_at via trigger DB (20260617120000). 'ignored' est
// exclu : c'est un écart agent, pas une réponse client.
export type MatchReaction = Extract<MatchStatus, 'interested' | 'visit_planned' | 'rejected'>

export interface SupabaseMatch {
  id: string
  agency_id: string
  contact_id: string
  property_id: string | null
  market_listing_id: string | null
  client_search_id: string | null
  score: number
  reasons: MatchReasons | null
  status: MatchStatus
  source: 'internal' | 'market'
  sent_via: 'email' | 'whatsapp' | 'both' | null
  sent_at: string | null
  response_at: string | null
  created_at: string
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
  // Niveau 1 — Must-have / nice-to-have
  must_have?: string[]
  nice_to_have?: string[]
  // Niveau 2 — Géospatial
  center_lat?: number
  center_lng?: number
  radius_km?: number
}
