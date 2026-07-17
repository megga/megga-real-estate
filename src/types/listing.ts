/**
 * Type d'un bien (`Property`) côté CRM — annonce vente ou location.
 *
 * Modèle applicatif de la table `listings`. Champs optionnels ajoutés par vagues
 * (Fiche Bien sprint 2, support location 2026-04, plans interactifs, C2PA) — d'où
 * les nombreux `?` référencés à leur migration.
 */
import type { PropertyType, PropertyStatus } from '@/lib/constants'
import type { FloorPlanHotspot, PhotoTag } from './floorPlan'

export interface Property {
  id: string
  agency_id: string
  title: string
  description: string
  /** Notes internes équipe — jamais publiées (migration 20260614120000). */
  private_notes?: string | null
  type: PropertyType
  status: PropertyStatus
  price: number
  currency: string
  rooms: number
  bedrooms: number
  bathrooms: number
  surface_m2: number
  floor?: number
  total_floors?: number
  year_built?: number
  charges_monthly?: number
  mandate_type?: string
  // Sprint 2 — Fiche Bien (migration 20260517_001)
  energy_class?: string | null
  mandate_commission_pct?: number | null
  mandate_signed_at?: string | null
  mandate_expires_at?: string | null
  // Rental support (2026-04-15)
  transaction_type?: 'buy' | 'rent'
  deposit_months?: number | null
  is_furnished?: boolean
  external_regie?: {
    name: string
    phone: string
    email: string
    website?: string
  } | null
  condition?: string
  availability_date?: string
  address: string
  city: string
  canton: string
  postal_code: string
  lat: number
  lng: number
  photos: string[]
  video_url?: string
  photo_quality_scores?: Array<{ url: string; overall: number; flags: string[] }>
  c2pa_verified?: boolean
  c2pa_verified_at?: string
  features: string[]
  floor_plan_url?: string | null
  floor_plan_hotspots?: FloorPlanHotspot[]
  photo_tags?: PhotoTag[]
  created_by: string
  created_at: string
  published_at: string | null
  updated_at?: string
}
