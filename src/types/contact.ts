import type { ContactScore } from '@/lib/constants'

export type ContactType = 'buyer' | 'seller' | 'investor' | 'tenant' | 'landlord' | 'both' | 'lead'

export type AiTiming = 'immediate' | '1-3_months' | '3-6_months' | '6-12_months' | 'long_term'
export type AiEngagementLevel = 'very_high' | 'high' | 'medium' | 'low' | 'dormant'
export type AiTensionLevel = 'calm' | 'moderate' | 'tense' | 'critical'

export interface Contact {
  id: string
  agency_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  type: ContactType
  source: string | null
  score: ContactScore | null
  tags: string[]
  notes: string | null
  created_at: string

  // Enriched CRM fields (Étape 1)
  whatsapp_phone: string | null
  language: string
  nationality: string | null
  budget_announced: number | null
  budget_estimated_ai: number | null
  search_zones: string[]
  search_criteria: SearchCriteria | null
  ai_seriousness_score: number | null
  ai_purchase_probability: number | null
  ai_timing: AiTiming | null
  ai_engagement_level: AiEngagementLevel | null
  ai_tension_level: AiTensionLevel | null
  ai_price_reduction_probability: number | null
  last_interaction_at: string | null
  updated_at: string | null
}

export interface SearchCriteria {
  type?: string
  budget_min?: number
  budget_max?: number
  zones?: string[]
  rooms_min?: number
  rooms_max?: number
  surface_min?: number
  surface_max?: number
  features?: string[]
}

export interface ActivityEvent {
  id: string
  agency_id: string
  actor_id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown> | null
  created_at: string
  description?: string
}
