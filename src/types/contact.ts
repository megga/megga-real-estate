/**
 * Types du domaine Contact (CRM).
 *
 * Miroir applicatif de la table `contacts` : champs de base + enrichissements IA
 * (scores, timing, engagement) et `search_criteria` lu par le matching-engine.
 * Les champs `ai_*` sont des estimations, jamais des vérités.
 */
import type { ContactScore } from '@/lib/constants'

/** Nature du contact dans le CRM (acheteur, vendeur, locataire, lead brut…). */
export type ContactType = 'buyer' | 'seller' | 'investor' | 'tenant' | 'landlord' | 'both' | 'lead'

/** Horizon d'achat estimé par l'IA. */
export type AiTiming = 'immediate' | '1-3_months' | '3-6_months' | '6-12_months' | 'long_term'
/** Niveau d'engagement du contact estimé par l'IA. */
export type AiEngagementLevel = 'very_high' | 'high' | 'medium' | 'low' | 'dormant'
/** Niveau de tension relationnelle estimé par l'IA. */
export type AiTensionLevel = 'calm' | 'moderate' | 'tense' | 'critical'

/** Contact CRM enrichi (miroir de la table `contacts`, champs `ai_*` = estimations). */
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
  /** Fourre-tout jsonb : civilité, langue UI, canal préféré, photo, linked_bien… */
  form_data?: Record<string, unknown> | null
  created_at: string

  // Enriched CRM fields (Étape 1)
  whatsapp_phone: string | null
  language: string

  /** Identité LBA art. 3 — colonnes réelles depuis la migration 20260718160000. */
  birth_date: string | null
  /** ISO 3166-1 alpha-2 (même format que kyc_cases.contact_nationality). */
  nationality: string | null
  /** ISO 3166-1 alpha-2. */
  residence_country: string | null
  home_address: string | null

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

/** Critères de recherche d'un acheteur/locataire, consommés par le matching-engine. */
export interface SearchCriteria {
  type?: string
  /** 'rent' (location) | 'buy' (achat/vente) — lu par matching-engine + pont client_searches. */
  transaction_type?: 'rent' | 'buy'
  budget_min?: number
  budget_max?: number
  /** Villes ET/OU codes cantons mélangés (ex. ["Carouge", "Genève", "GE"]). */
  zones?: string[]
  rooms_min?: number
  rooms_max?: number
  surface_min?: number
  surface_max?: number
  features?: string[]
}
